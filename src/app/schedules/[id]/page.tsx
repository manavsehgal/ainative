import { redirect } from "next/navigation";

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/schedules?selected=${id}`);
}
