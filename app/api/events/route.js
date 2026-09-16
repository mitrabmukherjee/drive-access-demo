import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const POLL_MS = 1000;
const PING_MS = 15000;
const STREAM_ROTATE_MS = 4 * 60 * 1000;

function parseSince(req) {
  const header = req.headers.get("last-event-id");
  if (header) {
    const n = parseInt(header, 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  try {
    const q = new URL(req.url).searchParams.get("since");
    if (q) {
      const n = parseInt(q, 10);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
  } catch {
    // ignore
  }
  return 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request) {
  const session = await auth();
  const email = String(session?.user?.email ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sinceParam = parseSince(request);
  let lastId = sinceParam;
  if (sinceParam === 0) {
    const latest = await db.liveEvent.findFirst({
      where: { targetEmail: email },
      orderBy: { id: "desc" },
      select: { id: true },
    });
    if (latest) lastId = latest.id;
  }

  const encoder = new TextEncoder();
  const abortSignal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const streamStartedAt = Date.now();
      let lastPing = Date.now();

      const safeClose = () => {
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      abortSignal?.addEventListener("abort", safeClose);

      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "hello" })}\n\n`),
        );

        while (!abortSignal?.aborted) {
          const now = Date.now();
          if (now - streamStartedAt >= STREAM_ROTATE_MS) {
            controller.enqueue(
              encoder.encode("event: reconnect\ndata: {}\n\n"),
            );
            break;
          }
          if (now - lastPing >= PING_MS) {
            controller.enqueue(encoder.encode(": ping\n\n"));
            lastPing = now;
          }

          const rows = await db.liveEvent.findMany({
            where: { targetEmail: email, id: { gt: lastId } },
            orderBy: { id: "asc" },
            take: 100,
          });

          for (const row of rows) {
            lastId = row.id;
            const data =
              row.payload && typeof row.payload === "object"
                ? row.payload
                : { type: row.type, payload: row.payload };
            controller.enqueue(
              encoder.encode(`id: ${row.id}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          }

          await sleep(POLL_MS);
        }
      } catch {
        safeClose();
        return;
      }
      safeClose();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
