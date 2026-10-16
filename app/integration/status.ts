export const SyncStatus = {
  Pending: "pending",
  Sent: "sent",
  Failed: "failed",
  Fulfilled: "fulfilled",
  FulfillmentFailed: "fulfillment_failed",
} as const;

export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

type BadgeTone = "info" | "success" | "critical" | "warning" | "neutral";

export const statusBadge: Record<SyncStatus, { label: string; tone: BadgeTone }> =
  {
    pending: { label: "Sending", tone: "neutral" },
    sent: { label: "In the ERP", tone: "info" },
    failed: { label: "ERP error", tone: "critical" },
    fulfilled: { label: "Shipped", tone: "success" },
    fulfillment_failed: { label: "Tracking error", tone: "warning" },
  };

export function badgeFor(status: string) {
  return (
    statusBadge[status as SyncStatus] ?? { label: status, tone: "neutral" }
  );
}

export const EventKind = {
  WebhookReceived: "webhook_received",
  WebhookRepeated: "webhook_repeated",
  ErpAccepted: "erp_accepted",
  ErpFailed: "erp_failed",
  ShipmentReceived: "shipment_received",
  Fulfilled: "fulfilled",
  FulfillmentFailed: "fulfillment_failed",
} as const;

export type EventKind = (typeof EventKind)[keyof typeof EventKind];

const eventLabels: Record<EventKind, string> = {
  webhook_received: "Webhook received",
  webhook_repeated: "Repeated webhook",
  erp_accepted: "Sent to the ERP",
  erp_failed: "ERP error",
  shipment_received: "Shipped by the ERP",
  fulfilled: "Fulfilled in Shopify",
  fulfillment_failed: "Fulfillment error",
};

export function eventLabel(kind: string) {
  return eventLabels[kind as EventKind] ?? kind;
}
