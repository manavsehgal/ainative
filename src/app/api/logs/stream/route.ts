import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { agentLogs } from "@/lib/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("taskId");
  const eventType = url.searchParams.get("eventType");

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
            const conditions = [gt(agentLogs.timestamp, lastTimestamp)];
            if (taskId) conditions.push(eq(agentLogs.taskId, taskId));
            if (eventType) conditions.push(eq(agentLogs.event, eventType));

            const logs = await db
              .select()
              .from(agentLogs)
              .where(and(...conditions))
              .orderBy(agentLogs.timestamp)
              .limit(50);

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
