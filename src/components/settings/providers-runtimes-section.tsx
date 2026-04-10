"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Network, Zap, DollarSign, Crown, Hand } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AuthMethodSelector } from "./auth-method-selector";
import { ApiKeyForm } from "./api-key-form";
import { AuthStatusBadge } from "./auth-status-badge";
import { ConnectionTestControl } from "./connection-test-control";
import { OpenAIChatGPTAuthControl } from "./openai-chatgpt-auth-control";
import type { AuthMethod, ApiKeySource, RoutingPreference } from "@/lib/constants/settings";
import type { RuntimeSetupState } from "@/lib/settings/runtime-setup";
import type { OpenAIAccountInfo, OpenAIRateLimitInfo } from "@/lib/settings/openai-auth";
import type { OpenAILoginState } from "@/lib/settings/openai-login-manager";

// ── Types ────────────────────────────────────────────────────────────

interface ProviderState {
  configured: boolean;
  authMethod?: AuthMethod;
  hasKey: boolean;
  apiKeySource: ApiKeySource;
  oauthConnected?: boolean;
  account?: OpenAIAccountInfo | null;
  rateLimits?: OpenAIRateLimitInfo | null;
  login?: OpenAILoginState;
  dualBilling: boolean;
  runtimes: RuntimeSetupState[];
}

interface ProvidersPayload {
  providers: {
    anthropic: ProviderState;
    openai: ProviderState;
  };
  routingPreference: RoutingPreference;
  configuredProviderCount: number;
}

// ── Routing preference metadata ──────────────────────────────────────

const ROUTING_OPTIONS: {
  value: RoutingPreference;
  label: string;
  description: string;
  icon: typeof Zap;
}[] = [
  {
    value: "latency",
    label: "Latency",
    description: "Prefer direct API runtimes for faster start and response times.",
    icon: Zap,
  },
  {
    value: "cost",
    label: "Cost",
    description: "Prefer direct API runtimes for lower per-token cost.",
    icon: DollarSign,
  },
  {
    value: "quality",
    label: "Quality",
    description: "Prefer SDK runtimes (Claude Code, Codex) for richer tool use and reliability.",
    icon: Crown,
  },
  {
    value: "manual",
    label: "Manual",
    description: "Always use the default runtime. Override per task in the create panel.",
    icon: Hand,
  },
];

// ── Routing → auth recommendation ───────────────────────────────────

function recommendedAuthForRouting(pref: RoutingPreference): AuthMethod | null {
  if (pref === "latency" || pref === "cost") return "api_key";
  if (pref === "quality") return "oauth";
  return null; // "manual" has no recommendation
}

// ── Provider row ─────────────────────────────────────────────────────

const RUNTIME_DESCRIPTIONS: Record<string, string> = {
  "claude-code": "Full tool suite, MCP, file access",
  "anthropic-direct": "Fast API calls, prompt caching, extended thinking",
  "openai-codex-app-server": "Sandboxed workspace execution",
  "openai-direct": "Fast API calls, code interpreter, web search",
  ollama: "Local model execution, free, no API key",
};

const BILLING_LABELS: Record<string, string> = {
  subscription: "Subscription",
  usage: "Pay-as-you-go",
};

function ProviderRow({
  name,
  oauthLabel,
  provider,
  defaultOpen,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  name: string;
  oauthLabel?: string;
  provider: ProviderState;
  defaultOpen: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const toggle = () => {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const activeRuntimes = provider.runtimes.filter((r) => r.configured);
  const activeCount = activeRuntimes.length;
  const activeLabels = activeRuntimes.map((r) => r.label).join(", ");
  const openAIOAuthPending = provider.authMethod === "oauth" && provider.oauthConnected === false;
  const openAILoginPending = provider.login?.phase === "pending";

  let statusLine: string;
  if (!provider.configured) {
    statusLine =
      provider.authMethod === "oauth"
        ? "Sign in with ChatGPT to enable Codex App Server"
        : "Add an API key to enable runtimes";
  } else if (openAIOAuthPending && activeCount > 0) {
    statusLine = openAILoginPending
      ? `Waiting for ${oauthLabel ?? "OAuth"} sign-in. ${activeLabels} remains active.`
      : `Codex App Server needs ${oauthLabel ?? "OAuth"} sign-in. ${activeLabels} remains active.`;
  } else if (activeCount === 2) {
    statusLine = `2 runtimes active: ${activeLabels}`;
  } else if (activeCount === 1) {
    statusLine = `1 runtime active: ${activeLabels}`;
  } else {
    statusLine = "Connected";
  }

  return (
    <div className="surface-panel rounded-2xl border border-border/60">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-accent/30 transition-colors rounded-2xl"
      >
        <div
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            provider.configured
              ? "bg-success"
              : "border-2 border-muted-foreground/40"
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{name}</span>
            <AuthStatusBadge
              connected={provider.configured}
              apiKeySource={provider.apiKeySource}
              authMethod={provider.authMethod}
              oauthLabel={oauthLabel}
              oauthConnected={provider.oauthConnected}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{statusLine}</p>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <Separator />
          {children}

          {/* Dual-billing note for Anthropic OAuth + API key */}
          {provider.dualBilling && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Two billing modes active.</span>{" "}
                {name === "Anthropic"
                  ? "Claude Code uses your Max/Pro subscription. Anthropic Direct API uses pay-as-you-go API billing."
                  : "Codex App Server uses your ChatGPT plan. OpenAI Direct uses pay-as-you-go API billing."}{" "}
                Budget guardrails track each separately.
              </p>
            </div>
          )}

          {/* Runtimes enabled */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Runtimes
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {provider.runtimes.map((runtime) => {
                const isActive = runtime.configured;
                const inactiveDescription = runtime.runtimeId.includes("direct")
                  ? "Requires API key"
                  : runtime.runtimeId === "openai-codex-app-server" &&
                      provider.authMethod === "oauth"
                    ? provider.login?.phase === "pending"
                      ? "Waiting for ChatGPT sign-in"
                      : "Sign in with ChatGPT"
                    : "Requires CLI or API key";
                return (
                  <div
                    key={runtime.runtimeId}
                    className={`rounded-xl border px-3 py-2 ${
                      isActive
                        ? "border-border/60 bg-background/40"
                        : "border-border/30 bg-muted/20 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{runtime.label}</p>
                      {isActive && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {BILLING_LABELS[runtime.billingMode] ?? runtime.billingMode}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isActive
                        ? (RUNTIME_DESCRIPTIONS[runtime.runtimeId] ?? "Active")
                        : inactiveDescription}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main section ─────────────────────────────────────────────────────

export function ProvidersAndRuntimesSection() {
  const [data, setData] = useState<ProvidersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [anthropicOpen, setAnthropicOpen] = useState(false);
  const [openAILoginState, setOpenAILoginState] = useState<OpenAILoginState | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/providers");
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync initial open state when data loads
  useEffect(() => {
    if (data) {
      const none = data.configuredProviderCount === 0;
      if (none || !data.providers.anthropic.configured) {
        setAnthropicOpen(true);
      }
      setOpenAILoginState(data.providers.openai.login ?? null);
    }
  }, [data?.configuredProviderCount, data?.providers.anthropic.configured]);

  // ── Anthropic auth handlers ──────────────────────────────────────

  async function handleAnthropicMethodChange(method: AuthMethod) {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    if (res.ok) fetchData();
  }

  async function handleAnthropicSaveKey(apiKey: string) {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "api_key", apiKey }),
    });
    if (res.ok) fetchData();
  }

  async function handleAnthropicTest() {
    const res = await fetch("/api/settings/test", { method: "POST" });
    const result = await res.json();
    fetchData();
    return result;
  }

  // ── OpenAI auth handlers ─────────────────────────────────────────

  async function handleOpenAISaveKey(apiKey: string) {
    const res = await fetch("/api/settings/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "api_key", apiKey }),
    });
    if (res.ok) fetchData();
  }

  async function handleOpenAIMethodChange(method: AuthMethod) {
    const res = await fetch("/api/settings/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    if (res.ok) fetchData();
  }

  async function handleOpenAITest() {
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runtime: "openai-codex-app-server" }),
    });
    const result = await res.json();
    fetchData();
    return result;
  }

  async function handleOpenAIDirectTest() {
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runtime: "openai-direct" }),
    });
    const result = await res.json();
    fetchData();
    return result;
  }

  // ── Routing preference handler ───────────────────────────────────

  async function handleRoutingChange(value: RoutingPreference) {
    const res = await fetch("/api/settings/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preference: value }),
    });
    if (res.ok) {
      setData((prev) => (prev ? { ...prev, routingPreference: value } : prev));
      toast.success(`Routing preference set to ${value}`);

      // Reactive: switch Anthropic auth method and expand the row
      const rec = recommendedAuthForRouting(value);
      if (rec) {
        setAnthropicOpen(true);
        const current = data?.providers.anthropic.authMethod ?? "api_key";
        if (current !== rec) {
          handleAnthropicMethodChange(rec);
        }
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  if (loading || !data) {
    return (
      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Providers &amp; Runtimes
          </CardTitle>
          <CardDescription>Loading provider configuration...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { providers, routingPreference, configuredProviderCount } = data;
  const openAIProvider: ProviderState = {
    ...providers.openai,
    login: openAILoginState ?? providers.openai.login,
  };
  const noneConfigured = configuredProviderCount === 0;
  const recommendedAuth = recommendedAuthForRouting(routingPreference);

  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Providers &amp; Runtimes
        </CardTitle>
        <CardDescription>
          {noneConfigured
            ? "Get started by connecting at least one AI provider."
            : `${configuredProviderCount} provider${configuredProviderCount > 1 ? "s" : ""} connected — ${
                Object.values(providers)
                  .flatMap((p) => p.runtimes)
                  .filter((r) => r.configured).length
              } runtimes available`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Task routing — always visible */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Task routing
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              How should Stagent choose a runtime when creating tasks?
            </p>
          </div>

          <RadioGroup
            value={routingPreference}
            onValueChange={(v) => handleRoutingChange(v as RoutingPreference)}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {ROUTING_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = routingPreference === option.value;
              return (
                <Label
                  key={option.value}
                  htmlFor={`routing-${option.value}`}
                  className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all hover:bg-accent/30 ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border/40"
                  }`}
                >
                  <RadioGroupItem
                    value={option.value}
                    id={`routing-${option.value}`}
                    className="sr-only"
                  />
                  <Icon
                    className={`h-4 w-4 ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      isSelected ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {option.label}
                  </span>
                </Label>
              );
            })}
          </RadioGroup>

          <p className="text-xs text-muted-foreground">
            {ROUTING_OPTIONS.find((o) => o.value === routingPreference)?.description}
          </p>

          {recommendedAuth && (
            <p className="text-xs text-primary/70">
              {recommendedAuth === "api_key"
                ? "This preference works best with an API key configured below."
                : "This preference works well with subscription-backed auth configured below."}
            </p>
          )}
        </div>

        <Separator />

        {/* Anthropic provider — controlled open state */}
        <ProviderRow
          name="Anthropic"
          oauthLabel="Claude Max/Pro"
          provider={providers.anthropic}
          defaultOpen={false}
          open={anthropicOpen}
          onOpenChange={setAnthropicOpen}
        >
          <AuthMethodSelector
            value={providers.anthropic.authMethod ?? "api_key"}
            onChange={handleAnthropicMethodChange}
            recommendedMethod={recommendedAuth}
          />

          {(providers.anthropic.authMethod ?? "api_key") === "api_key" && (
            <ApiKeyForm
              hasKey={providers.anthropic.hasKey}
              onSave={handleAnthropicSaveKey}
              onTest={handleAnthropicTest}
            />
          )}

          {(providers.anthropic.authMethod ?? "api_key") === "oauth" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                OAuth mode uses the Claude Agent SDK&apos;s built-in authentication.
                Requires an active Claude Max or Pro subscription.
              </p>
              <ConnectionTestControl onTest={handleAnthropicTest} />
            </div>
          )}

          {providers.anthropic.apiKeySource === "env" && (
            <p className="text-xs text-muted-foreground">
              Currently using API key from environment variable (ANTHROPIC_API_KEY).
            </p>
          )}
        </ProviderRow>

        {/* OpenAI provider — uncontrolled */}
        <ProviderRow
          name="OpenAI"
          oauthLabel="ChatGPT"
          provider={openAIProvider}
          defaultOpen={
            noneConfigured ||
            !openAIProvider.configured ||
            ((openAIProvider.authMethod ?? "api_key") === "oauth" &&
              !(openAIProvider.oauthConnected ?? false))
          }
        >
          <AuthMethodSelector
            value={openAIProvider.authMethod ?? "api_key"}
            onChange={handleOpenAIMethodChange}
            recommendedMethod={recommendedAuth}
            label="Codex App Server Authentication"
            options={[
              {
                id: "api_key",
                icon: Zap,
                title: "API Key",
                description: "Use an OpenAI API key for Codex App Server",
              },
              {
                id: "oauth",
                icon: Crown,
                title: "ChatGPT",
                description: "Use your ChatGPT plan with browser sign-in",
              },
            ]}
          />

          {(openAIProvider.authMethod ?? "api_key") === "oauth" ? (
            <OpenAIChatGPTAuthControl
              connected={openAIProvider.oauthConnected ?? false}
              account={openAIProvider.account ?? null}
              rateLimits={openAIProvider.rateLimits ?? null}
              initialLoginState={
                openAIProvider.login ?? {
                  phase: "idle",
                  loginId: null,
                  authUrl: null,
                  account: null,
                  rateLimits: null,
                  error: null,
                  startedAt: null,
                  updatedAt: new Date().toISOString(),
                }
              }
              onChanged={fetchData}
              onLoginStateChange={setOpenAILoginState}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              API key mode authenticates Codex App Server directly and also powers OpenAI Direct.
            </p>
          )}

          <Separator />

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">OpenAI Direct API Key</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Used by the OpenAI Direct runtime. If Codex App Server is in API key mode, it shares this key.
              </p>
            </div>
            <ApiKeyForm
              hasKey={providers.openai.hasKey}
              onSave={handleOpenAISaveKey}
              onTest={handleOpenAIDirectTest}
              keyPrefix="sk-"
              placeholder="sk-..."
              maskedPrefix="sk-••••••"
              envVarName="OPENAI_API_KEY"
              testButtonLabel="Test OpenAI Direct"
            />
          </div>
        </ProviderRow>
      </CardContent>
    </Card>
  );
}
