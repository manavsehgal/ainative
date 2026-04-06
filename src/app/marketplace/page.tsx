import { PageShell } from "@/components/shared/page-shell";
import { MarketplaceBrowser } from "@/components/marketplace/marketplace-browser";
import { licenseManager } from "@/lib/license/manager";
import { canAccessFeature } from "@/lib/license/features";

export const dynamic = "force-dynamic";

export default function MarketplacePage() {
  // Use getTierFromDb() for Server Components (Turbopack module instance separation)
  const tier = licenseManager.getTierFromDb();
  const canImport = canAccessFeature(tier, "marketplace-import");
  const canPublish = canAccessFeature(tier, "marketplace-publish");

  return (
    <PageShell title="Marketplace" description="Browse and import workflow blueprints">
      <MarketplaceBrowser canImport={canImport} canPublish={canPublish} />
    </PageShell>
  );
}
