# Store mode visual concepts

Design exploration for [#112](https://github.com/sndrem/mealplanner/issues/112). Implementation target: [#111](https://github.com/sndrem/mealplanner/issues/111).

## How to review

Open these files in a browser (double-click or `open docs/design/store-mode-concepts/index.html`):

| Concept | File |
|---------|------|
| Overview | [store-mode-concepts/index.html](./store-mode-concepts/index.html) |
| A — Soft Pastel Calm | [soft-pastel-calm.html](./store-mode-concepts/soft-pastel-calm.html) |
| B — Nordic Playful | [nordic-playful.html](./store-mode-concepts/nordic-playful.html) |
| C — Color-Sectioned Sprint | [color-sectioned-sprint.html](./store-mode-concepts/color-sectioned-sprint.html) |

Each page is self-contained HTML + CSS, isolated from the React app. Viewport is tuned for mobile (~390px).

**Checked items** intentionally keep red “done” styling (matches current app).

## Comparison matrix

| Criterion | A — Soft Pastel Calm | B — Nordic Playful | C — Color-Sectioned Sprint |
|-----------|----------------------|--------------------|----------------------------|
| Scan speed in store | Good; soft hierarchy | **Best**; clearest type hierarchy | **Strong** if you know category colors |
| Emotional tone | **Most calming / playful** | Warm but restrained | Energetic, market-like |
| Accessibility risk | Medium (gradients + pastels) | **Lowest** | Higher (many tinted panels) |
| Implementation effort (#111) | Medium | **Lowest** | Medium–high (category token map) |
| Maintenance | Medium | **Lowest** | Category palette must stay in sync |

## Recommendation (for sign-off)

**Primary: B — Nordic Playful** (accent: subtle warm light brown, not purple)

- Closest to current layout; smallest jump for users.
- Pastel personality via warm taupe accent + progress without sacrificing readability when tired.
- Easiest to express as semantic tokens in `app/app.css` later.

**Nordic accent tokens (mockup):**

| Role | Value |
|------|-------|
| `--accent-warm-light` | `#ebe4dc` |
| `--accent-warm` | `#c9bfb0` |
| `--accent-warm-deep` | `#a89988` |
| `--accent-warm-text` | `#57534e` |

**Runner-up: A — Soft Pastel Calm** if the goal is maximum stress relief over scan speed.

**Borrow from C selectively:** category-tinted **section headers only** (not full card backgrounds) if you want faster aisle scanning without contrast risk.

## Semantic tokens (draft for #111)

```css
/* Shared roles — values differ per chosen concept */
--store-bg
--store-surface
--store-surface-elevated
--store-text
--store-text-muted
--store-accent
--store-progress
--store-success / --store-warning / --store-error
--store-item-default-bg / --store-item-checked-bg  /* checked stays red family */
--store-category-tint  /* concept C only */
```

## Sign-off

- [x] Concept chosen: **B — Nordic Playful** (warm light brown accent)
- Reviewer: product owner
- Notes: Red checked styling retained. #112 closed; implementation in #111.
