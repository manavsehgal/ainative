"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHAT_MODELS, DEFAULT_CHAT_MODEL, type ChatModelOption } from "@/lib/chat/types";
import { FormSectionCard } from "@/components/shared/form-section-card";
import { MessageCircle } from "lucide-react";

export function ChatSettingsSection() {
  const [defaultModel, setDefaultModel] = useState(DEFAULT_CHAT_MODEL);
  const [ollamaModels, setOllamaModels] = useState<ChatModelOption[]>([]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/chat");
      if (res.ok) {
        const data = await res.json();
        setDefaultModel(data.defaultModel ?? DEFAULT_CHAT_MODEL);
      }
    } catch {
      // Use default
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    // Fetch Ollama models for the dropdown
    fetch("/api/runtimes/ollama")
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((data: { models?: Array<{ name: string }> }) => {
        setOllamaModels(
          (data.models ?? []).map((m) => ({
            id: `ollama:${m.name}`,
            label: m.name.replace(/:latest$/, ""),
            provider: "ollama" as const,
            tier: "Local",
            costLabel: "Free",
          }))
        );
      })
      .catch(() => {});
  }, [fetchSettings]);

  const handleModelChange = async (modelId: string) => {
    setDefaultModel(modelId);
    await fetch("/api/settings/chat", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultModel: modelId }),
    });
  };

  const anthropicModels = CHAT_MODELS.filter(
    (m) => m.provider === "anthropic"
  );
  const openaiModels = CHAT_MODELS.filter((m) => m.provider === "openai");

  return (
    <Card id="settings-chat" className="scroll-mt-4">
      <CardHeader>
        <CardTitle>Chat</CardTitle>
        <CardDescription>
          Configure defaults for the chat conversation interface.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormSectionCard
          icon={MessageCircle}
          title="Default Model"
          hint="Model used for new chat conversations. Can be overridden per conversation."
        >
          <Select value={defaultModel} onValueChange={handleModelChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Anthropic</SelectLabel>
                {anthropicModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label} — {m.tier} ({m.costLabel})
                  </SelectItem>
                ))}
              </SelectGroup>
              {openaiModels.length > 0 && (
                <SelectGroup>
                  <SelectLabel>OpenAI</SelectLabel>
                  {openaiModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label} — {m.tier} ({m.costLabel})
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {ollamaModels.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Ollama (Local)</SelectLabel>
                  {ollamaModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label} — {m.tier} ({m.costLabel})
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </FormSectionCard>
      </CardContent>
    </Card>
  );
}
