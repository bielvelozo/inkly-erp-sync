import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getSync, retrySync } from "../integration/order-sync.server";
import type { ErpOrderRequest } from "../integration/order-payload";
import { badgeFor, eventLabel, SyncStatus } from "../integration/status";
import {
  adminOrderPath,
  formatDateTime,
  formatMoney,
  shopTimezone,
} from "../ui/format.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const sync = await getSync(session.shop, Number(params.id));
  if (!sync) throw new Response("Not found", { status: 404 });

  const timezone = await shopTimezone(admin, session.shop);
  const order = JSON.parse(sync.payload) as ErpOrderRequest;

  return {
    orderName: sync.orderName,
    adminPath: adminOrderPath(sync.orderId),
    status: sync.status,
    erpNumber: sync.erpNumber,
    trackingNumber: sync.trackingNumber,
    trackingCompany: sync.trackingCompany,
    attempts: sync.attempts,
    webhookDeliveries: sync.webhookDeliveries,
    lastError: sync.lastError,
    placedAt: formatDateTime(sync.orderCreatedAt, timezone),
    total: formatMoney(order.total, order.currency),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: formatMoney(item.unitPrice, order.currency),
      customization: Object.entries(item.customization),
    })),
    events: sync.events.map((event) => ({
      id: event.id,
      at: formatDateTime(event.createdAt, timezone),
      label: eventLabel(event.kind),
      message: event.message,
      httpStatus: event.httpStatus,
    })),
    payload: JSON.stringify(order, null, 2),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const sync = await retrySync(session.shop, Number(params.id));
  return { status: sync?.status ?? null };
};

export default function OrderSyncDetail() {
  const data = useLoaderData<typeof loader>();
  const retry = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const badge = badgeFor(data.status);

  useEffect(() => {
    if (retry.state === "idle" && retry.data) {
      const sent = retry.data.status === SyncStatus.Sent;
      shopify.toast.show(sent ? "Sent to the ERP" : "The ERP is still failing", {
        isError: !sent,
      });
    }
  }, [retry.state, retry.data, shopify]);

  return (
    <s-page heading={`Order ${data.orderName}`}>
      <s-link slot="breadcrumb-actions" href="/app">
        Orders
      </s-link>
      <s-button slot="secondary-actions" href={data.adminPath}>
        View order in Shopify
      </s-button>

      {data.status === SyncStatus.Failed && (
        <s-banner tone="critical" heading="The ERP did not accept this order">
          <s-paragraph>{data.lastError}</s-paragraph>
          <s-button
            slot="secondary-actions"
            onClick={() => retry.submit({}, { method: "POST" })}
            {...(retry.state !== "idle" ? { loading: true } : {})}
          >
            Send again
          </s-button>
        </s-banner>
      )}
      {data.status === SyncStatus.FulfillmentFailed && (
        <s-banner tone="warning" heading="Shopify did not take the tracking number">
          <s-paragraph>
            {data.lastError}. Fix the order in Shopify, then notify the store
            again from the simulated ERP.
          </s-paragraph>
        </s-banner>
      )}

      <s-section heading="Summary">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))" gap="base">
          <s-stack gap="small-200">
            <s-text color="subdued">Status</s-text>
            <s-badge tone={badge.tone}>{badge.label}</s-badge>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">ERP order</s-text>
            <s-text>{data.erpNumber ?? "—"}</s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Tracking</s-text>
            <s-text>
              {data.trackingNumber
                ? `${data.trackingNumber} (${data.trackingCompany})`
                : "—"}
            </s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Placed</s-text>
            <s-text>{data.placedAt}</s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Total</s-text>
            <s-text>{data.total}</s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Deliveries</s-text>
            <s-text>
              {data.webhookDeliveries} webhook, {data.attempts} to the ERP
            </s-text>
          </s-stack>
        </s-grid>
      </s-section>

      <s-section heading="Items sent" padding="none">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Item</s-table-header>
            <s-table-header>SKU</s-table-header>
            <s-table-header format="numeric">Qty</s-table-header>
            <s-table-header format="currency">Unit price</s-table-header>
            <s-table-header listSlot="secondary">Personalization</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {data.items.map((item, index) => (
              <s-table-row key={index}>
                <s-table-cell>
                  {item.variant ? `${item.title} (${item.variant})` : item.title}
                </s-table-cell>
                <s-table-cell>{item.sku ?? "—"}</s-table-cell>
                <s-table-cell>{item.quantity}</s-table-cell>
                <s-table-cell>{item.unitPrice}</s-table-cell>
                <s-table-cell>
                  {item.customization.length === 0
                    ? "—"
                    : item.customization
                        .map(([name, value]) => `${name}: ${value}`)
                        .join(" · ")}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-section heading="History" padding="none">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="kicker">Time</s-table-header>
            <s-table-header listSlot="primary">Event</s-table-header>
            <s-table-header format="numeric">HTTP</s-table-header>
            <s-table-header listSlot="secondary">Details</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {data.events.map((event) => (
              <s-table-row key={event.id}>
                <s-table-cell>{event.at}</s-table-cell>
                <s-table-cell>{event.label}</s-table-cell>
                <s-table-cell>{event.httpStatus ?? ""}</s-table-cell>
                <s-table-cell>{event.message}</s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-section heading="Payload sent to the ERP">
        <s-box padding="base" borderRadius="base" background="subdued">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            <code>{data.payload}</code>
          </pre>
        </s-box>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
