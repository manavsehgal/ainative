"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { AuthMethod } from "@/lib/constants/settings";

interface AuthMethodSelectorProps {
  value: AuthMethod;
  onChange: (method: AuthMethod) => void;
}

export function AuthMethodSelector({ value, onChange }: AuthMethodSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Authentication Method</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as AuthMethod)}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="api_key" id="auth-api-key" />
          <Label htmlFor="auth-api-key" className="font-normal cursor-pointer">
            API Key
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="oauth" id="auth-oauth" />
          <Label htmlFor="auth-oauth" className="font-normal cursor-pointer">
            OAuth (Claude Max/Pro)
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
