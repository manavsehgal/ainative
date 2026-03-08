"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AuthMethodSelector } from "./auth-method-selector";
import { ApiKeyForm } from "./api-key-form";
import { AuthStatusBadge } from "./auth-status-badge";
import type { AuthMethod, ApiKeySource } from "@/lib/constants/settings";

interface AuthSettings {
  method: AuthMethod;
  hasKey: boolean;
  apiKeySource: ApiKeySource;
}

export function AuthConfigSection() {
  const [settings, setSettings] = useState<AuthSettings>({
    method: "api_key",
    hasKey: false,
    apiKeySource: "unknown",
  });
  const [connected, setConnected] = useState(false);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (res.ok) {
      const data = await res.json();
      setSettings(data);
      setConnected(data.hasKey || data.apiKeySource === "oauth");
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleMethodChange(method: AuthMethod) {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data);
    }
  }

  async function handleSaveKey(apiKey: string) {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "api_key", apiKey }),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data);
      setConnected(true);
    }
  }

  async function handleTestConnection() {
    const res = await fetch("/api/settings/test", { method: "POST" });
    const data = await res.json();
    setConnected(data.connected);
    if (data.connected && data.apiKeySource) {
      setSettings((prev) => ({ ...prev, apiKeySource: data.apiKeySource }));
    }
    return data;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>
              Configure how Stagent connects to the Claude API
            </CardDescription>
          </div>
          <AuthStatusBadge connected={connected} apiKeySource={settings.apiKeySource} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <AuthMethodSelector value={settings.method} onChange={handleMethodChange} />

        {settings.method === "api_key" && (
          <>
            <Separator />
            <ApiKeyForm
              hasKey={settings.hasKey}
              onSave={handleSaveKey}
              onTest={handleTestConnection}
            />
            {settings.apiKeySource === "env" && (
              <p className="text-xs text-muted-foreground">
                Currently using API key from environment variable (ANTHROPIC_API_KEY).
                You can optionally save a managed key above to override it.
              </p>
            )}
          </>
        )}

        {settings.method === "oauth" && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                OAuth mode uses the Claude Agent SDK&apos;s built-in authentication flow.
                Requires an active Claude Max or Pro subscription.
              </p>
              <button
                onClick={handleTestConnection}
                className="text-sm text-primary hover:underline"
              >
                Test OAuth connection
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
