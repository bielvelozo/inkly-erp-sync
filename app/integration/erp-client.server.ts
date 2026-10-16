import { erpConfig, shipmentCallbackUrl } from "../config.server";
import type { ErpOrderRequest } from "./order-payload";

export type ErpSendResult =
  | { ok: true; httpStatus: number; erpNumber: string; duplicate: boolean }
  | { ok: false; httpStatus?: number; error: string };

export async function sendOrderToErp(
  order: ErpOrderRequest,
  idempotencyKey: string,
): Promise<ErpSendResult> {
  const { apiUrl, apiKey, timeoutMs } = erpConfig();

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ ...order, callbackUrl: shipmentCallbackUrl() }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut
        ? `The ERP did not answer within ${timeoutMs / 1000} s`
        : `Could not reach the ERP: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const body = (await response.json().catch(() => null)) as {
    number?: string;
    duplicate?: boolean;
    error?: string;
  } | null;

  if (!response.ok || !body?.number) {
    return {
      ok: false,
      httpStatus: response.status,
      error: body?.error ?? `The ERP answered ${response.status}`,
    };
  }

  return {
    ok: true,
    httpStatus: response.status,
    erpNumber: body.number,
    duplicate: Boolean(body.duplicate),
  };
}
