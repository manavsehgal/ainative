import { Bot, Workflow, Table2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AppManifest } from "@/lib/apps/registry";

interface ManifestPaneBodyProps {
  manifest: AppManifest;
  files: string[];
  manifestYaml?: string;
}

/**
 * The body of the "View manifest" sheet. Renders the four composition cards
 * (profiles / blueprints / tables / schedules) plus the file list and the raw
 * manifest YAML. This is the content that lived directly on `/apps/[id]`
 * before Phase 1.1; it now lives behind the manifest sheet.
 */
export function ManifestPaneBody({
  manifest,
  files,
  manifestYaml,
}: ManifestPaneBodyProps) {
  return (
    <div className="space-y-6">
      <Section title="Composition">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {manifest.profiles.length > 0 && (
            <ArtifactList
              heading="Profiles"
              icon={Bot}
              items={manifest.profiles.map((p) => p.id)}
            />
          )}
          {manifest.blueprints.length > 0 && (
            <ArtifactList
              heading="Blueprints"
              icon={Workflow}
              items={manifest.blueprints.map((b) => b.id)}
            />
          )}
          {manifest.tables.length > 0 && (
            <ArtifactList
              heading="Tables"
              icon={Table2}
              items={manifest.tables.map((t) => t.id)}
            />
          )}
          {manifest.schedules.length > 0 && (
            <ArtifactList
              heading="Schedules"
              icon={Clock}
              items={manifest.schedules.map((s) =>
                s.cron ? `${s.id} (${s.cron})` : s.id
              )}
            />
          )}
        </div>
      </Section>

      {files.length > 0 && (
        <Section title="Files">
          <Card>
            <CardContent className="p-4">
              <ul className="space-y-1 text-xs font-mono text-muted-foreground">
                {files.map((f) => (
                  <li key={f} className="truncate" title={f}>
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted-foreground/60">
                Informational — these files are written under your control. No
                approval required.
              </p>
            </CardContent>
          </Card>
        </Section>
      )}

      {manifestYaml && (
        <Section title="Manifest YAML">
          <Card>
            <CardContent className="p-4">
              <pre className="text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                {manifestYaml}
              </pre>
            </CardContent>
          </Card>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function ArtifactList({
  heading,
  icon: Icon,
  items,
}: {
  heading: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {heading} ({items.length})
        </div>
        <ul className="space-y-1 text-sm">
          {items.map((x) => (
            <li key={x} className="font-mono text-xs truncate" title={x}>
              {x}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
