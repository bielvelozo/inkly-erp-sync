import { Prisma, type OrderSync } from "@prisma/client";
import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { sendOrderToErp } from "./erp-client.server";
import { fulfillWithTracking } from "./fulfillment.server";
import {
  toErpOrder,
  type ErpOrderRequest,
  type OrderCreatedPayload,
} from "./order-payload";
import type { ShipmentNotice } from "./shipment-notice";
import { EventKind, SyncStatus } from "./status";

async function logEvent(
  orderSyncId: number,
  kind: EventKind,
  message: string,
  httpStatus?: number,
) {
  await db.syncEvent.create({
    data: { orderSyncId, kind, message, httpStatus },
  });
}

function findByOrder(shop: string, orderId: string) {
  return db.orderSync.findUnique({
    where: { shop_orderId: { shop, orderId } },
  });
}

export async function receiveOrderWebhook(
  shop: string,
  payload: OrderCreatedPayload,
  webhookId: string,
) {
  const order = toErpOrder(shop, payload);
  const existing = await findByOrder(shop, order.externalId);
  if (existing) return handleRepeatedDelivery(existing, webhookId);

  let sync: OrderSync;
  try {
    sync = await db.orderSync.create({
      data: {
        shop,
        orderId: order.externalId,
        orderName: order.reference,
        orderCreatedAt: new Date(order.placedAt),
        payload: JSON.stringify(order),
        events: {
          create: {
            kind: EventKind.WebhookReceived,
            message: `Shopify sent orders/create (webhook ${webhookId})`,
          },
        },
      },
    });
  } catch (error) {
    // Shopify can deliver the same webhook twice at the same time; the unique key decides who wins.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const winner = await findByOrder(shop, order.externalId);
      if (winner) return handleRepeatedDelivery(winner, webhookId);
    }
    throw error;
  }

  return pushToErp(sync.id);
}

async function handleRepeatedDelivery(sync: OrderSync, webhookId: string) {
  await db.orderSync.update({
    where: { id: sync.id },
    data: { webhookDeliveries: { increment: 1 } },
  });
  await logEvent(
    sync.id,
    EventKind.WebhookRepeated,
    `Shopify delivered this order again (webhook ${webhookId}); it was not sent twice`,
  );
  return sync.status === SyncStatus.Failed ? pushToErp(sync.id) : sync;
}

async function pushToErp(id: number) {
  const sync = await db.orderSync.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });
  const order = JSON.parse(sync.payload) as ErpOrderRequest;
  const result = await sendOrderToErp(order, `${sync.shop}/${sync.orderId}`);

  if (!result.ok) {
    await logEvent(id, EventKind.ErpFailed, result.error, result.httpStatus);
    return db.orderSync.update({
      where: { id },
      data: { status: SyncStatus.Failed, lastError: result.error },
    });
  }

  await logEvent(
    id,
    EventKind.ErpAccepted,
    result.duplicate
      ? `The ERP already had it as ${result.erpNumber}`
      : `The ERP created sales order ${result.erpNumber}`,
    result.httpStatus,
  );
  return db.orderSync.update({
    where: { id },
    data: {
      status: SyncStatus.Sent,
      erpNumber: result.erpNumber,
      lastError: null,
    },
  });
}

export async function retrySync(shop: string, id: number) {
  const sync = await db.orderSync.findFirst({ where: { id, shop } });
  if (!sync || sync.status !== SyncStatus.Failed) return sync;
  return pushToErp(sync.id);
}

export async function retryFailedSyncs(shop: string) {
  const failed = await db.orderSync.findMany({
    where: { shop, status: SyncStatus.Failed },
    orderBy: { createdAt: "asc" },
  });
  let recovered = 0;
  for (const sync of failed) {
    const result = await pushToErp(sync.id);
    if (result.status === SyncStatus.Sent) recovered++;
  }
  return { retried: failed.length, recovered };
}

export async function applyShipmentNotice(
  notice: ShipmentNotice,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const sync = await findByOrder(notice.shop, notice.externalId);
  if (!sync) return { status: 404, body: { error: "Unknown order" } };
  if (sync.status === SyncStatus.Fulfilled) {
    return {
      status: 200,
      body: { fulfillmentId: sync.fulfillmentId, duplicate: true },
    };
  }

  await logEvent(
    sync.id,
    EventKind.ShipmentReceived,
    `The ERP shipped ${notice.erpNumber}: ${notice.carrier} ${notice.trackingNumber}`,
  );
  const tracking = {
    trackingNumber: notice.trackingNumber,
    trackingCompany: notice.carrier,
    trackingUrl: notice.trackingUrl,
  };

  let result: Awaited<ReturnType<typeof fulfillWithTracking>>;
  try {
    const { admin } = await unauthenticated.admin(sync.shop);
    result = await fulfillWithTracking(admin, sync.orderId, {
      number: notice.trackingNumber,
      company: notice.carrier,
      url: notice.trackingUrl,
    });
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (!result.ok) {
    await logEvent(sync.id, EventKind.FulfillmentFailed, result.error);
    await db.orderSync.update({
      where: { id: sync.id },
      data: {
        ...tracking,
        status: SyncStatus.FulfillmentFailed,
        lastError: result.error,
      },
    });
    return { status: 502, body: { error: result.error } };
  }

  await logEvent(
    sync.id,
    EventKind.Fulfilled,
    "Shopify order marked as fulfilled with the tracking number",
  );
  await db.orderSync.update({
    where: { id: sync.id },
    data: {
      ...tracking,
      status: SyncStatus.Fulfilled,
      fulfillmentId: result.fulfillmentId,
      lastError: null,
    },
  });
  return { status: 200, body: { fulfillmentId: result.fulfillmentId } };
}

export function listSyncs(shop: string) {
  return db.orderSync.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export function getSync(shop: string, id: number) {
  return db.orderSync.findFirst({
    where: { id, shop },
    include: { events: { orderBy: { id: "asc" } } },
  });
}
