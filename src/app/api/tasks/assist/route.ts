import { NextRequest, NextResponse } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getAuthEnv } from "@/lib/settings/auth";

export interface TaskAssistResponse {
  improvedDescription: string;
  breakdown: { title: string; description: string }[];
  recommendedPattern: "single" | "sequence" | "planner-executor" | "checkpoint";
  complexity: "simple" | "moderate" | "complex";
  needsCheckpoint: boolean;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an AI task definition assistant. Analyze the given task and return ONLY a JSON object (no markdown, no code fences) with:
- "improvedDescription": A clearer version of the task for an AI agent to execute
- "breakdown": Array of {title, description} sub-tasks if complex (empty array if simple)
- "recommendedPattern": "single", "sequence", "planner-executor", or "checkpoint"
- "complexity": "simple", "moderate", or "complex"
- "needsCheckpoint": true if irreversible actions or needs human review
- "reasoning": Brief explanation`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description } = body as {
    title?: string;
    description?: string;
  };

  if (!title?.trim() && !description?.trim()) {
    return NextResponse.json(
      { error: "Provide at least a title or description" },
      { status: 400 }
    );
  }

  try {
    const authEnv = await getAuthEnv();
    const userMessage = [
      title ? `Task title: ${title}` : "",
      description ? `Description: ${description}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `${SYSTEM_PROMPT}\n\n${userMessage}`;

    const response = query({
      prompt,
      options: {
        cwd: process.cwd(),
        ...(authEnv && { env: { ...process.env, ...authEnv } }),
      },
    });

    let resultText = "";
    for await (const raw of response as AsyncIterable<Record<string, unknown>>) {
      if (raw.type === "result" && "result" in raw) {
        resultText =
          typeof raw.result === "string"
            ? raw.result
            : JSON.stringify(raw.result);
        break;
      }
    }

    if (!resultText) {
      return NextResponse.json({ error: "No result from AI" }, { status: 500 });
    }

    // Extract JSON from the result (may be wrapped in markdown fences)
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
    }

    const parsed: TaskAssistResponse = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI assist failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
