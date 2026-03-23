import { PageShell } from "@/components/shared/page-shell";
import { BookReader } from "@/components/book/book-reader";

export const dynamic = "force-dynamic";

export default function BookPage() {
  return (
    <PageShell fullBleed>
      <BookReader />
    </PageShell>
  );
}
