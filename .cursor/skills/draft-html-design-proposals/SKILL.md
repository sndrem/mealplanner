---
name: draft-html-design-proposals
description: Creates self-contained hardcoded HTML design drafts with an index hub and side-by-side compare page (iframes). Use when the user wants UI proposals, layout alternatives, mockups, or design exploration before implementing in React, or when they mention HTML prototypes, compare-all, or draft designs.
---

# Draft HTML Design Proposals

## Goal

Produce **standalone HTML files** the user can open in a browser: one file per layout variant, plus an **index** and a **compare-all** page that shows variants **side by side** in iframes.

## When to use

- User invokes this skill and supplies **design focus** (screen, problem, constraints, number of variants).
- User wants to explore readability, layout, hierarchy, or empty states **before** app code changes.
- User references prior work under `temp-delete-later/*-proposals/`.

Do **not** wire proposals into the React app, Vite routes, or Tailwind build unless the user explicitly asks afterward.

## Inputs from the user

Before writing files, confirm or infer:

| Input | Default if omitted |
|-------|-------------------|
| **Focus** | What UI slice to mock (e.g. “station detail panel”) |
| **Variants** | 2–3 distinct directions (name each: e.g. cards vs typography vs timeline) |
| **Fixture data** | Realistic hardcoded copy; same dataset in every proposal |
| **Viewport** | Mobile-first panel (~`max-width: 520px`) unless they say full page |
| **Output folder** | `temp-delete-later/{kebab-slug}-proposals/` |

Ask only when focus or variant count is unclear.

## Output layout

```
temp-delete-later/{slug}-proposals/
├── index.html              # Hub: title, lead, links to each proposal + compare
├── compare-all.html        # Grid of iframes, one column per proposal
├── proposal-1-{short}.html
├── proposal-2-{short}.html
└── proposal-N-{short}.html   # optional 3rd+
```

Optional (only if user asks): `IMPLEMENTATION-proposal-N.md` for chosen direction.

## Workflow

1. **Define the brief** — One sentence goal + bullet list of what each variant should emphasize (different hierarchy, density, empty-state treatment, etc.).
2. **Freeze fixture data** — Single source of truth (labels, numbers, empty fields, long text). Every proposal renders the **same** data.
3. **Build each `proposal-*.html`** — Self-contained: `<!DOCTYPE html>`, inline `<style>`, no external assets or JS frameworks.
4. **Build `index.html`** — Card links to each proposal; prominent link to `compare-all.html`.
5. **Build `compare-all.html`** — Sticky header + CSS grid; one iframe per proposal (see [reference.md](reference.md)).
6. **Tell the user how to view** — Open `index.html` in a browser (file URL is fine). On macOS: `open temp-delete-later/{slug}-proposals/index.html`.

## Proposal file rules

- **Self-contained**: All CSS in a `<style>` block; no imports from the app.
- **Scoped mock**: Center a `.panel` (or equivalent) at the target width; use `body` padding and neutral page background so the mock reads as a component, not a full marketing page.
- **Shared tokens**: Reuse a small `:root` palette across proposals in the same set (background, surface, text, muted, border, accent) so comparison is fair.
- **Typography**: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` unless the user specifies brand fonts.
- **Navigation**: Top link back to `index.html` on each proposal page.
- **Semantics**: Real headings, labels, buttons (can be `<button type="button">` with no handlers).
- **Accessibility**: `lang` on `<html>`, meaningful `<title>`, iframe `title` on compare page.

## Variant design discipline

Each proposal must be a **real alternative**, not a color tweak:

- Different information architecture (grouping, order, emphasis).
- Different treatment of **empty / missing** fields when relevant.
- Different density (cards vs list vs timeline vs chips).

Keep chrome minimal so differences are obvious in `compare-all.html`.

## Compare page rules

- **iframes** load sibling `proposal-*.html` files (relative `src`).
- **Grid**: `repeat(N, minmax(280px, 1fr))` for N proposals; stack to one column below ~1100px.
- **Height**: ~680–720px iframes so panels scroll inside the frame.
- **Labels**: Column header links open the proposal in a new tab.

Templates: [reference.md](reference.md).

## Aligning with the real app (optional)

If the target UI exists in the repo:

- Skim the React component for **fields, sections, and actions** to include in fixtures.
- Do **not** copy Tailwind classes into HTML; approximate spacing and hierarchy with plain CSS.
- Match **copy** and **states** (filled vs empty) from production, not pixel-perfect styling.

## Quality checklist

- [ ] Same fixture data in every proposal file
- [ ] Each variant is meaningfully different
- [ ] `index.html` and `compare-all.html` link correctly
- [ ] Compare page works via `file://` (relative iframe paths)
- [ ] No dependency on dev server or build
- [ ] Folder path noted in index footer for cleanup (`temp-delete-later/...`)

## Cleanup

These files are **disposable**. Keep under `temp-delete-later/` unless the user moves them. Do not commit unless the user asks.
