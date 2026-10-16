export interface WebhookLineItem {
  id: number;
  title: string;
  variant_title?: string | null;
  sku?: string | null;
  quantity: number;
  price: string;
  properties?: { name: string; value: string }[] | null;
}

export interface OrderCreatedPayload {
  id: number;
  admin_graphql_api_id: string;
  name: string;
  created_at: string;
  currency: string;
  total_price: string;
  line_items: WebhookLineItem[];
}

export interface ErpOrderItem {
  sku: string | null;
  title: string;
  variant: string | null;
  quantity: number;
  unitPrice: string;
  customization: Record<string, string>;
}

export interface ErpOrderRequest {
  shop: string;
  reference: string;
  externalId: string;
  placedAt: string;
  currency: string;
  total: string;
  items: ErpOrderItem[];
}

export function toErpOrder(
  shop: string,
  order: OrderCreatedPayload,
): ErpOrderRequest {
  return {
    shop,
    reference: order.name,
    externalId: order.admin_graphql_api_id,
    placedAt: order.created_at,
    currency: order.currency,
    total: order.total_price,
    items: order.line_items.map((line) => ({
      sku: line.sku || null,
      title: line.title,
      variant: line.variant_title || null,
      quantity: line.quantity,
      unitPrice: line.price,
      customization: visibleProperties(line.properties),
    })),
  };
}

// Line item properties starting with "_" are hidden from the buyer by convention
// (the theme stores the preview image and crop data there); the ERP only needs what the buyer typed.
function visibleProperties(
  properties: WebhookLineItem["properties"],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { name, value } of properties ?? []) {
    if (name.startsWith("_") || value === "") continue;
    result[name] = value;
  }
  return result;
}

export function itemCount(order: Pick<ErpOrderRequest, "items">): number {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}
