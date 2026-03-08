"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Send } from "lucide-react";

export interface Question {
  question: string;
  header: string;
  options: { label: string; description: string }[];
  multiSelect: boolean;
}

interface MessageResponseProps {
  taskId: string;
  notificationId: string;
  toolInput: { questions: Question[] };
  responded: boolean;
  response: string | null;
  onResponded: () => void;
}

export function MessageResponse({
  taskId,
  notificationId,
  toolInput,
  responded,
  response,
  onResponded,
}: MessageResponseProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  if (responded && response) {
    return (
      <span className="text-xs text-muted-foreground">Response sent</span>
    );
  }

  const questions = toolInput?.questions ?? [];

  function handleSingleSelect(question: string, label: string) {
    setAnswers((prev) => ({ ...prev, [question]: label }));
  }

  function handleMultiSelect(question: string, label: string, checked: boolean) {
    setAnswers((prev) => {
      const current = prev[question] ? prev[question].split(", ") : [];
      const next = checked
        ? [...current, label]
        : current.filter((l) => l !== label);
      return { ...prev, [question]: next.join(", ") };
    });
  }

  async function handleSend() {
    setLoading(true);
    // Merge in "Other" text where applicable
    const finalAnswers: Record<string, string> = {};
    for (const q of questions) {
      const answer = answers[q.question] ?? "";
      if (answer === "__other__") {
        finalAnswers[q.question] = otherTexts[q.question] ?? "";
      } else {
        finalAnswers[q.question] = answer;
      }
    }

    try {
      await fetch(`/api/tasks/${taskId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId,
          behavior: "allow",
          updatedInput: {
            questions: toolInput.questions,
            answers: finalAnswers,
          },
        }),
      });
      onResponded();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 mt-2">
      {questions.map((q) => (
        <div key={q.question} className="space-y-2">
          <p className="text-sm font-medium">{q.question}</p>
          {q.multiSelect ? (
            <div className="space-y-2">
              {q.options.map((opt) => (
                <div key={opt.label} className="flex items-center gap-2">
                  <Checkbox
                    id={`${q.question}-${opt.label}`}
                    onCheckedChange={(checked) =>
                      handleMultiSelect(q.question, opt.label, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={`${q.question}-${opt.label}`}
                    className="text-sm"
                  >
                    {opt.label}
                    <span className="text-muted-foreground ml-1">
                      — {opt.description}
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <RadioGroup
              value={answers[q.question] ?? ""}
              onValueChange={(val) => handleSingleSelect(q.question, val)}
            >
              {q.options.map((opt) => (
                <div key={opt.label} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={opt.label}
                    id={`${q.question}-${opt.label}`}
                  />
                  <Label htmlFor={`${q.question}-${opt.label}`} className="text-sm">
                    {opt.label}
                    <span className="text-muted-foreground ml-1">
                      — {opt.description}
                    </span>
                  </Label>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <RadioGroupItem value="__other__" id={`${q.question}-other`} />
                <Label htmlFor={`${q.question}-other`} className="text-sm">
                  Other
                </Label>
                {answers[q.question] === "__other__" && (
                  <Input
                    value={otherTexts[q.question] ?? ""}
                    onChange={(e) =>
                      setOtherTexts((prev) => ({
                        ...prev,
                        [q.question]: e.target.value,
                      }))
                    }
                    placeholder="Type your answer"
                    className="h-7 text-sm"
                  />
                )}
              </div>
            </RadioGroup>
          )}
        </div>
      ))}
      <Button size="sm" onClick={handleSend} disabled={loading}>
        <Send className="h-3.5 w-3.5 mr-1" />
        Send
      </Button>
    </div>
  );
}
