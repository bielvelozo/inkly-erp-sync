import { describe, expect, it } from "vitest";
import { fakeTrackingNumber, s10CheckDigit } from "../app/erp-simulator/tracking";
import { validateIncomingOrder } from "../app/erp-simulator/validate";

const validOrder = {
  shop: "inkly-demo.myshopify.com",
  reference: "#1004",
  externalId: "gid://shopify/Order/1",
  placedAt: "2026-10-15T21:14:03-04:00",
  currency: "USD",
  total: "24.00",
  callbackUrl: "https://example.com/webhooks/erp/shipments",
  items: [
    {
      sku: "MUG-WHITE",
      title: "Personalized Mug",
      variant: "White",
      quantity: 1,
      unitPrice: "24.00",
      customization: { Text: "Hi" },
    },
  ],
};

describe("validateIncomingOrder", () => {
  it("accepts a complete order", () => {
    expect(validateIncomingOrder(validOrder)).toEqual({
      ok: true,
      order: validOrder,
    });
  });

  it.each([
    [null, "Body must be a JSON object"],
    [{ ...validOrder, reference: "" }, "reference is required"],
    [{ ...validOrder, callbackUrl: "ftp://x" }, "callbackUrl must be an http(s) URL"],
    [{ ...validOrder, items: [] }, "items must list at least one line"],
    [
      { ...validOrder, items: [{ ...validOrder.items[0], quantity: 0 }] },
      "items[0].quantity must be a positive integer",
    ],
    [
      { ...validOrder, items: [{ ...validOrder.items[0], customization: { Size: 2 } }] },
      "items[0].customization must map names to strings",
    ],
  ])("rejects %j", (body, error) => {
    expect(validateIncomingOrder(body)).toEqual({ ok: false, error });
  });
});

describe("tracking numbers", () => {
  it("computes the S10 check digit", () => {
    expect(s10CheckDigit("47312482")).toBe(9);
    expect(s10CheckDigit("00000000")).toBe(5);
  });

  it("builds a valid S10-shaped number", () => {
    const sequence = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    const number = fakeTrackingNumber(() => sequence.shift() ?? 0);
    expect(number).toBe(`IK12345678${s10CheckDigit("12345678")}US`);
    expect(number).toMatch(/^IK\d{9}US$/);
  });
});
