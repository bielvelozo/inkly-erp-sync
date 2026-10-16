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
  listSyncs,
  retryFailedSyncs,
} from "../integration/order-sync.server";
import { itemCount, type ErpOrderRequest } from "../integration/order-payload";
import { badgeFor, SyncStatus } from "../integration/status";
import { formatDateTime, formatMoney, shopTimezone } from "../ui/format.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [syncs, timezone] = await Promise.all([
    listSyncs(session.shop),
    shopTimezone(admin, session.shop),
  ]);

  const rows = syncs.map((sync) => {
    const order = JSON.parse(sync.payload) as ErpOrderRequest;
    return {
      id: sync.id,
      orderName: sync.orderName,
      placedAt: formatDateTime(sync.orderCreatedAt, timezone),
      items: itemCount(order),
      total: formatMoney(order.total, order.currency),
      status: sync.status,
      erpNumber: sync.erpNumber,
      trackingNumber: sync.trackingNumber,
      lastError: sync.lastError,
    };
  });

  return {
    rows,
    failed: rows.filter((row) => row.status === SyncStatus.Failed).length,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return retryFailedSyncs(session.shop);
};

export default function Orders() {
  const { rows, failed } = useLoaderData<typeof loader>();
  const retry = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const retrying = retry.state !== "idle";

  useEffect(() => {
    if (retry.state === "idle" && retry.data) {
      const { retried, recovered } = retry.data;
      shopify.toast.show(
        recovered === retried
          ? `${recovered} of ${retried} sent to the ERP`
          : `${recovered} of ${retried} sent; the ERP is still failing`,
        { isError: recovered < retried },
      );
    }
  }, [retry.state, retry.data, shopify]);

  return (
    <s-page heading="Orders sent to the ERP">
      <s-button slot="primary-action" href="/app/erp">
        Open simulated ERP
      </s-button>

      {failed > 0 && (
        <s-banner
          tone="critical"
          heading={`${failed} ${failed === 1 ? "order" : "orders"} did not reach the ERP`}
        >
          <s-paragraph>
            The webhook was received and saved, but the ERP rejected it or did
            not answer. Nothing is lost: send again when the ERP is back.
          </s-paragraph>
          <s-button
            slot="secondary-actions"
            onClick={() => retry.submit({}, { method: "POST" })}
            {...(retrying ? { loading: true } : {})}
          >
            Retry failed orders
          </s-button>
        </s-banner>
      )}

      <s-section padding="none" accessibilityLabel="Orders">
        {rows.length === 0 ? (
          <s-empty-state heading="No orders yet">
            <s-paragraph>
              Every new order in this store is sent to the ERP as soon as
              Shopify creates it. Place a test order (Orders, Create order,
              Mark as paid) and it shows up here.
            </s-paragraph>
          </s-empty-state>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Order</s-table-header>
              <s-table-header>Placed</s-table-header>
              <s-table-header format="numeric">Items</s-table-header>
              <s-table-header format="currency">Total</s-table-header>
              <s-table-header listSlot="secondary">Status</s-table-header>
              <s-table-header>ERP order</s-table-header>
              <s-table-header>Tracking</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((row) => {
                const badge = badgeFor(row.status);
                return (
                  <s-table-row key={row.id} clickDelegate={`sync-${row.id}`}>
                    <s-table-cell>
                      <s-link id={`sync-${row.id}`} href={`/app/orders/${row.id}`}>
                        {row.orderName}
                      </s-link>
                    </s-table-cell>
                    <s-table-cell>{row.placedAt}</s-table-cell>
                    <s-table-cell>{row.items}</s-table-cell>
                    <s-table-cell>{row.total}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone={badge.tone}>{badge.label}</s-badge>
                    </s-table-cell>
                    <s-table-cell>{row.erpNumber ?? "—"}</s-table-cell>
                    <s-table-cell>{row.trackingNumber ?? "—"}</s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section slot="aside" heading="How it works">
        <s-ordered-list>
          <s-list-item>
            Shopify calls the app with the orders/create webhook. Only the
            order number, totals and line items are kept: no customer name,
            email or address.
          </s-list-item>
          <s-list-item>
            The app posts the lines to the ERP API. A failure is saved with the
            reason and can be sent again, and the same order never goes twice.
          </s-list-item>
          <s-list-item>
            When the ERP ships, it calls the app back with the tracking number,
            and the app fulfills the order in Shopify.
          </s-list-item>
        </s-ordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
