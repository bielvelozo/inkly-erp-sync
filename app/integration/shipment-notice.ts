export interface ShipmentNotice {
  shop: string;
  externalId: string;
  erpNumber: string;
  trackingNumber: string;
  carrier: string;
  trackingUrl: string | null;
  shippedAt: string;
}

const REQUIRED = [
  "shop",
  "externalId",
  "erpNumber",
  "trackingNumber",
  "carrier",
  "shippedAt",
] as const;

export function parseShipmentNotice(raw: string): ShipmentNotice | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;

  const record = data as Record<string, unknown>;
  for (const field of REQUIRED) {
    if (typeof record[field] !== "string" || record[field] === "") return null;
  }
  const trackingUrl = record.trackingUrl;
  if (trackingUrl != null && typeof trackingUrl !== "string") return null;

  return {
    shop: record.shop as string,
    externalId: record.externalId as string,
    erpNumber: record.erpNumber as string,
    trackingNumber: record.trackingNumber as string,
    carrier: record.carrier as string,
    trackingUrl: (trackingUrl as string | null | undefined) ?? null,
    shippedAt: record.shippedAt as string,
  };
}
