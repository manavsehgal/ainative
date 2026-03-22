"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatModelSelector } from "./chat-model-selector";

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  isHeroMode: boolean;
  previewText?: string | null;
  modelId?: string;
  onModelChange?: (modelId: string) => void;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  isHeroMode,
  previewText,
  modelId,
  onModelChange,
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

  // Show preview text in placeholder when hovering a suggestion
  const placeholder = previewText || "Ask anything about your projects...";

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
            "flex flex-col elevation-2 border border-border bg-background",
            isHeroMode ? "rounded-2xl" : "rounded-xl"
          )}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground max-h-[200px] px-4 pt-3",
              isHeroMode ? "min-h-[80px]" : "min-h-[24px]"
            )}
            rows={isHeroMode ? 3 : 1}
            disabled={isStreaming}
          />

          {/* Toolbar row */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <div className="flex items-center gap-1">
              {modelId && onModelChange && (
                <ChatModelSelector
                  modelId={modelId}
                  onModelChange={onModelChange}
                />
              )}
            </div>
            <div className="flex items-center gap-1">
              {isStreaming && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-lg"
                  onClick={onStop}
                >
                  <Square className="h-3.5 w-3.5" />
                </Button>
              )}
              {!isStreaming && !isHeroMode && (
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
      </div>
    </div>
  );
}
