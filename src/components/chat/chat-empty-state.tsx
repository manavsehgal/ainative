"use client";

import type { SuggestedPrompt } from "@/lib/chat/suggested-prompts";
import { Bot, Search, Sparkles, Bug, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatEmptyStateProps {
  suggestedPrompts: SuggestedPrompt[];
  onSuggestionClick: (prompt: string) => void;
  children?: React.ReactNode;
}

const categoryIcons = {
  explore: Search,
  create: PlusCircle,
  analyze: Sparkles,
  debug: Bug,
};

export function ChatEmptyState({
  suggestedPrompts,
  onSuggestionClick,
  children,
}: ChatEmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 w-full">
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">What can I help you with?</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Ask about your projects, tasks, workflows, or documents. I have full
          context of your workspace.
        </p>
      </div>

      {children && (
        <div className="w-full max-w-2xl mb-4">
          {children}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
        {suggestedPrompts.map((prompt, i) => {
          const Icon = categoryIcons[prompt.category] ?? Search;
          return (
            <Button
              key={i}
              variant="outline"
              className="h-auto py-3 px-4 justify-start text-left gap-3 hover:bg-muted/50"
              onClick={() => onSuggestionClick(prompt.prompt)}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm">{prompt.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
