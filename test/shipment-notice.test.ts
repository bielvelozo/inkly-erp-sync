import { describe, expect, it } from "vitest";
import { parseShipmentNotice } from "../app/integration/shipment-notice";

const notice = {
  shop: "inkly-demo.myshopify.com",
  externalId: "gid://shopify/Order/1",
  erpNumber: "SO-00001",
  trackingNumber: "IK473124829US",
  carrier: "Inkly Post (simulated)",
  trackingUrl: null,
  shippedAt: "2026-10-16T01:00:00.000Z",
};

describe("parseShipmentNotice", () => {
  it("reads a complete notice", () => {
    expect(parseShipmentNotice(JSON.stringify(notice))).toEqual(notice);
  });

  it("treats a missing tracking URL as null", () => {
    const withoutUrl: Partial<typeof notice> = { ...notice };
    delete withoutUrl.trackingUrl;
    expect(parseShipmentNotice(JSON.stringify(withoutUrl))?.trackingUrl).toBeNull();
  });

  it("rejects invalid JSON and missing fields", () => {
    expect(parseShipmentNotice("{")).toBeNull();
    expect(
      parseShipmentNotice(JSON.stringify({ ...notice, trackingNumber: "" })),
    ).toBeNull();
    expect(parseShipmentNotice(JSON.stringify({ ...notice, trackingUrl: 3 }))).toBeNull();
  });
});
