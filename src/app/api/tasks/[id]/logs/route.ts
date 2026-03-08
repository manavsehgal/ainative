import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { agentLogs } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  const encoder = new TextEncoder();
  let lastTimestamp = new Date(0);
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      const poll = async () => {
        while (!closed) {
          try {
            const logs = await db
              .select()
              .from(agentLogs)
              .where(
                and(
                  eq(agentLogs.taskId, taskId),
                  gt(agentLogs.timestamp, lastTimestamp)
                )
              )
              .orderBy(agentLogs.timestamp);

            for (const log of logs) {
              send(JSON.stringify(log));
              if (log.timestamp > lastTimestamp) {
                lastTimestamp = log.timestamp;
              }
            }
          } catch {
            // DB error — keep polling
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      };

      // Keepalive
      const keepalive = setInterval(() => {
        if (closed) {
          clearInterval(keepalive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          closed = true;
          clearInterval(keepalive);
        }
      }, 15_000);

      // Clean up on abort
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(keepalive);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });

      poll();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
