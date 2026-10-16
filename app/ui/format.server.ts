import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

const timezones = new Map<string, string>();

export async function shopTimezone(admin: AdminApiContext, shop: string) {
  const cached = timezones.get(shop);
  if (cached) return cached;

  const response = await admin.graphql(
    `#graphql
    query ShopTimezone {
      shop {
        ianaTimezone
      }
    }`,
  );
  const json = await response.json();
  const timezone = json.data?.shop?.ianaTimezone ?? "UTC";
  timezones.set(shop, timezone);
  return timezone;
}

export function formatDateTime(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function formatMoney(amount: string, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    Number(amount),
  );
}

export function adminOrderPath(orderGid: string) {
  return `shopify://admin/orders/${orderGid.split("/").pop()}`;
}
