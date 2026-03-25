import { PageShell } from "@/components/shared/page-shell";
import { BookReader } from "@/components/book/book-reader";
import { getBook } from "@/lib/book/content";

export const dynamic = "force-dynamic";

export default function BookPage() {
  const book = getBook();
  return (
    <PageShell fullBleed>
      <BookReader chapters={book.chapters} />
    </PageShell>
  );
}
