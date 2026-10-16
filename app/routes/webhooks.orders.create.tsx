import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { receiveOrderWebhook } from "../integration/order-sync.server";
import type { OrderCreatedPayload } from "../integration/order-payload";

// Answers 200 even when the ERP is down: the failure is recorded and retried from the app,
// instead of making Shopify retry (and eventually flag) the webhook.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, webhookId } = await authenticate.webhook(request);

  await receiveOrderWebhook(shop, payload as OrderCreatedPayload, webhookId);

  return new Response();
};
