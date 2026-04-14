"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chat shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <Row k="/" v="Open actions / skills / tools menu" />
          <Row k="@" v="Reference a project, task, document, or file" />
          <Row k="⌘K" v="Open global command palette" />
          <Row k="⌘/" v="Focus chat input and open slash menu" />
          <Row k="⌘L" v="Clear conversation (new session)" />
          <Row k="⌘⇧L" v="Clear conversation (browser fallback)" />
          <Row k="⌘⏎" v="Send message" />
          <Row k="↑ ↓" v="Navigate popover items" />
          <Row k="Esc" v="Close popover" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start gap-3">
      <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
      <span className="text-muted-foreground">{v}</span>
    </div>
  );
}
