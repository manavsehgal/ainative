---
title: Tables Agent Charts
status: completed
priority: P2
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-agent-integration, tables-chat-queries]
---

# Tables Agent Charts

## Description

Enable agents to generate chart visualizations from table data, and allow users to create charts manually via a chart builder. Extends existing chart components (Sparkline, DonutRing, MiniBar) with full-size variants. Charts can be embedded on the table detail page and generated inline in chat responses.

## User Story

As a user, I want to ask the agent to "chart revenue by customer status" and see a visualization, so I can understand patterns in my data without switching to a separate tool.

## Technical Approach

### Chart Types

| Type | Best For | Component |
|------|----------|-----------|
| Bar (vertical/horizontal) | Category comparison | BarChart |
| Line | Time series | LineChart |
| Pie/Donut | Part-of-whole | DonutChart (extend DonutRing) |
| Scatter | Correlation | ScatterChart |

### Chart Configuration

```typescript
interface TableChartConfig {
  tableId: string;
  chartType: "bar" | "line" | "pie" | "scatter";
  xColumn: string;
  yColumn: string;
  groupColumn?: string;
  aggregation?: "sum" | "avg" | "count" | "min" | "max";
  filters?: StructuredQuery["filters"];
  title?: string;
}
```

### Agent Tool

`create_table_chart` — generates chart config from NL description:
- Input: tableId + natural language ("chart revenue by status")
- LLM infers chart type, X/Y columns, aggregation
- Returns chart config + rendered result

### UI

- Chart builder Sheet on table detail: select chart type, X/Y columns, aggregation
- Charts rendered inline on table detail page in collapsible section
- Charts rendered inline in chat messages via ChatChartResult component
- Extend existing `src/components/charts/` with full-size variants

## Acceptance Criteria

- [ ] Chart builder Sheet with chart type, X/Y column, aggregation selectors
- [ ] Bar, line, pie/donut, scatter chart types render correctly
- [ ] Aggregation works (sum, avg, count, min, max)
- [ ] Agent tool generates chart config from NL description
- [ ] Charts render inline in chat messages
- [ ] Charts display on table detail page
- [ ] Chart configs saved in user_table_views (type: chart)

## Scope Boundaries

**Included:**
- 4 chart types with full-size rendering
- Chart builder UI
- Agent chart generation tool
- Chat inline rendering

**Excluded:**
- Real-time updating charts
- Dashboard with multiple charts
- Export chart as image

## References

- Pattern: `src/components/charts/` — existing chart components (Sparkline, DonutRing, MiniBar)
- Related: tables-agent-integration (agent tool surface)
- Related: tables-chat-queries (inline rendering pattern)
