import { timingSafeEqual } from "node:crypto";
import { Prisma, type ErpOrder } from "@prisma/client";
import db from "../db.server";
import { erpConfig } from "../config.server";
import { sign } from "../integration/signature";
import { fakeTrackingNumber } from "./tracking";
import { validateIncomingOrder } from "./validate";

export const CARRIER = "Inkly Post (simulated)";

export function erpNumber(id: number) {
  return `SO-${String(id).padStart(5, "0")}`;
}

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

function authorized(header: string | null) {
  const expected = Buffer.from(`Bearer ${erpConfig().apiKey}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function accepted(order: ErpOrder, duplicate: boolean): ApiResult {
  return {
    status: duplicate ? 200 : 201,
    body: { number: erpNumber(order.id), status: order.status, duplicate },
  };
}

export async function receiveOrder(request: {
  authorization: string | null;
  idempotencyKey: string | null;
  body: unknown;
}): Promise<ApiResult> {
  if (!authorized(request.authorization)) {
    return { status: 401, body: { error: "Invalid API key" } };
  }
  if (!request.idempotencyKey) {
    return { status: 400, body: { error: "Missing Idempotency-Key header" } };
  }
  const validation = validateIncomingOrder(request.body);
  if (!validation.ok) return { status: 422, body: { error: validation.error } };

  const { order } = validation;
  if (await isOffline(order.shop)) {
    return {
      status: 503,
      body: { error: "ERP under maintenance (simulated outage)" },
    };
  }

  const idempotencyKey = request.idempotencyKey;
  const existing = await db.erpOrder.findUnique({ where: { idempotencyKey } });
  if (existing) return accepted(existing, true);

  try {
    const created = await db.erpOrder.create({
      data: {
        idempotencyKey,
        shop: order.shop,
        reference: order.reference,
        externalId: order.externalId,
        payload: JSON.stringify(order),
        callbackUrl: order.callbackUrl,
      },
    });
    return accepted(created, false);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const winner = await db.erpOrder.findUnique({ where: { idempotencyKey } });
      if (winner) return accepted(winner, true);
    }
    throw error;
  }
}

export async function isOffline(shop: string) {
  const settings = await db.erpSettings.findUnique({ where: { shop } });
  return settings?.offline ?? false;
}

export function setOffline(shop: string, offline: boolean) {
  return db.erpSettings.upsert({
    where: { shop },
    create: { shop, offline },
    update: { offline },
  });
}

export function listErpOrders(shop: string) {
  return db.erpOrder.findMany({
    where: { shop },
    orderBy: { receivedAt: "desc" },
    take: 50,
  });
}

export async function shipOrder(shop: string, id: number) {
  const order = await db.erpOrder.findFirst({ where: { id, shop } });
  if (!order) return null;

  const shipped =
    order.status === "shipped"
      ? order
      : await db.erpOrder.update({
          where: { id },
          data: {
            status: "shipped",
            shippedAt: new Date(),
            trackingNumber: fakeTrackingNumber(),
          },
        });
  return notifyStore(shipped);
}

async function notifyStore(order: ErpOrder) {
  const body = JSON.stringify({
    shop: order.shop,
    externalId: order.externalId,
    erpNumber: erpNumber(order.id),
    trackingNumber: order.trackingNumber,
    carrier: CARRIER,
    trackingUrl: null,
    shippedAt: (order.shippedAt ?? new Date()).toISOString(),
  });

  let error: string | null = null;
  try {
    const response = await fetch(order.callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Erp-Signature": await sign(erpConfig().webhookSecret, body),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      error = json?.error ?? `The store answered ${response.status}`;
    }
  } catch (caught) {
    error = `Could not reach the store: ${caught instanceof Error ? caught.message : String(caught)}`;
  }

  return db.erpOrder.update({
    where: { id: order.id },
    data: error
      ? { notifyError: error }
      : { notifiedAt: new Date(), notifyError: null },
  });
}
