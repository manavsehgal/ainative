"use client";

import { useEffect, useState, useCallback } from "react";
import { Globe, Chrome, Theater, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSectionCard } from "@/components/shared/form-section-card";

interface BrowserToolsState {
  chromeDevtoolsEnabled: boolean;
  playwrightEnabled: boolean;
  chromeDevtoolsConfig: string;
  playwrightConfig: string;
}

const DEFAULT_STATE: BrowserToolsState = {
  chromeDevtoolsEnabled: false,
  playwrightEnabled: false,
  chromeDevtoolsConfig: "",
  playwrightConfig: "",
};

export function BrowserToolsSection() {
  const [state, setState] = useState<BrowserToolsState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [chromeExpanded, setChromeExpanded] = useState(false);
  const [playwrightExpanded, setPlaywrightExpanded] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/browser-tools");
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch {
      // Use defaults
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = async (
    field: "chromeDevtoolsEnabled" | "playwrightEnabled",
    value: boolean
  ) => {
    setState((prev) => ({ ...prev, [field]: value }));
    setSaving(true);
    try {
      const res = await fetch("/api/settings/browser-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data);
        const label =
          field === "chromeDevtoolsEnabled"
            ? "Chrome DevTools MCP"
            : "Playwright MCP";
        toast.success(`${label} ${value ? "enabled" : "disabled"}`);
      }
    } catch {
      toast.error("Failed to save setting");
      setState((prev) => ({ ...prev, [field]: !value }));
    } finally {
      setSaving(false);
    }
  };

  const handleConfigSave = async (
    field: "chromeDevtoolsConfig" | "playwrightConfig",
    value: string
  ) => {
    setSaving(true);
    try {
      await fetch("/api/settings/browser-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      toast.success("Configuration saved");
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Browser Tools
        </CardTitle>
        <CardDescription>
          Enable browser automation MCP servers for chat and task agents.
          Read-only tools (screenshots, snapshots) are auto-approved. Mutation
          tools (click, navigate, type) require permission.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chrome DevTools MCP */}
        <FormSectionCard
          icon={Chrome}
          title="Chrome DevTools MCP"
          hint="Connect to a running Chrome instance via CDP. Best for debugging live apps, performance profiling, and network inspection."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="chrome-devtools-toggle" className="text-sm">
                {state.chromeDevtoolsEnabled ? "Enabled" : "Disabled"}
              </Label>
              <Switch
                id="chrome-devtools-toggle"
                checked={state.chromeDevtoolsEnabled}
                disabled={saving}
                onCheckedChange={(v) =>
                  handleToggle("chromeDevtoolsEnabled", v)
                }
              />
            </div>

            {state.chromeDevtoolsEnabled && (
              <>
                <button
                  type="button"
                  onClick={() => setChromeExpanded((e) => !e)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${chromeExpanded ? "rotate-0" : "-rotate-90"}`}
                  />
                  Advanced configuration
                </button>
                {chromeExpanded && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="chrome-config"
                      className="text-xs text-muted-foreground"
                    >
                      Extra CLI arguments (e.g.{" "}
                      <code className="text-[11px]">
                        --headless --browser-url http://localhost:9222
                      </code>
                      )
                    </Label>
                    <Input
                      id="chrome-config"
                      placeholder="--headless"
                      value={state.chromeDevtoolsConfig}
                      disabled={saving}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          chromeDevtoolsConfig: e.target.value,
                        }))
                      }
                      onBlur={(e) =>
                        handleConfigSave("chromeDevtoolsConfig", e.target.value)
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </FormSectionCard>

        {/* Playwright MCP */}
        <FormSectionCard
          icon={Theater}
          title="Playwright MCP"
          hint="Launch a headless browser for autonomous tasks. Best for research, scraping, testing, and structured page analysis."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="playwright-toggle" className="text-sm">
                {state.playwrightEnabled ? "Enabled" : "Disabled"}
              </Label>
              <Switch
                id="playwright-toggle"
                checked={state.playwrightEnabled}
                disabled={saving}
                onCheckedChange={(v) => handleToggle("playwrightEnabled", v)}
              />
            </div>

            {state.playwrightEnabled && (
              <>
                <button
                  type="button"
                  onClick={() => setPlaywrightExpanded((e) => !e)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${playwrightExpanded ? "rotate-0" : "-rotate-90"}`}
                  />
                  Advanced configuration
                </button>
                {playwrightExpanded && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="playwright-config"
                      className="text-xs text-muted-foreground"
                    >
                      Extra CLI arguments (e.g.{" "}
                      <code className="text-[11px]">--browser firefox</code>)
                    </Label>
                    <Input
                      id="playwright-config"
                      placeholder="--browser chromium"
                      value={state.playwrightConfig}
                      disabled={saving}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          playwrightConfig: e.target.value,
                        }))
                      }
                      onBlur={(e) =>
                        handleConfigSave("playwrightConfig", e.target.value)
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </FormSectionCard>
      </CardContent>
    </Card>
  );
}
