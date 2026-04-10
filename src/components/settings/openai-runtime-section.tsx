"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ApiKeyForm } from "./api-key-form";
import { AuthStatusBadge } from "./auth-status-badge";

interface OpenAISettings {
  method: "api_key" | "oauth";
  hasKey: boolean;
  apiKeySource: "db" | "env" | "unknown";
  oauthConnected?: boolean;
}

export function OpenAIRuntimeSection() {
  const [settings, setSettings] = useState<OpenAISettings>({
    method: "api_key",
    hasKey: false,
    apiKeySource: "unknown",
  });
  const [connected, setConnected] = useState(false);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/settings/openai");
    if (res.ok) {
      const data = (await res.json()) as OpenAISettings;
      setSettings(data);
      setConnected(data.hasKey);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSaveKey(apiKey: string) {
    const res = await fetch("/api/settings/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "api_key", apiKey }),
    });
    if (res.ok) {
      const data = (await res.json()) as OpenAISettings;
      setSettings(data);
      setConnected(true);
    }
  }

  async function handleTestConnection() {
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runtime: "openai-codex-app-server" }),
    });
    const data = await res.json();
    setConnected(data.connected);
    if (data.connected) {
      setSettings((prev) => ({
        ...prev,
        apiKeySource: (data.apiKeySource || "unknown") as OpenAISettings["apiKeySource"],
      }));
    }
    return data;
  }

  return (
    <Card className="surface-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>OpenAI Codex Runtime</CardTitle>
            <CardDescription>
              Configure the OpenAI API key used by the Codex app-server runtime.
            </CardDescription>
          </div>
          <AuthStatusBadge
            connected={connected}
            apiKeySource={settings.apiKeySource}
            authMethod={settings.method}
            oauthConnected={settings.oauthConnected}
            oauthLabel="ChatGPT"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          This runtime uses `codex app-server` with resumable threads, inbox approvals, and the same workflow/schedule pipeline as Claude-backed tasks.
        </p>
        <Separator />
        <ApiKeyForm
          hasKey={settings.hasKey}
          onSave={handleSaveKey}
          onTest={handleTestConnection}
          keyPrefix="sk-"
          placeholder="sk-..."
          maskedPrefix="sk-••••••"
          envVarName="OPENAI_API_KEY"
          testButtonLabel="Test Codex Runtime"
        />
      </CardContent>
    </Card>
  );
}
