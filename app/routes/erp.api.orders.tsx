import type { ActionFunctionArgs } from "react-router";
import { receiveOrder } from "../erp-simulator/erp.server";

export const loader = () =>
  Response.json({ error: "Use POST" }, { status: 405 });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Use POST" }, { status: 405 });
  }

  const result = await receiveOrder({
    authorization: request.headers.get("Authorization"),
    idempotencyKey: request.headers.get("Idempotency-Key"),
    body: await request.json().catch(() => null),
  });

  return Response.json(result.body, { status: result.status });
};
