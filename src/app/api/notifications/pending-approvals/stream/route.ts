import { NextRequest } from "next/server";

import { listPendingApprovalPayloads } from "@/lib/notifications/actionable";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let closed = false;
  let previousSignature = "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: string) => {
        if (closed) return;

        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          closed = true;
        }
      };

      const poll = async () => {
        while (!closed) {
          try {
            const approvals = await listPendingApprovalPayloads();
            const signature = JSON.stringify(
              approvals.map((approval) => [
                approval.notificationId,
                approval.createdAt,
              ])
            );

            if (signature !== previousSignature) {
              previousSignature = signature;
              send(JSON.stringify(approvals));
            }
          } catch (error) {
            console.error(
              "[SSE /api/notifications/pending-approvals/stream] DB poll error:",
              error
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }

          await new Promise((resolve) => setTimeout(resolve, 750));
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
          // Stream already closed.
        }
      });

      poll().catch((error) => {
        console.error(
          "[SSE /api/notifications/pending-approvals/stream] poll loop error:",
          error
        );
        closed = true;
        clearInterval(keepalive);

        try {
          controller.close();
        } catch {
          // Stream already closed.
        }
      });
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
