import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface PlaybookActionButtonProps {
  href: string;
  children: React.ReactNode;
}

export function PlaybookActionButton({
  href,
  children,
}: PlaybookActionButtonProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 no-underline"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}
