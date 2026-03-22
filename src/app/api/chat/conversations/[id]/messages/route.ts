import { NextRequest, NextResponse } from "next/server";
import { getConversation, getMessages } from "@/lib/data/chat";
import { sendMessage } from "@/lib/chat/engine";

/**
 * GET /api/chat/conversations/[id]/messages?after=xxx&limit=100
 * Fetch message history with optional cursor for reconnection.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const after = searchParams.get("after") ?? undefined;
  const limit = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!, 10)
    : undefined;

  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const messages = await getMessages(id, { after, limit });
  return NextResponse.json(messages);
}

/**
 * POST /api/chat/conversations/[id]/messages
 * Send a user message and stream the assistant response via SSE.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { content } = body;

  if (!content || typeof content !== "string") {
    return NextResponse.json(
      { error: "content is required and must be a string" },
      { status: 400 }
    );
  }

  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  // Bridge the async generator to an SSE ReadableStream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          // Stream may be closed
          clearInterval(keepalive);
        }
      }, 15_000);

      try {
        for await (const event of sendMessage(
          id,
          content,
          req.signal
        )) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));

          if (event.type === "done" || event.type === "error") {
            break;
          }
        }
      } catch (error) {
        const errorEvent = {
          type: "error",
          message:
            error instanceof Error ? error.message : "Stream error",
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
        );
      } finally {
        clearInterval(keepalive);
        controller.close();
      }
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
