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
    <div className="gradient-sunset-glow min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-6">Inbox</h1>
      <InboxList initialNotifications={initialNotifications} />
    </div>
  );
}
