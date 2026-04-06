import { PageShell } from "@/components/shared/page-shell";
import { MarketplaceBrowser } from "@/components/marketplace/marketplace-browser";
import { licenseManager } from "@/lib/license/manager";

export const dynamic = "force-dynamic";

export default function MarketplacePage() {
  const canImport = licenseManager.isFeatureAllowed("marketplace-import");
  const canPublish = licenseManager.isFeatureAllowed("marketplace-publish");

  return (
    <PageShell title="Marketplace" description="Browse and import workflow blueprints">
      <MarketplaceBrowser canImport={canImport} canPublish={canPublish} />
    </PageShell>
  );
}
