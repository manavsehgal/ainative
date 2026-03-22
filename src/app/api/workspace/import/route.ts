import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { importWorkspaceSchema } from "@/lib/validators/workspace";
import { scanEnvironment } from "@/lib/environment/scanner";
import { createScan } from "@/lib/environment/data";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = importWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      let created = 0;
      let failed = 0;

      for (let i = 0; i < parsed.data.projects.length; i++) {
        if (closed) break;

        const { path: projectPath, name } = parsed.data.projects[i];

        send({
          type: "progress",
          index: i,
          name,
          status: "creating",
        });

        try {
          const now = new Date();
          const id = crypto.randomUUID();

          await db.insert(projects).values({
            id,
            name,
            description: null,
            workingDirectory: projectPath,
            status: "active",
            createdAt: now,
            updatedAt: now,
          });

          // Auto-scan environment
          let artifactCount = 0;
          try {
            const scanResult = scanEnvironment({ projectDir: projectPath });
            createScan(scanResult, projectPath, id);
            artifactCount = scanResult.artifacts.length;
          } catch {
            // Scan failure shouldn't block project creation
          }

          send({
            type: "progress",
            index: i,
            name,
            status: "done",
            projectId: id,
            artifactCount,
          });
          created++;
        } catch (err) {
          send({
            type: "progress",
            index: i,
            name,
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
          failed++;
        }
      }

      send({ type: "complete", created, failed });
      controller.close();
    },
    cancel() {
      closed = true;
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
