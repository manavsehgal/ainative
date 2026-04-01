---
title: "Agency Operator Use Case"
category: "use-case"
lastUpdated: "2026-03-31"
---

# Agency Operator

You run an AI agency — deploying agent workflows for clients across industries. Each client has different requirements, different content domains, and different tolerance for AI autonomy. Stagent gives you a multi-tenant operating layer where projects map to clients, profiles customize per vertical, and workflow blueprints package your service offerings.

## How Stagent Maps to Your Agency

| Agency Concept | Stagent Feature | What It Does |
|---------------|----------------|--------------|
| Client portfolios | **Projects** | One project per client with scoped documents, tasks, and working directories |
| Vertical expertise | **Profiles** | Custom agent profiles per industry — e-commerce researcher, legal document writer, SaaS code reviewer |
| Service packages | **Workflow Blueprints** | Reusable templates you instantiate per client with dynamic variables (brand name, tone, deliverables) |
| Recurring deliverables | **Schedules** | Automated agent execution on intervals — weekly reports, daily monitoring, monthly audits |
| Client billing | **Cost & Usage** | Per-project spend tracking maps directly to client cost allocation |
| Quality control | **Inbox & Permissions** | Review agent output before it reaches the client. Audit trails prove governance to clients |

## Operating Model

### Multi-Project Client Management

Each client gets their own Stagent project. Upload client-specific reference documents (brand guidelines, SOPs, competitive analysis) that agents automatically consult during execution. Working directories scope file operations to the client's deliverables folder.

**Pattern:** Create a project template checklist — brand docs uploaded, relevant profiles assigned, workflow blueprints instantiated, schedules configured, budget guardrails set. Repeat for each new client onboarding.

### Profile Customization Per Vertical

Start with Stagent's 21 built-in profiles, then customize or create new ones for your verticals:

- **E-commerce:** Product description writer, competitor price monitor, review sentiment analyzer
- **Legal:** Contract clause reviewer, compliance checker, case research summarizer
- **SaaS:** Technical documentation writer, API changelog generator, user feedback classifier
- **Real estate:** Listing description writer, market analysis researcher, comparable property finder

Profiles are portable YAML files with sidecar skill directories. Import proven profiles from GitHub, run behavioral smoke tests, and share across your team.

### Workflow Blueprints as Service Packages

Package your repeatable services as workflow blueprints:

| Service | Blueprint Pattern | Steps |
|---------|-----------------|-------|
| Weekly Content Package | Sequence | Research → Outline → Draft → Edit → Format |
| Competitive Intelligence | Parallel | Fork by competitor → Research each → Synthesize report |
| Monthly Operations Audit | Planner-Executor | Plan audit scope → Execute checklist items → Compile findings |
| Ongoing Monitoring | Loop | Check metrics → Flag anomalies → Draft alerts → Repeat |

Each blueprint defines required variables (client name, industry, deliverable format) that get filled in during instantiation. Lineage tracking connects every workflow back to its source blueprint for version management.

### Multi-Provider Strategy

Different clients may prefer different AI providers based on cost, capability, or compliance requirements. Stagent's runtime registry lets you:

- Run research tasks on Claude for reasoning depth
- Run code generation on Codex for coding performance
- Switch providers per workflow step without changing the workflow definition
- Compare costs across providers in the usage dashboard

### Client Reporting

The cost and usage dashboard provides the data you need for client billing:

- **Per-project spend:** Filter by client project to see total cost, token usage, and task count
- **Per-provider breakdown:** Show clients which models run their work and at what cost
- **Budget guardrails:** Set per-project budgets to prevent overruns and protect margins
- **Audit trails:** Export agent logs and approval history as governance documentation

## Getting Started

```bash
npx stagent
```

1. Create a project for your first client and upload their reference documents
2. Browse the profile gallery — assign or customize profiles for the client's vertical
3. Create a workflow blueprint for your most common service offering
4. Set a schedule for recurring deliverables and configure budget guardrails
5. Use the cost dashboard to track per-client spend after the first week

See the [Work Use Journey](../journeys/work-use.md) for a guided walkthrough of team operations, or [Why Stagent](../why-stagent.md) for the full platform overview.
