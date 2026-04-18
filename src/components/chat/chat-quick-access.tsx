"use client";

import Link from "next/link";
import type { QuickAccessItem } from "@/lib/chat/types";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  CheckSquare,
  GitBranch,
  FileText,
  Clock,
  LayoutDashboard,
} from "lucide-react";

const ENTITY_ICONS: Record<QuickAccessItem["entityType"], React.ElementType> = {
  project: FolderKanban,
  task: CheckSquare,
  workflow: GitBranch,
  document: FileText,
  schedule: Clock,
};

interface ChatQuickAccessProps {
  items: QuickAccessItem[];
}

export function ChatQuickAccess({ items }: ChatQuickAccessProps) {
  if (items.length === 0) return null;

  return (
    <div className="border-t border-border mt-3 pt-3 flex flex-wrap gap-2">
      {items.map((item) => {
        // Use LayoutDashboard icon for the Tasks kanban link
        const Icon =
          item.href === "/tasks"
            ? LayoutDashboard
            : ENTITY_ICONS[item.entityType] ?? CheckSquare;

        return (
          <Button
            key={item.entityId}
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            asChild
          >
            <Link href={item.href}>
              <Icon className="h-3 w-3" />
              {item.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
