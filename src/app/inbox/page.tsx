import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { InboxList } from "@/components/notifications/inbox-list";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const rows = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(100);

  // Serialize Date objects for client component consumption
  const initialNotifications = rows.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
    respondedAt: n.respondedAt?.toISOString() ?? null,
  }));

  return (
    <div className="gradient-sunset-glow min-h-screen p-4 sm:p-6">
      <div className="surface-page surface-page-shell mx-auto min-h-[calc(100dvh-2rem)] max-w-6xl rounded-[30px] p-5 sm:p-6 lg:p-7">
        <div className="mb-5 space-y-1">
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Review approvals, questions, failures, and completions without leaving the supervision flow.
          </p>
        </div>
        <InboxList initialNotifications={initialNotifications} />
      </div>
    </div>
  );
}
