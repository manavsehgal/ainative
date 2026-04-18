# Handoff: `ainative-business` naming + docs/book rendering parity

**Date:** 2026-04-18
**Author:** Manav Sehgal
**Target repo:** `manavsehgal/ainative` (product code) — at `/Users/manavsehgal/Developer/ainative/`
**Builds on:** [`2026-04-17-ainative-pivot-stagent-repo.md`](./2026-04-17-ainative-pivot-stagent-repo.md)
**Companion changes:** website repo (`manavsehgal/stagent.github.io`) was updated 2026-04-18 with all the conventions below already applied. Use the website as the live reference.

---

## Why this handoff exists

Two things changed after the original 2026-04-17 ainative pivot landed:

1. **npm registry rejected the bare `ainative` package name.** The published package is `ainative-business`. So `npx ainative` (from the original handoff) is now `npx ainative-business`.
2. **The website docs subsite and the book reader render `ainative-business` with inline code styling** — mono font, primary-blue text, light primary background tint. The product repo is the source of truth for both docs and book content, so its generators need to produce content that matches.

This handoff exists so the next sync from the product repo (via the `apply-book-update` and `apply-api-docs` skills) doesn't re-introduce stale `ainative` software references or plain-text package names.

---

## Naming convention (the rule)

When you write content in the product repo (book chapters, docs, generated API reference, README, etc.), apply this distinction:

| Context | Use | Example |
|---|---|---|
| **Software product** — the thing installed via `npx`, the package, the CLI, the platform that runs agents | `` `ainative-business` `` (with backticks in markdown) | "Install `ainative-business` to run AI agents…" |
| **Brand / project / repo / domain** — the wordmark, the folder name on disk, the GitHub repo, the website domain | `ainative` (plain, no backticks) | "the ainative repo at github.com/manavsehgal/ainative" |
| **URLs / file paths / image filenames / storage keys** | unchanged | `ainative.business`, `~/.ainative/`, `/ainative-s-128.png`, `ainative-book-prefs` |
| **Page-title brand suffixes** | `ainative` | `Title — ainative Docs` |
| **`og:site_name`, `meta author`, schema.org `Organization.name`** | `ainative` | site identity stays as the brand |

### Quick judgment test

Ask: *"Does this sentence describe what the software does, or who/where the project is?"*

- Software does → `` `ainative-business` ``
- Project identity → `ainative`

Examples:

- ✅ "`ainative-business` integrates Claude Agent SDK and Codex App Server" (software action)
- ✅ "`ainative-business` exposes a local REST API with 120+ endpoints" (software action)
- ✅ "the ainative product repo at `/Users/manavsehgal/Developer/ainative/`" (path/identity)
- ✅ "Built with `ainative-business`" (software)
- ✅ "ainative.business is positioned as a personal research project" (domain/site)

### Safe regex (use this for bulk migrations)

If you're sweeping the product repo, the regex used on the website was:

```perl
\bainative\b(?!(\.\w|-))
```

This matches bare `ainative` but **skips** `ainative.business` (URL), `ainative-something` (hyphenated identifiers), and folder names like `ainative-wealth`. It correctly rewrites prose mentions while leaving paths/URLs intact.

For markdown bodies in files with frontmatter, also gate the substitution to lines after the second `---` so YAML descriptions stay clean (backticks render as literal text in YAML metadata).

---

## Design language: docs + book rendering inside the software

The website renders `ainative-business` mentions with inline code styling so users instantly see "this is the package/CLI name, not just a brand word." The product repo's in-app docs and book reader should match this exactly so users see the same visual cue inside the software.

### CSS spec (matches the website's `.prose code` rule in `src/styles/prose.css`)

```css
/* Apply to all <code> elements inside docs/book prose contexts */
font-family: var(--font-mono);     /* Geist Mono Variable */
font-size: 0.875em;                /* 87.5% of surrounding text */
background: var(--color-surface-raised);
padding: 0.15em 0.4em;
border-radius: 3px;
color: var(--color-primary);       /* the project's primary blue */
```

### How to produce it

**In markdown body content (book chapters, MDX docs):**

Wrap the package name in backticks every time you write it:

```markdown
With `ainative-business` you can run heartbeat schedules across all agents.
```

Standard markdown renderers will turn that into `<code>ainative-business</code>`, and the CSS rule above styles it.

**In headings:** backticks work in markdown headings too (`## The \`ainative-business\` Approach`). Note: this changes the heading slug — if there's an inline TOC linking to that anchor, update both the heading and the anchor at the same time.

**In React/JSX components (book reader UI, docs viewer):** if there isn't a `.prose` wrapper, render explicit classes that match:

```tsx
<code className="font-mono text-[0.92em] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
  ainative-business
</code>
```

(The `bg-primary/10` is a 10%-opacity tint of the primary color — slightly more attention-grabbing than the neutral raised background; pick whichever matches the surrounding design.)

### Where NOT to add backticks (avoid rendering issues)

- **YAML frontmatter** (`title:`, `description:`, `subtitle:`) — backticks become literal text in meta tags and OG cards
- **JSX/Astro component string props** like `caption="…"`, `alt="…"`, `title="…"` — same problem
- **JS string literals** that get rendered as `{plainString}` in JSX — would need `set:html` or similar to render markup; usually not worth the complexity. Use plain text `ainative-business` (no backticks) in those spots
- **JSON-LD strings** — structured data, not displayed prose
- **Page-`<title>` attributes** — browser title bar doesn't render mono

### Where the website applies code styling vs. plain text (live reference)

| File pattern | Treatment |
|---|---|
| `src/pages/**/*.mdx` body | backticks (`` `ainative-business` ``) |
| `src/data/book/chapters/*.md` body | backticks |
| `src/pages/**/*.astro` JSX content | `<code class="…">ainative-business</code>` |
| `src/pages/**/*.astro` `description=""` props | plain text `ainative-business` |
| YAML frontmatter `description:`, `subtitle:` | plain text |
| `src/data/seo.ts`, `Layout.astro` site identity | unchanged (`ainative`) |
| `src/components/Nav.astro` wordmark | unchanged (`ainative`) |

Mirror this split in the product repo's content/codegen.

---

## Specific things to update in the product repo

### Book chapters (`book/chapters/*.md`)

The website's copies (under `src/data/book/chapters/`) were already swept on 2026-04-18 with the regex above. Next time you regenerate book content from the product repo:

- **Run the same Perl pass on the source files** before they land in the product repo, so the upstream stays the canonical version
- The `apply-book-update` skill copies these files verbatim into the website — so if you fix them upstream, the next sync just works
- Chapter subtitles in the chapter manifest (in the product repo, mirrored to website's `src/lib/book/content.ts`) — update software-reference subtitles too. Example: chapter 11 subtitle was changed to `"ainative-business Building Itself Using Itself"` (plain text, no backticks — it's a JS string)

### Docs (`docs/**/*.mdx`)

- All body prose mentions of the software → `` `ainative-business` ``
- Frontmatter `description:` fields → plain `ainative-business`
- Any inline TOC anchors that mention `ainative` need updating to match new heading slugs

### API documentation generator (the script behind `apply-api-docs`)

When generating endpoint descriptions, route summaries, and the "What is this API for" intro:

- Use `` `ainative-business` `` in body prose
- Plain `ainative-business` in description-field strings
- Leave `ainative.business` URLs and `~/.ainative/` paths untouched

### Generated changelogs / release notes

Same rule. Software references get backticks; brand/repo references stay bare.

---

## What stays the same

To re-emphasize from the previous handoff:

1. **Software runtime / install flow / behavior do NOT change.** This is still purely a *naming* pivot.
2. **Repo name stays `manavsehgal/ainative`** on GitHub. Folder on disk stays `/Users/manavsehgal/Developer/ainative/`. Website domain stays `ainative.business`.
3. **The published npm package is `ainative-business`.** The bare `ainative` name was rejected by npm.

---

## Verification (after applying)

In the product repo:

```bash
# Should return 0 — no bare 'ainative' in body prose, frontmatter, or generated docs
perl -lne 'print "$ARGV:$.: $_" if /\bainative\b(?!(\.\w|-))/' \
  $(find . -name "*.md" -o -name "*.mdx" -not -path "*/node_modules/*")

# These SHOULD still appear (correct keeps):
# - URLs: ainative.business, github.com/manavsehgal/ainative
# - Paths: ~/.ainative/, ~/.ainative-wealth
# - Folder names in code blocks: ainative-growth, ainative-wealth
# - Brand wordmark in nav/footer/headers
```

If anything bare `ainative` shows up in prose body, run the regex above to fix it.

---

## Contact / ownership

Solo author working on `main` per the original handoff's preference. Land changes atomically when you're ready; no dual-naming period needed.
