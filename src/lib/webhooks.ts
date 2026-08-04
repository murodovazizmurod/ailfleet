import { createHmac, randomUUID } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Dispatch a platform event to all active webhooks subscribed to it.
 * Each delivery is signed with HMAC-SHA256 over the JSON body using the
 * webhook's secret (X-AIlFleet-Webhook-Signature header) and recorded as a
 * WebhookDelivery row. Failures never throw — call fire-and-forget with `void`.
 */
export async function dispatchEvent(event: string, payload: unknown) {
  try {
    const hooks = await db.webhook.findMany({ where: { active: true } });
    const subscribed = hooks.filter((h) => {
      try {
        const events: unknown = JSON.parse(h.events ?? "[]");
        return Array.isArray(events) && events.includes(event);
      } catch {
        return false;
      }
    });

    await Promise.all(
      subscribed.map(async (hook) => {
        const body = JSON.stringify({
          id: randomUUID(),
          event,
          timestamp: new Date().toISOString(),
          payload,
        });
        const signature = createHmac("sha256", hook.secret).update(body).digest("hex");

        let statusCode: number | null = null;
        let success = false;
        try {
          const res = await fetch(hook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-AIlFleet-Webhook-Signature": signature,
              "X-AIlFleet-Event": event,
            },
            body,
            signal: AbortSignal.timeout(5000),
          });
          statusCode = res.status;
          success = res.ok;
        } catch {
          // network error / timeout — recorded as a failed delivery
        }

        await db.webhookDelivery.create({
          data: {
            webhookId: hook.id,
            event,
            payload: body,
            statusCode,
            success,
          },
        });
      })
    );
  } catch {
    // never let webhook dispatch break the caller
  }
}
