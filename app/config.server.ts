import { createHmac } from "node:crypto";

function appUrl() {
  return (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");
}

// The simulated ERP ships inside this app, so by default both sides derive their shared
// secrets from the app secret and `npm run dev` works with no extra setup.
// Against a real ERP, set the variables to the key and secret the ERP issues.
function derivedSecret(label: string) {
  return createHmac("sha256", process.env.SHOPIFY_API_SECRET || "")
    .update(label)
    .digest("hex");
}

export function erpConfig() {
  return {
    apiUrl: process.env.ERP_API_URL || `${appUrl()}/erp/api`,
    apiKey: process.env.ERP_API_KEY || derivedSecret("erp-api-key"),
    webhookSecret:
      process.env.ERP_WEBHOOK_SECRET || derivedSecret("erp-webhook-secret"),
    timeoutMs: 3000,
  };
}

export function shipmentCallbackUrl() {
  return `${appUrl()}/webhooks/erp/shipments`;
}
