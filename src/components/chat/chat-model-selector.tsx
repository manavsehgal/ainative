"use client";

import { CHAT_MODELS, type ChatModelOption } from "@/lib/chat/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatModelSelectorProps {
  modelId: string;
  onModelChange: (modelId: string) => void;
  models?: ChatModelOption[];
}

const tierEmoji: Record<string, string> = {
  Fast: "\u26A1",
  Balanced: "\u2728",
  Best: "\uD83D\uDC8E",
};

export function ChatModelSelector({
  modelId,
  onModelChange,
  models = CHAT_MODELS,
}: ChatModelSelectorProps) {
  const current = models.find((m) => m.id === modelId) ?? models[0];

  const anthropicModels = models.filter(
    (m) => m.provider === "anthropic"
  );
  const openaiModels = models.filter((m) => m.provider === "openai");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {current.label}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Anthropic
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {anthropicModels.map((m) => (
            <ModelMenuItem
              key={m.id}
              model={m}
              isSelected={m.id === modelId}
              onSelect={onModelChange}
            />
          ))}
        </DropdownMenuGroup>

        {openaiModels.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              OpenAI
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {openaiModels.map((m) => (
                <ModelMenuItem
                  key={m.id}
                  model={m}
                  isSelected={m.id === modelId}
                  onSelect={onModelChange}
                />
              ))}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModelMenuItem({
  model,
  isSelected,
  onSelect,
}: {
  model: ChatModelOption;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <DropdownMenuItem
      className="flex items-center justify-between cursor-pointer"
      onClick={() => onSelect(model.id)}
    >
      <span className="flex items-center gap-2">
        <span className={cn("text-sm", isSelected && "font-medium")}>
          {tierEmoji[model.tier] ?? ""} {model.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {model.costLabel}
        </span>
      </span>
      {isSelected && <Check className="h-3.5 w-3.5" />}
    </DropdownMenuItem>
  );
}
