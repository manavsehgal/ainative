"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";

interface ApiKeyFormProps {
  hasKey: boolean;
  onSave: (key: string) => Promise<void>;
  onTest: () => Promise<{ connected: boolean; apiKeySource?: string; error?: string }>;
}

export function ApiKeyForm({ hasKey, onSave, onTest }: ApiKeyFormProps) {
  const [key, setKey] = useState("");
  const [showInput, setShowInput] = useState(!hasKey);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    error?: string;
  } | null>(null);

  async function handleSave() {
    if (!key.startsWith("sk-ant-")) return;
    setSaving(true);
    setTestResult(null);
    try {
      await onSave(key);
      setKey("");
      setShowInput(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">API Key</Label>

      {hasKey && !showInput ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-md border px-3 py-2 text-sm text-muted-foreground bg-muted/50">
            Key configured (sk-ant-••••••)
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
              placeholder="sk-ant-..."
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
            disabled={!key.startsWith("sk-ant-") || saving}
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

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
          {testing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Test Connection
        </Button>

        {testResult && (
          <span className="flex items-center gap-1.5 text-sm">
            {testResult.connected ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-success">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-status-failed" />
                <span className="text-status-failed">
                  {testResult.error || "Connection failed"}
                </span>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
