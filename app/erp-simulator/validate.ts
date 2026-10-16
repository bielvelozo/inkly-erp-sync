import type { ErpOrderRequest } from "../integration/order-payload";

export interface IncomingErpOrder extends ErpOrderRequest {
  callbackUrl: string;
}

type Validation =
  | { ok: true; order: IncomingErpOrder }
  | { ok: false; error: string };

const isString = (value: unknown): value is string =>
  typeof value === "string" && value !== "";

function isHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function itemError(item: unknown, index: number): string | null {
  if (typeof item !== "object" || item === null) return `items[${index}] must be an object`;
  const line = item as Record<string, unknown>;
  if (!isString(line.title)) return `items[${index}].title is required`;
  if (!Number.isInteger(line.quantity) || (line.quantity as number) < 1) {
    return `items[${index}].quantity must be a positive integer`;
  }
  if (!isString(line.unitPrice)) return `items[${index}].unitPrice is required`;
  const customization = line.customization;
  if (
    typeof customization !== "object" ||
    customization === null ||
    Object.values(customization).some((value) => typeof value !== "string")
  ) {
    return `items[${index}].customization must map names to strings`;
  }
  return null;
}

export function validateIncomingOrder(data: unknown): Validation {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const order = data as Record<string, unknown>;

  for (const field of [
    "shop",
    "reference",
    "externalId",
    "placedAt",
    "currency",
    "total",
    "callbackUrl",
  ]) {
    if (!isString(order[field])) return { ok: false, error: `${field} is required` };
  }
  if (!isHttpUrl(order.callbackUrl as string)) {
    return { ok: false, error: "callbackUrl must be an http(s) URL" };
  }
  if (!Array.isArray(order.items) || order.items.length === 0) {
    return { ok: false, error: "items must list at least one line" };
  }
  for (const [index, item] of order.items.entries()) {
    const error = itemError(item, index);
    if (error) return { ok: false, error };
  }

  return { ok: true, order: order as unknown as IncomingErpOrder };
}
