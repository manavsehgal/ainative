"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectionTestControl, type ConnectionTestResult } from "./connection-test-control";

interface ApiKeyFormProps {
  hasKey: boolean;
  onSave: (key: string) => Promise<void>;
  onTest: () => Promise<ConnectionTestResult & { apiKeySource?: string }>;
  keyPrefix?: string;
  placeholder?: string;
  maskedPrefix?: string;
  envVarName?: string;
  testButtonLabel?: string;
}

export function ApiKeyForm({
  hasKey,
  onSave,
  onTest,
  keyPrefix = "sk-ant-",
  placeholder = "sk-ant-...",
  maskedPrefix = "sk-ant-••••••",
  envVarName = "ANTHROPIC_API_KEY",
  testButtonLabel = "Test Connection",
}: ApiKeyFormProps) {
  const [key, setKey] = useState("");
  const [showInput, setShowInput] = useState(!hasKey);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!key.startsWith(keyPrefix)) return;
    setSaving(true);
    try {
      await onSave(key);
      setKey("");
      setShowInput(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">API Key</Label>

      {hasKey && !showInput ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-md border px-3 py-2 text-sm text-muted-foreground bg-muted/50">
            Key configured ({maskedPrefix})
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowInput(true)}>
            Replace
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              placeholder={placeholder}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button
            size="sm"
            disabled={!key.startsWith(keyPrefix) || saving}
            onClick={handleSave}
          >
            {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Save
          </Button>
          {hasKey && (
            <Button variant="ghost" size="sm" onClick={() => setShowInput(false)}>
              Cancel
            </Button>
          )}
        </div>
      )}

      <ConnectionTestControl onTest={onTest} buttonLabel={testButtonLabel} />

      <p className="text-xs text-muted-foreground">
        Environment fallback: `{envVarName}`.
      </p>
    </div>
  );
}
