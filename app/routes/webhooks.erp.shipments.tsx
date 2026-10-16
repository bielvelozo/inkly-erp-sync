import type { ActionFunctionArgs } from "react-router";
import { erpConfig } from "../config.server";
import { applyShipmentNotice } from "../integration/order-sync.server";
import { parseShipmentNotice } from "../integration/shipment-notice";
import { verify } from "../integration/signature";

export const action = async ({ request }: ActionFunctionArgs) => {
  const raw = await request.text();
  const signature = request.headers.get("X-Erp-Signature");

  if (!(await verify(erpConfig().webhookSecret, raw, signature))) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const notice = parseShipmentNotice(raw);
  if (!notice) {
    return Response.json({ error: "Invalid shipment notice" }, { status: 422 });
  }

  const result = await applyShipmentNotice(notice);
  return Response.json(result.body, { status: result.status });
};
