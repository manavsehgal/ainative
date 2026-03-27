import { AuthConfigSection } from "@/components/settings/auth-config-section";
import { OpenAIRuntimeSection } from "@/components/settings/openai-runtime-section";
import { PermissionsSections } from "@/components/settings/permissions-sections";
import { DataManagementSection } from "@/components/settings/data-management-section";
import { BudgetGuardrailsSection } from "@/components/settings/budget-guardrails-section";
import { ChatSettingsSection } from "@/components/settings/chat-settings-section";
import { RuntimeTimeoutSection } from "@/components/settings/runtime-timeout-section";
import { BrowserToolsSection } from "@/components/settings/browser-tools-section";
import { PageShell } from "@/components/shared/page-shell";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <PageShell title="Settings" description="Manage your Stagent configuration">
      <div className="space-y-6">
        <AuthConfigSection />
        <OpenAIRuntimeSection />
        <ChatSettingsSection />
        <RuntimeTimeoutSection />
        <BrowserToolsSection />
        <BudgetGuardrailsSection />
        <PermissionsSections />
        <DataManagementSection />
      </div>
    </PageShell>
  );
}
