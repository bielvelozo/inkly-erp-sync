import { describe, expect, it } from "vitest";
import { sign, verify } from "../app/integration/signature";

describe("ERP notice signature", () => {
  it("matches a known HMAC-SHA256 vector", async () => {
    expect(await sign("secret", "hello")).toBe(
      "sha256=88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b",
    );
  });

  it("accepts its own signature", async () => {
    const body = JSON.stringify({ trackingNumber: "IK473124829US" });
    expect(await verify("secret", body, await sign("secret", body))).toBe(true);
  });

  it("rejects a changed body, another secret or a malformed header", async () => {
    const header = await sign("secret", "original");
    expect(await verify("secret", "tampered", header)).toBe(false);
    expect(await verify("other", "original", header)).toBe(false);
    expect(await verify("secret", "original", "sha256=zz")).toBe(false);
    expect(await verify("secret", "original", null)).toBe(false);
  });
});
