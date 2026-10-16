import { describe, expect, it } from "vitest";
import fixture from "./fixtures/orders-create.json";
import {
  itemCount,
  toErpOrder,
  type OrderCreatedPayload,
} from "../app/integration/order-payload";

const order = fixture as OrderCreatedPayload;

describe("toErpOrder", () => {
  const erpOrder = toErpOrder("inkly-demo.myshopify.com", order);

  it("keeps the order reference, totals and Shopify id", () => {
    expect(erpOrder).toMatchObject({
      shop: "inkly-demo.myshopify.com",
      reference: "#1004",
      externalId: "gid://shopify/Order/6912345678901",
      placedAt: "2026-10-15T21:14:03-04:00",
      currency: "USD",
      total: "57.00",
    });
  });

  it("sends what the buyer typed and drops hidden and empty properties", () => {
    expect(erpOrder.items[0]).toEqual({
      sku: "MUG-WHITE",
      title: "Personalized Mug",
      variant: "White",
      quantity: 1,
      unitPrice: "24.00",
      customization: {
        Text: "Good morning, Ana",
        Font: "Pacifico",
        Color: "#e4572e",
      },
    });
  });

  it("turns a blank SKU and a missing variant into null", () => {
    expect(erpOrder.items[1]).toMatchObject({ sku: null, variant: null });
  });

  it("counts units, not lines", () => {
    expect(itemCount(erpOrder)).toBe(4);
  });
});
