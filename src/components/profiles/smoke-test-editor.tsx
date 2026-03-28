"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/shared/tag-input";
import { Plus, Trash2 } from "lucide-react";

export interface SmokeTestDraft {
  task: string;
  expectedKeywords: string;
}

interface SmokeTestEditorProps {
  tests: SmokeTestDraft[];
  onChange: (tests: SmokeTestDraft[]) => void;
  keywordSuggestions?: string[];
}

export function SmokeTestEditor({
  tests,
  onChange,
  keywordSuggestions = [],
}: SmokeTestEditorProps) {
  const addTest = () => {
    onChange([...tests, { task: "", expectedKeywords: "" }]);
  };

  const removeTest = (index: number) => {
    onChange(tests.filter((_, i) => i !== index));
  };

  const updateTest = (index: number, field: keyof SmokeTestDraft, value: string) => {
    const updated = tests.map((t, i) =>
      i === index ? { ...t, [field]: value } : t
    );
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {tests.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No tests defined. Add a test to verify this profile behaves correctly.
        </p>
      )}

      {tests.map((test, i) => (
        <div
          key={i}
          className="space-y-2 rounded-md border border-border/60 p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Test {i + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeTest(i)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Task</Label>
            <Textarea
              value={test.task}
              onChange={(e) => updateTest(i, "task", e.target.value)}
              placeholder="Describe a task this agent should handle well..."
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Expected Keywords</Label>
            <TagInput
              value={test.expectedKeywords}
              onChange={(v) => updateTest(i, "expectedKeywords", v)}
              suggestions={keywordSuggestions}
              placeholder="keyword1, keyword2, keyword3"
            />
            <p className="text-xs text-muted-foreground">
              Response must contain these keywords to pass.
            </p>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={addTest}
        className="w-full border border-dashed border-border/60"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Test
      </Button>
    </div>
  );
}
