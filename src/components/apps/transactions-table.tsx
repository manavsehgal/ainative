import { formatKpi, type KpiFormat } from "@/lib/apps/view-kits/format-kpi";

export interface TransactionRow {
  id: string;
  date: string;
  label: string;
  amount: number;
  category?: string;
}

interface TransactionsTableProps {
  rows: TransactionRow[];
  format?: KpiFormat;
}

export function TransactionsTable({ rows, format = "currency" }: TransactionsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-lg">
        No transactions yet
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted-foreground border-b">
        <tr>
          <th className="text-left py-2 px-3">Date</th>
          <th className="text-left py-2 px-3">Description</th>
          <th className="text-left py-2 px-3">Category</th>
          <th className="text-right py-2 px-3">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b last:border-0">
            <td className="py-2 px-3 text-muted-foreground">{r.date}</td>
            <td className="py-2 px-3">{r.label}</td>
            <td className="py-2 px-3 text-muted-foreground">{r.category ?? "—"}</td>
            <td
              className={`py-2 px-3 text-right font-mono tabular-nums ${
                r.amount < 0 ? "text-destructive" : ""
              }`}
              data-amount-sign={r.amount < 0 ? "negative" : "positive"}
            >
              {formatKpi(Math.abs(r.amount), format)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
