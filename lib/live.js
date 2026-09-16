import { db } from "./db";

const EVENT_TTL_MS = 60 * 60 * 1000;

/**
 * Persist one LiveEvent per recipient so SSE works across serverless instances.
 * @param {Array<string | null | undefined>} emails
 * @param {object} payload
 */
export async function publish(emails, payload) {
  const targets = [
    ...new Set(
      emails.map((e) => String(e ?? "").trim().toLowerCase()).filter(Boolean),
    ),
  ];
  if (targets.length === 0) return;

  await db.liveEvent.createMany({
    data: targets.map((targetEmail) => ({
      targetEmail,
      type: payload?.type ?? "assignment",
      payload,
    })),
  });

  const cutoff = new Date(Date.now() - EVENT_TTL_MS);
  await db.liveEvent
    .deleteMany({ where: { createdAt: { lt: cutoff } } })
    .catch((e) => console.error("[live] prune failed", e));
}
