"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LogFiltersProps {
  taskId: string;
  eventType: string;
  tasks: { id: string; title: string }[];
  onTaskChange: (value: string) => void;
  onEventTypeChange: (value: string) => void;
}

export function LogFilters({
  taskId,
  eventType,
  tasks,
  onTaskChange,
  onEventTypeChange,
}: LogFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <Select value={taskId} onValueChange={onTaskChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All Tasks" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tasks</SelectItem>
          {tasks.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={eventType} onValueChange={onEventTypeChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Events" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Events</SelectItem>
          <SelectItem value="tool_start">Tool Start</SelectItem>
          <SelectItem value="content_block_start">Content Start</SelectItem>
          <SelectItem value="content_block_delta">Content Delta</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="error">Error</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
