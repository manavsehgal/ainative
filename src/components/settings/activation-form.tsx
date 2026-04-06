"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateLicenseKey, formatKeyInput } from "@/lib/license/key-format";

interface ActivationFormProps {
  onActivated?: () => void;
}

export function ActivationForm({ onActivated }: ActivationFormProps) {
  const [keyInput, setKeyInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  function handleKeyChange(value: string) {
    // Strip the STAG- prefix for formatting, then re-add
    const raw = value.replace(/^STAG-?/, "").replace(/-/g, "");
    setKeyInput(formatKeyInput(raw));
    setError(null);
  }

  async function handleActivate() {
    const validation = validateLicenseKey(keyInput);
    if (!validation.valid) {
      setError(validation.error ?? "Invalid key");
      return;
    }

    setActivating(true);
    setError(null);

    try {
      const res = await fetch("/api/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyInput }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg =
          res.status === 404
            ? "License key not found"
            : res.status === 409
              ? "This key has already been used"
              : res.status === 410
                ? "This key has expired"
                : data.error ?? "Activation failed";
        setError(errorMsg);
        return;
      }

      toast.success(`Activated ${data.tier} tier!`);
      setKeyInput("");
      onActivated?.();
    } catch {
      setError("Network error — please try again");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Activate with License Key</span>
      </div>
      <div className="flex gap-2">
        <Input
          value={keyInput}
          onChange={(e) => handleKeyChange(e.target.value)}
          placeholder="STAG-XXXX-XXXX-XXXX-XXXX"
          className="font-mono text-sm"
          maxLength={24}
        />
        <Button
          size="sm"
          onClick={handleActivate}
          disabled={activating || keyInput.length < 24}
        >
          {activating ? "Activating..." : "Activate"}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
