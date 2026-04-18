---
title: "From Hierarchy to Intelligence"
subtitle: "Two Thousand Years of Organizational Design — and Why It's About to Break"
chapter: 1
part: 1
readingTime: 15
lastGeneratedBy: "2026-04-18T17:10:00.000Z"
---

# From Hierarchy to Intelligence

## The Oldest Problem in Organization

Jack Dorsey and Roelof Botha trace this history in their March 2026 Sequoia essay "From Hierarchy to Intelligence" — an account we draw on heavily in this chapter alongside Peter Drucker's management theory, Tony Hsieh's Zappos experiment, and Valve's employee handbook, because the history of organizational design is the foundation for understanding why AI-native systems matter.

Eight soldiers shared a tent and a mule. That was the Roman *contubernium* — the smallest unit in the most successful military organization the ancient world ever produced. Eight men became a *century* of eighty. Six centuries formed a *cohort* of 480. Ten cohorts made a *legion* of roughly 5,000. The structure was so effective that it persisted, with minor variation, for over five centuries.

We remember Rome for its roads, its aqueducts, its law. But the truly revolutionary technology was the org chart. Before Rome, armies were mobs with weapons. After Rome, they were information-processing machines. Orders flowed down from the legatus through tribunes to centurions to the tent. Reports flowed back up. The centurion didn't need to understand grand strategy. The legatus didn't need to know which mule was lame. Each layer filtered information, passing only what the next layer needed to act on.

This is the insight that every organization in history has rediscovered — or, as Dorsey and Botha frame it, hierarchy is "an information routing protocol built around a simple human limitation."

The Prussian general staff formalized this in the early nineteenth century. After Napoleon humiliated the old Prussian army at Jena in 1806, a group of reformers led by Scharnhorst and Gneisenau invented something that had never existed before: a permanent class of professional staff officers whose job was not to fight, but to think. They analyzed intelligence, drafted plans, managed logistics. They were, in the most literal sense, middle management — a layer of humans whose entire purpose was to process and route information between the commander's intent and the soldier's action.

It worked spectacularly. By 1870, the Prussian staff system had become the most imitated organizational innovation in the world.

Then the railroads arrived, and they brought this military hierarchy into business. When Daniel McCallum took over the New York and Erie Railroad in 1854, he faced a problem no business had encountered before: coordinating thousands of workers across hundreds of miles, with trains that could kill people if information arrived late. His solution was to draw what historians consider the first modern organizational chart. It looked remarkably like a Roman legion's chain of command.

Frederick Winslow Taylor took it further. His *Scientific Management* of the 1890s decomposed work into atomic tasks, each measured and optimized. A worker on the factory floor didn't need to understand the whole product — they needed to execute their step precisely. The thinking was done elsewhere, by managers and engineers. Taylor's system was brutally effective and brutally dehumanizing, but its core logic was the same as Rome's: separate the thinking from the doing, and route information between the two through layers of humans.

McKinsey and the other great consulting firms of the mid-twentieth century added the matrix. Instead of one hierarchy, you got two — functional and divisional — overlapping like a grid. The matrix was supposed to solve the problem of coordination across product lines and geographies. In practice, it created a new problem: now you had two bosses, two information channels, two approval chains. The layers multiplied. By the time a Fortune 500 company reached the 1990s, it was common to find eight, ten, twelve levels between the CEO and the person doing the actual work.

Every one of these innovations — the Roman century, the Prussian staff, the railroad org chart, Taylor's scientific management, McKinsey's matrix — was an attempt to solve the same fundamental problem: how do you coordinate the work of many people when each person can only hold so much information, communicate with so many others, and make so many decisions in a day?

The answer, for two thousand years, was the same: add another layer of humans.

## The Constraint That Never Changed

There is a number that haunts organizational theory. It varies by author — some say three to seven, others five to nine — but the concept is universal. *Span of control*: the number of direct reports a single manager can effectively supervise.

The number hasn't changed since the Roman centurion managed his eighty men through ten *decani*. It hasn't changed because it's rooted in something biological: the limits of human attention, working memory, and communication bandwidth. A manager with three reports has time for deep mentorship but creates a tall, slow hierarchy. A manager with fifteen reports has a flat, fast organization but can't actually manage anyone. The sweet spot — usually cited as five to eight — represents a hard constraint of human cognition.

Every organizational experiment of the past thirty years has been an attempt to escape this constraint.

Spotify's squad model, introduced around 2012, tried to replace hierarchical teams with autonomous squads organized into tribes, chapters, and guilds. The idea was beautiful: small, self-organizing teams aligned by mission rather than function. In practice, Spotify itself struggled to make it work. The "Spotify Model" became famous not because Spotify perfected it, but because other companies adopted it, discovered the same coordination problems, and needed someone to blame.

Zappos tried Holacracy — a radical experiment in self-management where traditional managers were abolished and replaced with overlapping "circles" governed by a written constitution. CEO Tony Hsieh bet the company on it in 2013. Within two years, 18% of the workforce had left. The circles created their own informal hierarchies. The constitution created bureaucracy that made the old system look nimble. By 2020, Zappos had quietly moved on.

Valve, the game company, famously had no managers at all. Desks had wheels so people could roll to whichever project interested them. The employee handbook became a legendary document of organizational idealism. But former employees told a different story: cliques formed, senior engineers became de facto managers without the title or accountability, and new hires often floundered with no one to guide them. The flat structure was a fiction. Power still concentrated — it just became invisible and unaccountable.

The pattern is consistent. Every attempt to flatten hierarchy without replacing it with an alternative coordination mechanism eventually fails. The organization either reverts to traditional management, or it develops a shadow hierarchy that's worse because it's unacknowledged.

Why? Because the constraint never changed. Humans are still the only routing mechanism for organizational information. Remove the explicit routers — the managers — and informal routers emerge. Remove those, and the organization simply stops coordinating.

This is not a failure of imagination or will. It is a fundamental limitation of the substrate. When your only coordination technology is human attention, the span of control is a law of nature.

Until it isn't.

## Why Now: The Capability Threshold

Every few years, someone declares that artificial intelligence will transform how organizations work. The declarations have been premature — until recently. What changed is not ambition or hype. What changed is capability, and the pace of that change has a quantitative explanation.

Leopold Aschenbrenner's 2024 essay *Situational Awareness* offers the clearest framework for understanding the trajectory. Progress from GPT-2 to GPT-4 — roughly four years — can be decomposed into three sources of improvement, each measured in orders of magnitude (OOMs):

**Compute scaling** contributed approximately 0.5 OOMs per year. Not from Moore's Law, which delivered barely one OOM per decade, but from raw investment — training budgets growing from millions to hundreds of millions to billions of dollars. GPT-2 trained on roughly 4×10²¹ floating-point operations. GPT-4 trained on roughly 10²⁵. That is a ten-thousand-fold increase in four years.

**Algorithmic efficiency** contributed another 0.5 OOMs per year. Better architectures, better training recipes, better data curation. The inference cost to achieve 50% accuracy on the MATH benchmark dropped roughly a thousand-fold in two years. Techniques like mixture-of-experts and improved scaling laws meant each dollar of compute bought more capability than the year before.

**Unhobbling gains** contributed the rest — and these matter most for our argument. RLHF made a small fine-tuned model equivalent to one a hundred times larger. Chain-of-thought prompting gave models ten times the effective reasoning power on mathematical tasks. Agent scaffolding transformed GPT-4's performance on the SWE-Bench coding benchmark from 2% to over 14%. Context windows expanded from two thousand tokens to over a million. Each of these was not a marginal improvement. Each was a qualitative unlock — a new kind of thing the system could do that it could not do before.

The total: roughly five orders of magnitude of effective improvement in four years. A system that could barely count to five in 2019 was passing the bar exam by 2023 and generating a thousand production pull requests per week at Stripe by early 2026.

The critical insight for this book is the third category — unhobbling. The transition from chatbot to agent is itself an unhobbling gain. When a model can be onboarded like a new hire, given access to a codebase and development tools, and left to work independently for hours, it is not simply a better chatbot. It is a new kind of organizational participant. It can route information, decompose tasks, and coordinate work — exactly the functions that hierarchy was invented to perform.

These trendlines have not stopped. Compute investment continues to accelerate. Algorithmic efficiency continues to compound. And the agent transition — the specific unhobbling that matters for organizational design — is still in its early stages. The companies profiled in this book are not riding a hype cycle. They are riding a capability curve with a quantitative foundation, and that curve explains why the two-thousand-year-old constraint is breaking now.

## Intelligence Replaces Hierarchy

> [!case-study]
> **Sequoia/Block** — "Hierarchy is an information routing protocol built around a simple human limitation: people can only manage a few others at once. Layer by layer, companies grow taller to accommodate that bottleneck. AI changes this picture fundamentally." — Jack Dorsey & Roelof Botha, *Hierarchy Collapses When Intelligence Is Cheap*, March 2026.

In March 2026, Jack Dorsey and Roelof Botha of Sequoia published a thesis that stated plainly what many had been circling around: the reason organizations are hierarchical is not that hierarchy is the best structure. It's that hierarchy is the only structure that works when humans are the sole coordination mechanism. AI changes the equation because it provides an alternative mechanism — one that doesn't have a span of control limit.

An AI agent can monitor a hundred tasks simultaneously. It can summarize a thousand-page codebase in seconds. It can route a request to the right specialist without needing a manager to triage it. It doesn't forget context between meetings. It doesn't need to be "looped in." It processes information at a speed and scale that no human manager can match.

This doesn't mean managers are useless. It means the *function* that most managers perform — information routing, status aggregation, task decomposition, progress tracking — can be performed by a different substrate. The humans who remain in the organization take on roles that require judgment, creativity, relationships, and accountability.

Dorsey and Botha identified three roles in the AI-native organization:

**Individual Contributors (ICs)** do the actual work — writing code, designing interfaces, closing deals, drafting legal briefs. In the AI-native org, they're augmented by AI agents that handle the routine parts of their work, freeing them to focus on the parts that require human judgment.

**Directly Responsible Individuals (DRIs)** own outcomes. They don't manage people in the traditional sense — they don't do performance reviews or approve time off. They own a mission, a metric, a product. They decide what needs to happen and ensure it happens, coordinating through AI agents rather than through layers of human reports.

**Player-Coaches** are the most senior leaders. They still do IC work — Dorsey emphasized this — but they also set direction, resolve conflicts, and make the calls that require organizational context no AI yet possesses. They're coaches in the sports sense: they've played the game, they understand it at a level that lets them guide others, and they're still on the field.

What's missing from this list is telling: there is no permanent middle management layer. The information routing that middle managers performed is handled by AI. The coordination that middle managers enabled is handled by AI. The status reporting that consumed most of middle management's time is handled by AI.

The numbers are starting to bear this out. Gartner predicted in October 2024 that 20% of organizations would use AI to flatten their structures by 2026, eliminating more than half of middle management positions. Korn Ferry found that 41% of workers already report that their employers have reduced management tiers. Their analysis suggests AI can automate roughly 60% of a typical manager's workload — the routing, summarizing, tracking, and reporting that fills most management calendars.

Deloitte's 2026 survey found that 78% of technology leaders anticipate integrating AI agents into their organizational structure within five years. Not as tools. As participants. Agents that attend standups, triage issues, draft reports, and escalate decisions to humans only when human judgment is genuinely required.

This is not a prediction about the distant future. It is a description of what is already happening at the companies profiled in this book.

## The Factory Metaphor

> [!case-study]
> **8090** — "The Factory didn't abolish human skill. It captured it, codified it, and made it transferable. Before the Factory, there were craftsmen. A master shoemaker could make forty pairs a year. The Factory didn't eliminate his knowledge — it encoded his patterns into machines, processes, and quality controls that let a thousand workers produce a million pairs." — Chamath Palihapitiya, *The Software Factory*, February 2025.

Chamath Palihapitiya's framing cuts through the hype and the fear. We are not talking about replacing humans with machines. We are talking about the same transformation that happened in every other industry: the transition from craft production to industrial production.

Software in 2026 is the pre-industrial workshop. A skilled developer — a "master craftsman" — can produce remarkable work, but their output is bounded by their personal capacity. They hold the context in their head. They make decisions based on experience that's difficult to articulate, let alone transfer. When they leave, their knowledge leaves with them.

The factory didn't make craftsmen obsolete. It changed what they did. The master shoemaker didn't disappear — he became the person who designed the patterns, calibrated the machines, and judged the quality of output. His skill was elevated, not eliminated. But his output was no longer limited to what his own two hands could produce.

This is exactly what's happening with software. The AI agent is not replacing the senior engineer. It's capturing the patterns — the code review heuristics, the architecture decisions, the debugging instincts — and making them executable at scale. The senior engineer still designs the system, makes the hard calls, and judges the output. But they're no longer limited to writing code themselves. They're directing a factory floor of agents that can execute their patterns a hundred times faster than they could alone.

The metaphor extends further than you might expect. The Industrial Revolution didn't just change how shoes were made. It changed how companies were organized, how workers were trained, how quality was controlled, how supply chains functioned. The resistance to factories wasn't just about lost jobs — it was about a complete restructuring of economic life.

We are at the same inflection point. The question is not "Will AI change how we write software?" That's already settled. The question is "Will AI change how we organize the people who direct the software?" And the answer, increasingly, is yes — in ways that look remarkably similar to the factory revolution.

## Beyond Engineering

> [!case-study]
> **Harvey** — "Autonomous agents are starting to take on part of that coordination function directly. This is an important and underappreciated development. People tend to fixate on agents that produce artifacts — code, documents, analyses — but the agents that route, prioritize, and coordinate work may be more transformative." — Gabe Pereyra, CEO of Harvey, April 2026.

Engineering is first because code is machine-readable. An AI agent can clone a repository, read every file, understand the dependency graph, run the test suite, and submit a pull request. The feedback loop is tight and automated: either the tests pass or they don't. Either the code compiles or it doesn't. This makes software engineering the ideal proving ground for AI agents.

But the pattern applies far beyond code.

Gabe Pereyra, the CEO of Harvey, has been building AI agents for legal work — and his insight about coordination agents is worth dwelling on. Most people think about AI replacing the *production* of work: writing the brief, drafting the contract, generating the code. Pereyra argues that the bigger transformation is in the *coordination* of work: deciding which brief to write next, routing the contract to the right reviewer, triaging the bug reports.

This is exactly the middle management function we discussed earlier. And it's not limited to engineering or law.

Consider what happens when you apply this pattern to product management. A product manager today spends most of their time in coordination: gathering requirements from stakeholders, prioritizing the backlog, writing tickets, following up on progress, summarizing status for leadership. An AI agent can do most of this. It can monitor customer feedback channels, identify themes, draft user stories, prioritize them against strategic goals, and present the product manager with a curated set of decisions to make. The product manager's job shifts from coordination to judgment.

Or consider finance. A CFO's office spends enormous energy on information routing: collecting data from business units, consolidating reports, reconciling numbers, preparing board decks. AI agents can handle the collection, consolidation, and preparation. The CFO focuses on interpretation, strategy, and the conversations that require a human face and human relationships.

Pereyra tells a story about showing Harvey to his parents — people with no technical background — and watching them be stunned by what the agents could do. Not because the technology was flashy, but because it was *useful* in a way that previous technology waves hadn't been. This wasn't a chatbot that could write a poem. This was an agent that could read a lease agreement, identify the problematic clauses, explain them in plain language, and draft a response. For the first time, the power of AI was legible to people outside the tech industry.

That legibility matters. The factory revolution didn't stay in textiles. It spread to steel, chemicals, food processing, automobiles — every industry where production could be decomposed into repeatable steps. The AI agent revolution won't stay in software engineering. It will spread to every knowledge-work domain where coordination can be decomposed into information routing, status tracking, and decision support.

Legal is next. Finance is close behind. Product management, operations, HR — they're all coming. The only question is sequencing.

## The Cautionary Tale

There is a version of this story that ends badly, and we should be honest about it.

In 2024, Klarna — the Swedish buy-now-pay-later company — announced that AI was doing the work of 700 customer service agents. CEO Sebastian Siemiatkowski became a poster child for AI-driven efficiency, proudly announcing a hiring freeze and a 40% reduction in headcount. The stock market loved it.

Then reality intervened. Customer satisfaction scores dropped. Complex cases that the AI couldn't handle piled up with no humans to resolve them. The remaining employees were overwhelmed. Siemiatkowski eventually admitted that the company had "gone too far" — that removing humans without rebuilding the coordination layer had created problems that the AI couldn't solve alone.

The lesson is not that AI can't replace human work. It clearly can. The lesson is that you cannot simply subtract humans from an existing organization and expect it to function. The organization was designed around human coordination. Remove the humans and you don't get a leaner organization — you get a broken one.

Shopify's approach is more instructive. CEO Tobi Lutke issued a memo in early 2026 requiring teams to "demonstrate why you cannot get what you want done using AI" before requesting additional headcount. This is a fundamentally different philosophy. Klarna said "replace humans with AI." Shopify said "design the work for AI first, and add humans where AI genuinely can't do the job."

The difference sounds subtle but it's profound. Klarna started with an existing organization and removed people. Shopify started with the work to be done and asked what the right mix of human and AI effort should be. One approach is cost-cutting with a technological veneer. The other is genuine organizational redesign.

This distinction will matter more and more as the tools mature. The companies that thrive in the AI-native era won't be the ones that fired the most people. They'll be the ones that redesigned work from first principles — that asked not "which humans can we replace?" but "what does this organization look like when intelligence is abundant and cheap?"

## If Not Hierarchy, Then What?

We've traced two thousand years of organizational design, from the Roman contubernium to Shopify's AI-first hiring memo. The through-line is consistent: every organizational structure in history has been an attempt to route information and coordinate action through the bottleneck of human attention. Every innovation — the staff officer, the org chart, the matrix, the squad — was a clever hack around a constraint that never changed.

Now the constraint is changing. AI agents can route information, track status, decompose tasks, and coordinate work at a speed and scale that no human layer can match. The hierarchy that served us for two millennia is not being replaced because it was wrong. It's being replaced because the problem it solved — coordinating work through human attention — now has a better solution.

But "better solution" is easy to say and hard to build. The next chapter maps the abstract thesis to a concrete architecture. If the AI-native organization is a factory, what are the stations on the factory floor? What are the conveyor belts that move work between them? What does the control system look like?

The rest of this book answers those questions. We'll build a working factory — `ainative-business` — that demonstrates the patterns in running code. We'll study the companies that are already operating this way. And we'll confront the hard questions about what happens to the humans in this new world.

The factory metaphor is deliberate. Factories didn't abolish human skill. They amplified it. The question isn't whether AI will transform how we organize work — that's already underway. The question is whether we'll build factories that elevate human judgment, or sweatshops that grind it down.

The answer depends on the architecture we choose. Let's look at the blueprint.
