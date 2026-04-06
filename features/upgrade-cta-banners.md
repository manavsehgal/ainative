---
title: Upgrade CTA Banners
status: planned
priority: P1
layer: PLG Core
dependencies:
  - local-license-manager
  - community-edition-soft-limits
  - subscription-management-ui
---

# Upgrade CTA Banners

## Description

Contextual upgrade prompts that appear at the exact moment a Community user hits a tier limit — not before (annoying), not after (confusing). Each banner is tied to a specific friction point: approaching the memory cap, hitting the schedule limit, seeing truncated history, or reaching maximum memories. The banners are informative rather than aggressive, follow the existing alert pattern from budget-guardrails (surface-card-muted, warning borders), and can be dismissed or snoozed for 7 days.

Three banner components handle all upgrade touchpoints: `UpgradeBanner` (inline contextual alerts), `ScheduleGateDialog` (modal intercept on schedule creation), and a persistent sonner toast for hard-blocked states. All link to `/settings/subscription?highlight={tier}` so the subscription page can auto-scroll to the recommended plan.

## User Story

As a Community tier user approaching my limits, I want clear, non-intrusive prompts that explain what I've reached and what upgrading unlocks — so I can make an informed decision at the natural moment of friction rather than being surprised by a hard block.

## Technical Approach

### Reusable UpgradeBanner Component

File: `src/components/shared/upgrade-banner.tsx`

```tsx
interface UpgradeBannerProps {
  limitType: 'memory_cap' | 'context_versions' | 'schedule_cap' | 'history_retention';
  current: number;
  max: number;
  requiredTier: string;
  variant: 'warning' | 'blocked';
  onDismiss?: () => void;
  onSnooze?: () => void;
}

export function UpgradeBanner({
  limitType, current, max, requiredTier, variant, onDismiss, onSnooze
}: UpgradeBannerProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'surface-card-muted rounded-2xl border p-4 flex items-start gap-3',
        variant === 'warning' && 'border-status-warning/25',
        variant === 'blocked' && 'border-status-error/25',
      )}
    >
      <AlertTriangle className={cn(
        'size-5 shrink-0 mt-0.5',
        variant === 'warning' ? 'text-status-warning' : 'text-status-error'
      )} />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{BANNER_TITLES[limitType]}</p>
        <p className="text-sm text-muted-foreground">
          {BANNER_MESSAGES[limitType]({ current, max, requiredTier })}
        </p>
        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" asChild>
            <Link href={`/settings/subscription?highlight=${requiredTier}`}>
              Upgrade to {requiredTier}
            </Link>
          </Button>
          {onSnooze && (
            <Button size="sm" variant="ghost" onClick={onSnooze}>
              Remind me later
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

Styling follows the budget-guardrails alert pattern: `surface-card-muted rounded-2xl border border-status-warning/25` for warnings, `border-status-error/25` for hard blocks.

### Banner Placement Points

#### 1. Memory Cap Banner

Location: Profile detail view, above the memory browser section.

- **Warning state** (45-49/50): "You're approaching the memory limit for this profile. Memories beyond 50 won't be saved."
- **Blocked state** (50/50): "Memory storage is full. New memories are being discarded. Upgrade to Operator for 500 memories per profile."

```tsx
// In profile detail component
const { data: memoryCount } = useMemoryCount(profileId);
const limit = useTierLimit('memoriesPerProfile');

{memoryCount >= limit * 0.9 && (
  <UpgradeBanner
    limitType="memory_cap"
    current={memoryCount}
    max={limit}
    requiredTier="operator"
    variant={memoryCount >= limit ? 'blocked' : 'warning'}
    onSnooze={() => snooze('memory_cap')}
  />
)}
```

#### 2. Schedule Limit Gate Dialog

Location: Intercepts the "Create Schedule" action when at limit.

File: `src/components/schedules/schedule-gate-dialog.tsx`

```tsx
export function ScheduleGateDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule limit reached</DialogTitle>
          <DialogDescription>
            Community tier supports up to 5 active schedules. Upgrade to
            Operator for 50 schedules, or deactivate an existing schedule.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Manage schedules
          </Button>
          <Button asChild>
            <Link href="/settings/subscription?highlight=operator">
              Upgrade
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Integration point: In the schedule creation flow, before opening the create dialog, check the limit:

```tsx
function handleCreateSchedule() {
  if (activeCount >= tierLimit) {
    setGateDialogOpen(true);
    return;
  }
  setCreateDialogOpen(true);
}
```

#### 3. History Retention Banner

Location: `/costs` page (Cost & Usage), above the execution history table.

```tsx
{tier === 'community' && (
  <UpgradeBanner
    limitType="history_retention"
    current={30}
    max={30}
    requiredTier="operator"
    variant="warning"
    onDismiss={() => dismiss('history_retention')}
  />
)}
```

Message: "Execution history older than 30 days is automatically cleaned up on the Community tier. Upgrade to Operator for 1-year retention."

#### 4. Persistent Toast at Hard Block

When memory hits 50/50, a persistent sonner toast appears and remains until dismissed:

```tsx
// In memory extraction result handler
if (extractionResult.blocked && extractionResult.reason === 'memory_cap') {
  toast.warning('Agent memories are full', {
    description: 'New memories are being discarded. Upgrade for more capacity.',
    action: {
      label: 'Upgrade',
      onClick: () => router.push('/settings/subscription?highlight=operator'),
    },
    duration: Infinity, // Persistent until dismissed
  });
}
```

### Snooze Mechanism

File: `src/hooks/use-snoozed-banners.ts`

```tsx
const SNOOZE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function useSnoozedBanners() {
  const [snoozed, setSnoozed] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem('stagent:snoozed-banners');
    return stored ? JSON.parse(stored) : {};
  });

  function snooze(limitType: string) {
    const updated = { ...snoozed, [limitType]: Date.now() + SNOOZE_DURATION };
    setSnoozed(updated);
    localStorage.setItem('stagent:snoozed-banners', JSON.stringify(updated));
  }

  function isSnoozed(limitType: string): boolean {
    const expiry = snoozed[limitType];
    if (!expiry) return false;
    if (Date.now() > expiry) {
      // Expired snooze — clean up
      const { [limitType]: _, ...rest } = snoozed;
      setSnoozed(rest);
      localStorage.setItem('stagent:snoozed-banners', JSON.stringify(rest));
      return false;
    }
    return true;
  }

  function dismiss(limitType: string) {
    // Dismiss = snooze forever (effectively)
    snooze(limitType);
  }

  return { snooze, isSnoozed, dismiss };
}
```

Banners check `isSnoozed()` before rendering. Snoozed banners auto-expire after 7 days and reappear.

### Banner Content Map

```ts
const BANNER_TITLES: Record<string, string> = {
  memory_cap: 'Memory limit approaching',
  context_versions: 'Context version limit approaching',
  schedule_cap: 'Schedule limit reached',
  history_retention: 'Limited execution history',
};

const BANNER_MESSAGES: Record<string, (ctx: BannerContext) => string> = {
  memory_cap: ({ current, max }) =>
    `${current}/${max} agent memories used. New memories won't be saved once full.`,
  context_versions: ({ current, max }) =>
    `${current}/${max} learned context versions used. Self-improvement proposals will be blocked once full.`,
  schedule_cap: ({ current, max }) =>
    `${current}/${max} active schedules. Deactivate one or upgrade for more.`,
  history_retention: () =>
    `Execution history older than 30 days is automatically removed on the Community tier.`,
};
```

### Subscription Page Highlight

When navigating to `/settings/subscription?highlight=operator`, the subscription page reads the query param and:

1. Auto-scrolls to the tier comparison grid
2. Applies a pulse animation to the recommended tier card: `animate-pulse-once ring-2 ring-primary`
3. Clears the param after 3 seconds via `router.replace()`

### Accessibility

All banners use:
- `role="alert"` for screen reader announcement
- `aria-live="polite"` (warnings) or `aria-live="assertive"` (blocked states)
- Focus management: gate dialog traps focus per shadcn Dialog defaults
- Keyboard: all actions (upgrade, snooze, dismiss) are focusable buttons
- Contrast: warning and error colors meet WCAG AA against surface-card-muted background

## Acceptance Criteria

- [ ] `UpgradeBanner` component renders warning and blocked variants with correct styling
- [ ] Memory cap banner appears at 90% (45/50) in warning state and 100% (50/50) in blocked state
- [ ] `ScheduleGateDialog` intercepts schedule creation when at limit
- [ ] History retention banner appears on `/costs` page for Community users
- [ ] Persistent sonner toast fires at 50/50 memory hard block with upgrade action
- [ ] `useSnoozedBanners` hook stores snooze state in localStorage with 7-day expiry
- [ ] Snoozed banners do not render; expired snoozes auto-clear and banner reappears
- [ ] Dismiss action snoozes indefinitely (does not reappear)
- [ ] All upgrade links point to `/settings/subscription?highlight={tier}`
- [ ] Subscription page reads `?highlight` param, scrolls to tier grid, pulses recommended card
- [ ] All banners use `role="alert"` and `aria-live` for accessibility
- [ ] Gate dialog traps focus and is keyboard-navigable
- [ ] Banner styling matches budget-guardrails pattern (surface-card-muted, rounded-2xl, status borders)

## Scope Boundaries

**Included:**
- `UpgradeBanner` reusable component with warning/blocked variants
- `ScheduleGateDialog` modal for schedule limit interception
- `useSnoozedBanners` hook with localStorage persistence and 7-day expiry
- Four placement points (memory, schedule, history, persistent toast)
- Subscription page `?highlight` param handling with scroll + pulse
- Accessibility: role, aria-live, focus management

**Excluded:**
- Email upgrade prompts — out of scope for local-first architecture
- A/B testing of banner copy — future optimization
- Banner analytics (impression tracking, click-through rates) — future
- Custom banner placement API (for third-party integrations) — not needed
- Animated transitions for banner appearance — keep simple for now
- In-app notification center banners — `tier_limit` notifications already exist in inbox

## References

- Depends on: `features/local-license-manager.md` — `isFeatureAllowed()`, tier detection
- Depends on: `features/community-edition-soft-limits.md` — defines the limit values and enforcement points
- Depends on: `features/subscription-management-ui.md` — upgrade destination page
- Related: `features/budget-guardrails.md` — alert pattern (surface-card-muted, warning borders)
- Design system: `design-system/MASTER.md` — surface-card-muted, status colors, rounded-2xl
- Sonner toast: existing toast infrastructure in app layout
- shadcn Dialog: existing Dialog component for gate dialog
- Schedule creation: `src/components/schedules/` — schedule form integration point
- Cost page: `src/app/costs/` — history retention banner placement
