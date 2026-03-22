"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, HelpCircle } from "lucide-react";
import type { ChatQuestion as ChatQuestionType } from "@/lib/chat/types";

interface ChatQuestionProps {
  conversationId: string;
  requestId: string;
  messageId: string;
  questions: ChatQuestionType[];
  status: string; // "pending" | "complete" | "error"
}

export function ChatQuestionInline({
  conversationId,
  requestId,
  messageId,
  questions,
  status,
}: ChatQuestionProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(status === "complete");

  function getKey(q: ChatQuestionType) {
    return q.id ?? q.question;
  }

  function handleSingleSelect(key: string, label: string) {
    setAnswers((prev) => ({ ...prev, [key]: label }));
  }

  function handleMultiSelect(key: string, label: string, checked: boolean) {
    setAnswers((prev) => {
      const current = prev[key] ? prev[key].split(", ") : [];
      const next = checked
        ? [...current, label]
        : current.filter((l) => l !== label);
      return { ...prev, [key]: next.join(", ") };
    });
  }

  async function handleSend() {
    setLoading(true);
    const finalAnswers: Record<string, string> = {};
    for (const q of questions) {
      const key = getKey(q);
      const answer = answers[key] ?? "";
      finalAnswers[key] = answer === "__other__" ? (otherTexts[key] ?? "") : answer;
    }

    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            messageId,
            behavior: "allow",
            updatedInput: { questions, answers: finalAnswers },
          }),
        }
      );
      if (res.ok) {
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <HelpCircle className="h-4 w-4 shrink-0" />
          <span>Question answered</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-4">
      {questions.map((q) => (
        <div key={getKey(q)} className="space-y-2">
          <div className="flex items-start gap-2">
            <HelpCircle className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <p className="text-sm font-medium">{q.question}</p>
          </div>

          {(q.multiSelect ?? false) ? (
            <div className="space-y-2 pl-6">
              {(q.options ?? []).map((opt) => (
                <div key={opt.label} className="flex items-center gap-2">
                  <Checkbox
                    id={`${getKey(q)}-${opt.label}`}
                    onCheckedChange={(checked) =>
                      handleMultiSelect(getKey(q), opt.label, checked as boolean)
                    }
                  />
                  <Label htmlFor={`${getKey(q)}-${opt.label}`} className="text-sm">
                    {opt.label}
                    <span className="text-muted-foreground ml-1">— {opt.description}</span>
                  </Label>
                </div>
              ))}
            </div>
          ) : (q.options ?? []).length === 0 ? (
            <div className="pl-6">
              <Input
                type={q.isSecret ? "password" : "text"}
                value={answers[getKey(q)] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [getKey(q)]: e.target.value }))
                }
                placeholder="Type your answer"
                className="h-8 text-sm"
              />
            </div>
          ) : (
            <RadioGroup
              value={answers[getKey(q)] ?? ""}
              onValueChange={(val) => handleSingleSelect(getKey(q), val)}
              className="pl-6"
            >
              {(q.options ?? []).map((opt) => (
                <div key={opt.label} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.label} id={`${getKey(q)}-${opt.label}`} />
                  <Label htmlFor={`${getKey(q)}-${opt.label}`} className="text-sm">
                    {opt.label}
                    <span className="text-muted-foreground ml-1">— {opt.description}</span>
                  </Label>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <RadioGroupItem value="__other__" id={`${getKey(q)}-other`} />
                <Label htmlFor={`${getKey(q)}-other`} className="text-sm">
                  Other
                </Label>
                {answers[getKey(q)] === "__other__" && (
                  <Input
                    type={q.isSecret ? "password" : "text"}
                    value={otherTexts[getKey(q)] ?? ""}
                    onChange={(e) =>
                      setOtherTexts((prev) => ({ ...prev, [getKey(q)]: e.target.value }))
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
        <Send className="h-3.5 w-3.5" />
        Send
      </Button>
    </div>
  );
}
