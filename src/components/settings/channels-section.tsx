"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Send,
  Plus,
  Trash2,
  Zap,
  MessageSquare,
  Globe,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChannelConfig {
  id: string;
  channelType: "slack" | "telegram" | "webhook";
  name: string;
  config: string;
  status: "active" | "disabled";
  testStatus: "untested" | "ok" | "failed";
  createdAt: string;
  updatedAt: string;
}

const CHANNEL_ICONS: Record<string, typeof Send> = {
  slack: Zap,
  telegram: MessageSquare,
  webhook: Globe,
};

const TEST_STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  ok: CheckCircle2,
  failed: XCircle,
  untested: MinusCircle,
};

const TEST_STATUS_COLORS: Record<string, string> = {
  ok: "text-green-600",
  failed: "text-red-600",
  untested: "text-muted-foreground",
};

export function ChannelsSection() {
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [formType, setFormType] = useState<"slack" | "telegram" | "webhook">("slack");
  const [formName, setFormName] = useState("");
  const [formWebhookUrl, setFormWebhookUrl] = useState("");
  const [formBotToken, setFormBotToken] = useState("");
  const [formChatId, setFormChatId] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formHeaders, setFormHeaders] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/channels");
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const resetForm = () => {
    setFormType("slack");
    setFormName("");
    setFormWebhookUrl("");
    setFormBotToken("");
    setFormChatId("");
    setFormUrl("");
    setFormHeaders("");
  };

  const handleCreate = async () => {
    let config: Record<string, unknown> = {};
    if (formType === "slack") {
      config = { webhookUrl: formWebhookUrl };
    } else if (formType === "telegram") {
      config = { botToken: formBotToken, chatId: formChatId };
    } else {
      let headers: Record<string, string> | undefined;
      if (formHeaders.trim()) {
        try {
          headers = JSON.parse(formHeaders);
        } catch {
          toast.error("Invalid headers JSON");
          return;
        }
      }
      config = { url: formUrl, ...(headers ? { headers } : {}) };
    }

    setSaving(true);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelType: formType,
          name: formName,
          config,
        }),
      });

      if (res.ok) {
        toast.success("Channel created");
        setDialogOpen(false);
        resetForm();
        fetchChannels();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to create channel");
      }
    } catch {
      toast.error("Failed to create channel");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      const res = await fetch(`/api/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Channel ${newStatus === "active" ? "enabled" : "disabled"}`);
        fetchChannels();
      }
    } catch {
      toast.error("Failed to update channel");
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch(`/api/channels/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.testStatus === "ok") {
        toast.success("Connection test passed");
      } else {
        toast.error(`Test failed: ${data.error}`);
      }
      fetchChannels();
    } catch {
      toast.error("Failed to test channel");
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Channel deleted");
        fetchChannels();
      }
    } catch {
      toast.error("Failed to delete channel");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Delivery Channels
            </CardTitle>
            <CardDescription>
              Configure Slack, Telegram, or webhook channels for schedule notifications
              and agent output delivery.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="mr-1 h-4 w-4" />
                Add Channel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Delivery Channel</DialogTitle>
                <DialogDescription>
                  Configure a new channel for delivering notifications and results.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Channel Type</Label>
                  <Select value={formType} onValueChange={(v) => setFormType(v as typeof formType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slack">Slack</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="e.g. Team Notifications"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                {formType === "slack" && (
                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <Input
                      placeholder="https://hooks.slack.com/services/..."
                      value={formWebhookUrl}
                      onChange={(e) => setFormWebhookUrl(e.target.value)}
                    />
                  </div>
                )}

                {formType === "telegram" && (
                  <>
                    <div className="space-y-2">
                      <Label>Bot Token</Label>
                      <Input
                        placeholder="123456:ABC-DEF..."
                        value={formBotToken}
                        onChange={(e) => setFormBotToken(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Chat ID</Label>
                      <Input
                        placeholder="-1001234567890"
                        value={formChatId}
                        onChange={(e) => setFormChatId(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {formType === "webhook" && (
                  <>
                    <div className="space-y-2">
                      <Label>URL</Label>
                      <Input
                        placeholder="https://example.com/webhook"
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Custom Headers (JSON, optional)</Label>
                      <Input
                        placeholder='{"Authorization": "Bearer ..."}'
                        value={formHeaders}
                        onChange={(e) => setFormHeaders(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={saving || !formName.trim()}>
                  {saving ? "Creating..." : "Create Channel"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No delivery channels configured. Add one to start receiving notifications.
          </p>
        ) : (
          <div className="space-y-3">
            {channels.map((ch) => {
              const Icon = CHANNEL_ICONS[ch.channelType] ?? Globe;
              const TestIcon = TEST_STATUS_ICONS[ch.testStatus] ?? MinusCircle;
              const testColor = TEST_STATUS_COLORS[ch.testStatus] ?? "";

              return (
                <div
                  key={ch.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{ch.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {ch.channelType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <TestIcon className={`h-3 w-3 ${testColor}`} />
                        <span className={`text-xs ${testColor}`}>
                          {ch.testStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTest(ch.id)}
                      disabled={testingId === ch.id}
                    >
                      {testingId === ch.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Test"
                      )}
                    </Button>
                    <Switch
                      checked={ch.status === "active"}
                      onCheckedChange={() => handleToggle(ch.id, ch.status)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(ch.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
