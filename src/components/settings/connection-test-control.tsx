"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface ConnectionTestResult {
  connected: boolean;
  error?: string;
}

interface ConnectionTestControlProps {
  onTest: () => Promise<ConnectionTestResult>;
  buttonLabel?: string;
}

export function ConnectionTestControl({
  onTest,
  buttonLabel = "Test Connection",
}: ConnectionTestControlProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

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
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
        {testing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
        {buttonLabel}
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
  );
}
