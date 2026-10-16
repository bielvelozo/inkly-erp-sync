import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

export interface Tracking {
  number: string;
  company: string;
  url?: string | null;
}

export type FulfillmentResult =
  | { ok: true; fulfillmentId: string }
  | { ok: false; error: string };

const FULFILLABLE = new Set(["OPEN", "IN_PROGRESS"]);

export async function fulfillWithTracking(
  admin: AdminApiContext,
  orderId: string,
  tracking: Tracking,
): Promise<FulfillmentResult> {
  const lookup = await admin.graphql(
    `#graphql
    query OrderFulfillmentOrders($id: ID!) {
      order(id: $id) {
        fulfillmentOrders(first: 10) {
          nodes {
            id
            status
          }
        }
      }
    }`,
    { variables: { id: orderId } },
  );
  const lookupJson = await lookup.json();
  const fulfillmentOrderIds = (
    lookupJson.data?.order?.fulfillmentOrders.nodes ?? []
  )
    .filter((node) => FULFILLABLE.has(node.status))
    .map((node) => node.id);

  if (fulfillmentOrderIds.length === 0) {
    return {
      ok: false,
      error: "Nothing left to fulfill on this order in Shopify",
    };
  }

  const response = await admin.graphql(
    `#graphql
    mutation FulfillWithTracking($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        fulfillment: {
          lineItemsByFulfillmentOrder: fulfillmentOrderIds.map(
            (fulfillmentOrderId) => ({ fulfillmentOrderId }),
          ),
          trackingInfo: {
            number: tracking.number,
            company: tracking.company,
            ...(tracking.url ? { url: tracking.url } : {}),
          },
          notifyCustomer: false,
        },
      },
    },
  );
  const json = await response.json();
  const result = json.data?.fulfillmentCreate;

  if (!result?.fulfillment) {
    const messages = result?.userErrors.map((error) => error.message) ?? [];
    return {
      ok: false,
      error: messages.join("; ") || "Shopify did not create the fulfillment",
    };
  }

  return { ok: true, fulfillmentId: result.fulfillment.id };
}
