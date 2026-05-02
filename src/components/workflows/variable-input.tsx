"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BlueprintVariable } from "@/lib/workflows/blueprints/types";

export interface VariableInputProps {
  variable: BlueprintVariable;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function VariableInput({
  variable,
  value,
  onChange,
}: VariableInputProps) {
  return (
    <div className="space-y-1.5">
      <Label>
        {variable.label}
        {variable.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {variable.description && (
        <p className="text-xs text-muted-foreground">{variable.description}</p>
      )}

      {variable.type === "text" && (
        <Input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={variable.placeholder}
        />
      )}

      {variable.type === "textarea" && (
        <Textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={variable.placeholder}
          rows={3}
        />
      )}

      {variable.type === "number" && (
        <Input
          type="number"
          value={value !== undefined ? Number(value) : ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          min={variable.min}
          max={variable.max}
        />
      )}

      {variable.type === "boolean" && (
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
        />
      )}

      {variable.type === "select" && variable.options && (
        <Select
          value={String(value ?? "")}
          onValueChange={onChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {variable.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
