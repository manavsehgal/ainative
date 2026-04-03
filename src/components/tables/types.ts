import type { UserTableRow } from "@/lib/db/schema";

export type TableWithRelations = UserTableRow & {
  projectName: string | null;
  columnCount: number;
};
