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
import {
  erpNumber,
  isOffline,
  listErpOrders,
  setOffline,
  shipOrder,
} from "../erp-simulator/erp.server";
import type { IncomingErpOrder } from "../erp-simulator/validate";
import { itemCount } from "../integration/order-payload";
import { formatDateTime, shopTimezone } from "../ui/format.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [orders, offline, timezone] = await Promise.all([
    listErpOrders(session.shop),
    isOffline(session.shop),
    shopTimezone(admin, session.shop),
  ]);

  return {
    offline,
    rows: orders.map((order) => ({
      id: order.id,
      number: erpNumber(order.id),
      reference: order.reference,
      items: itemCount(JSON.parse(order.payload) as IncomingErpOrder),
      receivedAt: formatDateTime(order.receivedAt, timezone),
      shipped: order.status === "shipped",
      trackingNumber: order.trackingNumber,
      notified: Boolean(order.notifiedAt),
      notifyError: order.notifyError,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();

  if (form.get("intent") === "availability") {
    const settings = await setOffline(session.shop, form.get("offline") === "true");
    return { intent: "availability" as const, offline: settings.offline };
  }

  const order = await shipOrder(session.shop, Number(form.get("id")));
  return {
    intent: "ship" as const,
    number: order ? erpNumber(order.id) : null,
    notifyError: order?.notifyError ?? null,
  };
};

export default function SimulatedErp() {
  const { offline, rows } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const busyId =
    fetcher.state !== "idle" && fetcher.formData?.get("intent") === "ship"
      ? Number(fetcher.formData.get("id"))
      : null;

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.intent === "availability") {
      shopify.toast.show(
        fetcher.data.offline ? "ERP API is now down (503)" : "ERP API is back online",
      );
    } else if (fetcher.data.notifyError) {
      shopify.toast.show(`Store not notified: ${fetcher.data.notifyError}`, {
        isError: true,
      });
    } else if (fetcher.data.number) {
      shopify.toast.show(`${fetcher.data.number} shipped, store notified`);
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const setAvailability = (down: boolean) =>
    fetcher.submit(
      { intent: "availability", offline: String(down) },
      { method: "POST" },
    );
  const ship = (id: number) =>
    fetcher.submit({ intent: "ship", id: String(id) }, { method: "POST" });

  return (
    <s-page heading="Simulated ERP">
      <s-link slot="breadcrumb-actions" href="/app">
        Orders
      </s-link>

      <s-banner tone="info" heading="This page plays the merchant's ERP">
        <s-paragraph>
          A stand-in for a real ERP such as NetSuite, Odoo or Bling. It receives
          orders through its own HTTP API, protected by an API key, and when
          you ship an order it calls the store back with a signed notice
          carrying the tracking number.
        </s-paragraph>
      </s-banner>

      <s-section heading="API availability">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-badge tone={offline ? "critical" : "success"}>
            {offline ? "Down: answers 503" : "Online"}
          </s-badge>
          <s-button onClick={() => setAvailability(!offline)}>
            {offline ? "Bring the API back" : "Simulate an outage"}
          </s-button>
        </s-stack>
        <s-paragraph>
          During an outage, new orders fail in the Orders page with the answer
          from the ERP, and can be sent again once the API is back.
        </s-paragraph>
      </s-section>

      <s-section heading="Sales orders" padding="none">
        {rows.length === 0 ? (
          <s-empty-state heading="No sales orders yet">
            <s-paragraph>
              Orders the store sends to this ERP appear here.
            </s-paragraph>
          </s-empty-state>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">ERP order</s-table-header>
              <s-table-header listSlot="kicker">Store order</s-table-header>
              <s-table-header format="numeric">Items</s-table-header>
              <s-table-header>Received</s-table-header>
              <s-table-header listSlot="secondary">Tracking</s-table-header>
              <s-table-header>Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((row) => (
                <s-table-row key={row.id}>
                  <s-table-cell>{row.number}</s-table-cell>
                  <s-table-cell>{row.reference}</s-table-cell>
                  <s-table-cell>{row.items}</s-table-cell>
                  <s-table-cell>{row.receivedAt}</s-table-cell>
                  <s-table-cell>{row.trackingNumber ?? "—"}</s-table-cell>
                  <s-table-cell>
                    {!row.shipped ? (
                      <s-button
                        variant="primary"
                        onClick={() => ship(row.id)}
                        {...(busyId === row.id ? { loading: true } : {})}
                      >
                        Ship
                      </s-button>
                    ) : row.notified ? (
                      <s-badge tone="success">Store notified</s-badge>
                    ) : (
                      <s-stack gap="small-200">
                        <s-button
                          onClick={() => ship(row.id)}
                          {...(busyId === row.id ? { loading: true } : {})}
                        >
                          Notify the store again
                        </s-button>
                        {row.notifyError && (
                          <s-text tone="critical">{row.notifyError}</s-text>
                        )}
                      </s-stack>
                    )}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
