"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatModelSelector } from "./chat-model-selector";
import { ChatCommandPopover } from "./chat-command-popover";
import { useChatAutocomplete, type MentionReference } from "@/hooks/use-chat-autocomplete";
import { getToolCatalog } from "@/lib/chat/tool-catalog";
import { useProjectSkills } from "@/hooks/use-project-skills";
import type { ChatModelOption } from "@/lib/chat/types";

interface ChatInputProps {
  onSend: (content: string, mentions?: MentionReference[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  isHeroMode: boolean;
  previewText?: string | null;
  modelId?: string;
  onModelChange?: (modelId: string) => void;
  availableModels?: ChatModelOption[];
  projectId?: string | null;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  isHeroMode,
  previewText,
  modelId,
  onModelChange,
  availableModels,
  projectId,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autocomplete = useChatAutocomplete();
  const { skills: projectSkills } = useProjectSkills(projectId);

  // Sync textarea ref with autocomplete hook
  useEffect(() => {
    autocomplete.setTextareaRef(textareaRef.current);
  }, [autocomplete.setTextareaRef]);

  // Auto-focus on mount and after sending
  useEffect(() => {
    textareaRef.current?.focus();
  }, [isStreaming]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed, autocomplete.mentions.length > 0 ? autocomplete.mentions : undefined);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isStreaming, onSend, autocomplete.mentions]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Let autocomplete handle keys first when popover is open
      if (autocomplete.handleKeyDown(e)) {
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        textareaRef.current?.blur();
      }
    },
    [handleSend, autocomplete.handleKeyDown]
  );

  // Auto-resize textarea
  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      handleInput();
      // Notify autocomplete of text changes (must happen after setValue so selectionStart is current)
      requestAnimationFrame(() => {
        autocomplete.handleChange(newValue, textareaRef.current);
      });
    },
    [handleInput, autocomplete.handleChange]
  );

  const handlePopoverSelect = useCallback(
    (item: {
      type: "slash" | "mention";
      id: string;
      label: string;
      text?: string;
      entityType?: string;
      entityId?: string;
    }) => {
      if (item.type === "slash") {
        const entry = getToolCatalog({ includeBrowser: true }).find((t) => t.name === item.id);
        if (entry?.behavior === "execute_immediately") {
          autocomplete.close();
          if (entry.name === "toggle_theme") {
            const isDark = document.documentElement.classList.contains("dark");
            document.documentElement.classList.toggle("dark");
            localStorage.setItem("stagent-theme", isDark ? "light" : "dark");
          } else if (entry.name === "mark_all_read") {
            fetch("/api/notifications/mark-all-read", { method: "PATCH" });
          }
          setValue("");
          return;
        }
      }

      // For insert_template slash commands and mentions, update textarea value
      const newValue = autocomplete.handleSelect(item);
      if (newValue !== undefined) {
        setValue(newValue);
        handleInput();
        // Refocus textarea
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
        });
      }
    },
    [autocomplete, handleInput]
  );

  // Show preview text in placeholder when hovering a suggestion
  const placeholder = previewText || "Ask anything... (/ for tools, @ for mentions)";

  return (
    <div
      className={cn(
        isHeroMode
          ? "w-full"
          : "sticky bottom-0 bg-background pb-[env(safe-area-inset-bottom)]"
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
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground max-h-[200px] px-4 pt-3",
              isHeroMode ? "min-h-[80px]" : "min-h-[72px]"
            )}
            rows={isHeroMode ? 3 : 3}
            disabled={isStreaming}
          />

          {/* Toolbar row */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <div className="flex items-center gap-1">
              {modelId && onModelChange && (
                <ChatModelSelector
                  modelId={modelId}
                  onModelChange={onModelChange}
                  models={availableModels}
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
            </div>
          </div>
        </div>
      </div>

      {/* Autocomplete popover — rendered via portal */}
      <ChatCommandPopover
        open={autocomplete.state.open}
        mode={autocomplete.state.mode}
        query={autocomplete.state.query}
        anchorRect={autocomplete.state.anchorRect}
        entityResults={autocomplete.entityResults}
        entityLoading={autocomplete.entityLoading}
        projectProfiles={projectSkills.length > 0 ? projectSkills : undefined}
        onSelect={handlePopoverSelect}
        onClose={autocomplete.close}
      />
    </div>
  );
}
