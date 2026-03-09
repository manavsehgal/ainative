import type { AgentProfile } from "./types";

export const generalProfile: AgentProfile = {
  id: "general",
  name: "General",
  description: "Balanced general-purpose agent for a wide range of tasks",
  domain: "general",
  tags: ["general", "default", "task", "help", "assistant"],
  systemPrompt: `You are a capable general-purpose assistant. Complete the assigned task thoroughly and accurately. If you need clarification, ask. Provide clear, structured output.`,
};
