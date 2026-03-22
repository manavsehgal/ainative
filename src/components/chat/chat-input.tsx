"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  isHeroMode: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  isHeroMode,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount and after sending
  useEffect(() => {
    textareaRef.current?.focus();
  }, [isStreaming]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        textareaRef.current?.blur();
      }
    },
    [handleSend]
  );

  // Auto-resize textarea
  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  }, []);

  return (
    <div
      className={cn(
        isHeroMode
          ? "w-full"
          : "sticky bottom-0 bg-background border-t border-border pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <div
        className={cn(
          "mx-auto px-4 py-3",
          isHeroMode ? "max-w-2xl" : "max-w-3xl"
        )}
      >
        <div
          className={cn(
            "flex gap-2 elevation-2 border border-border bg-background",
            isHeroMode
              ? "items-start rounded-2xl p-4"
              : "items-end rounded-xl p-3"
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your projects..."
            className={cn(
              "flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground max-h-[200px]",
              isHeroMode ? "min-h-[80px]" : "min-h-[24px]"
            )}
            rows={isHeroMode ? 3 : 1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg"
              onClick={onStop}
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg"
              onClick={handleSend}
              disabled={!value.trim()}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
