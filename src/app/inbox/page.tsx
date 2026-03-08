import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { InboxList } from "@/components/notifications/inbox-list";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const initialNotifications = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(100);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Inbox</h1>
      <InboxList initialNotifications={initialNotifications as any} />
    </div>
  );
}
