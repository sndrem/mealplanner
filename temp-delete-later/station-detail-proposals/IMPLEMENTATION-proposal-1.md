# Station details panel — Proposal 1 implementation guide

**Audience:** Developer or Copilot agent implementing in a JSP + single CSS codebase.  
**Design reference:** `proposal-1-cards.html` in this folder (open in a browser).  
**Scope:** Replace the legacy `<table class="stationDetailsTable">` layout with a card-based panel. No Tailwind, no new CSS frameworks — only additions to the existing project `.css` file.

---

## 1. Goals

| Problem (current table) | Solution (Proposal 1) |
|-------------------------|------------------------|
| Long vertical zebra list, hard to scan | Group **Start** and **Stop** in side-by-side cards |
| Latitude and longitude on separate rows | Single **Position** row per card |
| Double-line `border_top` dividers | Section headers and card chrome |
| Centered underlined links easy to miss | Footer **button-style** actions (`primary` / `secondary`) |
| Empty cells waste space | Omit empty metadata rows in JSP; show placeholder only inside cards when needed |
| Bold label + value columns feel cramped | More padding, muted labels, tabular numbers on values |

Preserve all existing behaviour: JSTL `type` conditionals, Spring Security `sec:authorize`, EL expressions, `fmt:formatDate`, and every action URL.

---

## 2. Files to touch

| File | Action |
|------|--------|
| JSP containing `stationDetailsTable` | Replace table markup (section 4) |
| Project global CSS (e.g. `styles.css`, `main.css`) | Append section 5 (prefixed classes) |
| Optional JSP tag/fragment | Extract panel if the table is included in multiple pages |

Do **not** remove old `.stationDetailsTable` rules until the new markup is verified; you may delete them in a follow-up commit.

---

## 3. HTML structure (target DOM)

Semantic wrapper — **not** a table:

```text
article.station-details-panel
├── header.station-details-header
│   ├── .station-details-header__label     → "Sample"
│   ├── .station-details-header__value     → sample number
│   └── .station-details-header__tag       → optional subtitle (see 4.2)
├── div.station-details-body
│   ├── div.station-details-pair-grid
│   │   ├── section.station-details-card.station-details-card--start
│   │   │   ├── .station-details-card__head
│   │   │   └── dl > div.station-details-card__row > dt + dd
│   │   └── section.station-details-card.station-details-card--stop  (conditional)
│   ├── h2.station-details-section-title
│   └── dl.station-details-meta-grid > div.station-details-meta-item
└── footer.station-details-actions > a.primary | a.secondary | a.tertiary
```

**Class naming:** Prefix `station-details-` to avoid clashes with legacy `.heading`, `.border_top`, `.center`, `.latlon`, `.format`.

**Accessibility:** Keep `aria-label="Station sample details"` on the panel. Give each card head an `id` and `aria-labelledby` on the section.

---

## 4. JSP markup (full replacement)

Replace the entire `<table class="stationDetailsTable">…</table>` block with the fragment below. Adjust taglib prefixes (`c`, `fmt`, `sec`) to match the project.

### 4.1 Main panel

```jsp
<%-- Optional: taglib declarations if not already on the page --%>
<%-- <%@ taglib prefix="c" uri="jakarta.tags.core" %> --%>
<%-- <%@ taglib prefix="fmt" uri="jakarta.tags.fmt" %> --%>
<%-- <%@ taglib prefix="sec" uri="org.springframework.security.tags" %> --%>

<article class="station-details-panel" aria-label="Station sample details">

  <header class="station-details-header">
    <div class="station-details-header__label">Sample</div>
    <div class="station-details-header__value">${station.sampleNo}</div>
    <%-- Optional subtitle: only output if you have start/stop times (see 4.2) --%>
    <c:if test="${not empty station.datetime}">
      <span class="station-details-header__tag">
        <fmt:formatDate value="${station.datetime}" pattern="dd.MM.yyyy HH:mm" />
        <c:if test="${not empty station.datetimeStop}">
          &nbsp;&middot;&nbsp;
          <fmt:formatDate value="${station.datetimeStop}" pattern="HH:mm" />
        </c:if>
      </span>
    </c:if>
  </header>

  <div class="station-details-body">

    <div class="station-details-pair-grid">

      <%-- START CARD --%>
      <section class="station-details-card station-details-card--start"
               aria-labelledby="station-details-start-heading">
        <div id="station-details-start-heading" class="station-details-card__head">Start</div>
        <dl>
          <div class="station-details-card__row">
            <dt>Time</dt>
            <dd>
              <fmt:formatDate value="${station.datetime}" pattern="dd.MM.yyyy HH:mm" />
            </dd>
          </div>
          <div class="station-details-card__row">
            <dt>Position</dt>
            <dd class="latlon">
              <c:if test="${not empty station.latitude}">${station.latitude}</c:if>
              <c:if test="${not empty station.latitude and not empty station.longitude}">&nbsp;&middot;&nbsp;</c:if>
              <c:if test="${not empty station.longitude}">${station.longitude}</c:if>
            </dd>
          </div>
          <div class="station-details-card__row">
            <dt>Depth</dt>
            <dd>${station.bottomDepthStart}</dd>
          </div>
          <div class="station-details-card__row">
            <dt>Shiplog</dt>
            <dd>
              <c:choose>
                <c:when test="${not empty station.shipLogStart}">${station.shipLogStart}</c:when>
                <c:otherwise><span class="station-details-empty">Not recorded</span></c:otherwise>
              </c:choose>
            </dd>
          </div>
        </dl>
      </section>

      <%-- STOP CARD: same condition as legacy table (types 3,4,7,8 hide stop block) --%>
      <c:if test="${type ne 3 && type ne 4 && type ne 7 && type ne 8}">
        <section class="station-details-card station-details-card--stop"
                 aria-labelledby="station-details-stop-heading">
          <div id="station-details-stop-heading" class="station-details-card__head">Stop</div>
          <dl>
            <div class="station-details-card__row">
              <dt>Time</dt>
              <dd>
                <fmt:formatDate value="${station.datetimeStop}" pattern="dd.MM.yyyy HH:mm" />
              </dd>
            </div>
            <div class="station-details-card__row">
              <dt>Position</dt>
              <dd class="latlon">
                <c:if test="${not empty station.latitudeStop}">${station.latitudeStop}</c:if>
                <c:if test="${not empty station.latitudeStop and not empty station.longitudeStop}">&nbsp;&middot;&nbsp;</c:if>
                <c:if test="${not empty station.longitudeStop}">${station.longitudeStop}</c:if>
              </dd>
            </div>
            <div class="station-details-card__row">
              <dt>Depth</dt>
              <dd>${station.bottomDepthStop}</dd>
            </div>
            <div class="station-details-card__row">
              <dt>Shiplog</dt>
              <dd>
                <c:choose>
                  <c:when test="${not empty station.shipLogStop}">${station.shipLogStop}</c:when>
                  <c:otherwise><span class="station-details-empty">Not recorded</span></c:otherwise>
                </c:choose>
              </dd>
            </div>
          </dl>
        </section>
      </c:if>

    </div>

    <h2 class="station-details-section-title">Station metadata</h2>

    <dl class="station-details-meta-grid">

      <c:if test="${not empty station.notes}">
        <div class="station-details-meta-item station-details-meta-item--full">
          <dt>Notes</dt>
          <dd class="format">${station.notes}</dd>
        </div>
      </c:if>

      <c:if test="${not empty station.notesSediment}">
        <div class="station-details-meta-item station-details-meta-item--full">
          <dt>Sediment notes</dt>
          <dd class="format">${station.notesSediment}</dd>
        </div>
      </c:if>

      <c:if test="${not empty station.nosContainers}">
        <div class="station-details-meta-item">
          <dt>Number of containers</dt>
          <dd class="format">${station.nosContainers}</dd>
        </div>
      </c:if>

      <c:if test="${not empty station.totalSampleSize}">
        <div class="station-details-meta-item">
          <dt>Total sample size</dt>
          <dd>${station.totalSampleSize}</dd>
        </div>
      </c:if>

      <c:if test="${not empty station.shipDirection}">
        <div class="station-details-meta-item">
          <dt>Ship direction</dt>
          <dd>${station.shipDirection}</dd>
        </div>
      </c:if>

      <c:if test="${not empty station.shipSpeed}">
        <div class="station-details-meta-item">
          <dt>Ship speed</dt>
          <dd>${station.shipSpeed}</dd>
        </div>
      </c:if>

      <c:if test="${not empty station.cruiseLogEvent}">
        <div class="station-details-meta-item">
          <dt>Cruise log event</dt>
          <dd>${station.cruiseLogEvent}</dd>
        </div>
      </c:if>

      <c:if test="${not empty station.warpLength}">
        <div class="station-details-meta-item">
          <dt>Warp length</dt>
          <dd>${station.warpLength}</dd>
        </div>
      </c:if>

      <c:if test="${not empty station.bottomTemperature}">
        <div class="station-details-meta-item">
          <dt>Bottom temperature</dt>
          <dd>${station.bottomTemperature}</dd>
        </div>
      </c:if>

      <c:if test="${not empty station.bottomSalinity}">
        <div class="station-details-meta-item">
          <dt>Bottom salinity</dt>
          <dd>${station.bottomSalinity}</dd>
        </div>
      </c:if>

    </dl>
  </div>

  <%-- FOOTER ACTIONS: preserve all authorize + type branches from legacy table --%>
  <footer class="station-details-actions">

    <sec:authorize access="hasAnyRole('ROLE_stationEditor','ROLE_catchEditor','ROLE_videoEditor')">
      <c:if test="${type ne 2 && type ne 6 && type ne 7}">
        <a class="station-details-actions__link station-details-actions__link--primary"
           href="catch?cruise=${station.cruiseNo}&ref=${station.refstationNo}&sample=${station.sampleNo}&equipment=${station.equipment}&station_no=${station.stationNo}">
          View catch details
        </a>
      </c:if>
      <c:if test="${type eq 7 || type eq 3 || type eq 9}">
        <a class="station-details-actions__link station-details-actions__link--primary"
           href="sedimentcore?cruise=${station.cruiseNo}&ref=${station.refstationNo}&sample=${station.sampleNo}&equipment=${station.equipment}&station_no=${station.stationNo}">
          View core details
        </a>
        <a class="station-details-actions__link station-details-actions__link--tertiary"
           href="sedimentLogg?cruise=${station.cruiseNo}&ref=${station.refstationNo}&sample=${station.sampleNo}&equipment=${station.equipment}&station=${station.stationNo}">
          Download core details
        </a>
      </c:if>
      <c:if test="${type eq 2}">
        <a class="station-details-actions__link station-details-actions__link--primary"
           href="video_raw?cruise=${station.cruiseNo}&ref=${station.refstationNo}&sample=${station.sampleNo}">
          View video details
        </a>
      </c:if>
    </sec:authorize>

    <sec:authorize access="hasAnyRole('ROLE_stationEditor', 'ROLE_videoEditor', 'ROLE_geologyEditor')">
      <a class="station-details-actions__link station-details-actions__link--secondary"
         href="editstation?cruiseNo=${station.cruiseNo}&refstationNo=${station.refstationNo}&sampleNo=${station.sampleNo}&equipment=${station.equipment}&stationNo=${station.stationNo}">
        Edit station
      </a>
    </sec:authorize>

  </footer>

</article>
```

### 4.2 Optional header tag

The prototype shows e.g. `25 May 2006 · 5 min station`. The legacy table does **not** compute duration. Options:

1. **Omit** `station-details-header__tag` (simplest).
2. **Show start time only** (example in 4.1).
3. **Add server-side duration** later and print it in the tag.

Do not block the rest of the work on duration logic.

### 4.3 Empty metadata rows

**Do not** render metadata `<div class="station-details-meta-item">` when the value is blank — use `<c:if test="${not empty ...}">` as above.

Rationale: Proposal 1 hides empty metadata via CSS `:has(dd.empty)` in the HTML demo; that selector is **not** reliable in older browsers. JSP omission is the correct approach for this stack.

Inside **Start/Stop cards**, still render Shiplog rows but use `station-details-empty` when null (cards have a fixed field set).

### 4.4 Preserve existing helper classes

| Class | Keep on | Reason |
|-------|---------|--------|
| `latlon` | Position `<dd>` | Existing monospace / formatting rules may apply |
| `format` | Notes / sediment / containers `<dd>` | Pre-wrap or whitespace rules for free text |

Scope new rules under `.station-details-panel` so legacy table selectors do not leak.

### 4.5 Single-column layout when Stop is hidden

When `type` is 3, 4, 7, or 8, only the Start card is rendered. Add modifier on the grid from JSP:

```jsp
<div class="station-details-pair-grid${type eq 3 || type eq 4 || type eq 7 || type eq 8 ? ' station-details-pair-grid--single' : ''}">
```

CSS for `--single` is in section 5.

### 4.6 Footer with zero or one action

If `sec:authorize` hides all links, the footer may be empty. Either:

- Wrap `<footer class="station-details-actions">` in `<c:if>` that checks the same role/type conditions, **or**
- Use CSS `:empty { display: none; }` on the footer.

Prefer explicit `<c:if>` when possible so you do not render an empty bar.

### 4.7 Multiple primary actions

For sediment types, two links appear (View core + Download). Use `--primary` for the main navigation link and `--tertiary` for download. When both show, `flex-wrap` on the footer stacks them on narrow widths (section 5).

---

## 5. CSS to append (single file)

Copy the block below into the project stylesheet. Tune colors only if the app has existing brand variables — map `--station-details-accent` to the site link color if one exists.

```css
/* ==========================================================================
   Station details panel (Proposal 1 — card layout)
   Replaces .stationDetailsTable presentation; markup is article-based.
   ========================================================================== */

.station-details-panel {
  --station-details-surface: #fff;
  --station-details-text: #15202b;
  --station-details-muted: #64748b;
  --station-details-border: #e2e8f0;
  --station-details-start: #0d6e4f;
  --station-details-stop: #b45309;
  --station-details-accent: #0d5c8c;

  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  background: var(--station-details-surface);
  border: 1px solid var(--station-details-border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  color: var(--station-details-text);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.45;
}

/* Header */
.station-details-header {
  padding: 1.25rem 1.35rem;
  border-bottom: 1px solid var(--station-details-border);
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
}

.station-details-header__label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--station-details-muted);
}

.station-details-header__value {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
  margin-top: 0.15rem;
}

.station-details-header__tag {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.7rem;
  color: var(--station-details-muted);
  background: #f1f5f9;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

/* Body */
.station-details-body {
  padding: 1.15rem 1.35rem 1.35rem;
}

/* Start / Stop cards */
.station-details-pair-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}

.station-details-pair-grid--single {
  grid-template-columns: 1fr;
}

@media (max-width: 420px) {
  .station-details-pair-grid {
    grid-template-columns: 1fr;
  }
}

.station-details-card {
  border: 1px solid var(--station-details-border);
  border-radius: 10px;
  overflow: hidden;
}

.station-details-card__head {
  padding: 0.55rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.station-details-card--start .station-details-card__head {
  background: #ecfdf5;
  color: var(--station-details-start);
  border-bottom: 1px solid #a7f3d0;
}

.station-details-card--stop .station-details-card__head {
  background: #fff7ed;
  color: var(--station-details-stop);
  border-bottom: 1px solid #fed7aa;
}

.station-details-card dl {
  margin: 0;
  padding: 0.5rem 0.85rem 0.65rem;
}

.station-details-card__row {
  display: grid;
  grid-template-columns: 5.5rem 1fr;
  gap: 0.35rem 0.5rem;
  padding: 0.35rem 0;
  font-size: 0.82rem;
  border-bottom: 1px solid #f1f5f9;
}

.station-details-card__row:last-child {
  border-bottom: none;
}

.station-details-card__row dt {
  margin: 0;
  font-weight: 600;
  color: var(--station-details-muted);
}

.station-details-card__row dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.station-details-empty {
  color: #94a3b8;
  font-style: italic;
}

/* Metadata */
.station-details-section-title {
  margin: 1.15rem 0 0.55rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--station-details-muted);
}

.station-details-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
  margin: 0;
  padding: 0;
}

@media (max-width: 420px) {
  .station-details-meta-grid {
    grid-template-columns: 1fr;
  }
}

.station-details-meta-item {
  font-size: 0.82rem;
  padding: 0.4rem 0;
}

.station-details-meta-item--full {
  grid-column: 1 / -1;
  padding: 0.65rem 0.75rem;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 3px solid var(--station-details-accent);
}

.station-details-meta-item dt {
  font-weight: 600;
  color: var(--station-details-muted);
  font-size: 0.75rem;
  margin: 0 0 0.15rem;
}

.station-details-meta-item dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

/* Footer actions */
.station-details-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  padding: 1rem 1.35rem 1.2rem;
  border-top: 1px solid var(--station-details-border);
  background: #f8fafc;
}

.station-details-actions:empty {
  display: none;
}

.station-details-actions__link {
  flex: 1 1 8rem;
  text-align: center;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  box-sizing: border-box;
}

.station-details-actions__link--primary {
  background: var(--station-details-accent);
  color: #fff;
}

.station-details-actions__link--primary:hover,
.station-details-actions__link--primary:focus {
  background: #0a4a6f;
  color: #fff;
}

.station-details-actions__link--secondary {
  background: #fff;
  color: var(--station-details-accent);
  border: 1px solid var(--station-details-border);
}

.station-details-actions__link--secondary:hover,
.station-details-actions__link--secondary:focus {
  border-color: var(--station-details-accent);
  color: var(--station-details-accent);
}

.station-details-actions__link--tertiary {
  background: transparent;
  color: var(--station-details-accent);
  border: 1px dashed var(--station-details-border);
  flex: 1 1 100%;
}

.station-details-actions__link--tertiary:hover,
.station-details-actions__link--tertiary:focus {
  border-color: var(--station-details-accent);
}

/* Optional: if .format / .latlon existed only for the old table, reinforce inside panel */
.station-details-panel .format {
  white-space: pre-wrap;
  word-break: break-word;
}
```

### 5.1 Legacy table cleanup (after QA)

When the new panel is live, search the CSS file for rules tied to:

- `.stationDetailsTable`
- `.stationDetailsTable .heading`
- `.stationDetailsTable .border_top`
- `.stationDetailsTable .center`
- `.stationDetailsTable td`

Remove or comment them only after no page references the old table.

### 5.2 Parent container width

The prototype uses `max-width: 520px`. If the panel sits in a wide content column, either:

- Keep `max-width` on `.station-details-panel`, or
- Remove `max-width` and let it fill the parent.

Match surrounding layout conventions on the station page.

---

## 6. Mapping: old table rows → new structure

| Legacy row | New location |
|------------|----------------|
| Sample | `station-details-header` |
| `border_top` | *(removed — visual separation via cards)* |
| Start time | Start card → Time |
| Latitude + Longitude | Start card → Position (combined) |
| Depth | Start card → Depth (`bottomDepthStart`) |
| Shiplog start | Start card → Shiplog |
| Stop block (`c:if type`) | Stop card (entire section) |
| Notes | Meta grid, `--full`, if not empty |
| Sediment notes | Meta grid, `--full`, if not empty |
| Number of containers | Meta item, if not empty |
| Total sample size | Meta item, if not empty |
| Ship direction / speed / cruise log / warp / temp / salinity | Meta items, if not empty |
| Action `<tr><td class="center">` rows | `footer.station-details-actions` links |

---

## 7. Implementation checklist (for Copilot)

Copy this checklist into the PR or task description:

- [ ] Replace `<table class="stationDetailsTable">` with JSP in section 4
- [ ] Add `station-details-pair-grid--single` when stop section is omitted
- [ ] Append CSS block from section 5 to the single project stylesheet
- [ ] Verify `latlon` and `format` still look correct inside the panel
- [ ] Test `type` values: 2 (video link), 3/7/9 (core + download), types without stop (3,4,7,8)
- [ ] Test roles: user with no roles sees no footer; stationEditor sees Edit; catchEditor sees View catch
- [ ] Test empty shiplog stop → “Not recorded” italic text
- [ ] Test empty metadata → rows not rendered (not blank rows)
- [ ] Responsive: narrow viewport stacks Start/Stop cards vertically
- [ ] Remove obsolete `.stationDetailsTable` CSS when confirmed unused

---

## 8. Visual QA reference

Open `proposal-1-cards.html` locally and compare:

- Header sample number size and label styling
- Green Start / amber Stop card headers
- Two-column metadata grid; Notes spans full width with left accent bar
- Footer: filled primary button + outlined secondary button

Screenshot diff against the old table on at least one station with full data and one with empty shiplog stop and sparse metadata.

---

## 9. Copilot prompt (paste as-is)

Use this block when handing off to another agent:

```text
Implement Station Details Proposal 1 (card layout) in our JSP + single CSS app.

Read: temp-delete-later/station-detail-proposals/IMPLEMENTATION-proposal-1.md
Visual reference: temp-delete-later/station-detail-proposals/proposal-1-cards.html

Tasks:
1. Replace the existing <table class="stationDetailsTable"> with the JSP fragment in section 4 of the markdown file. Keep all c:if, fmt:formatDate, and sec:authorize logic identical to the current table.
2. Append the CSS from section 5 to our main stylesheet (no Tailwind, no new frameworks).
3. Use station-details-* class names; preserve latlon and format classes where noted.
4. Omit empty metadata fields with JSTL c:if, not CSS :has().
5. Add station-details-pair-grid--single when the stop card is not rendered.
6. Map footer links to --primary / --secondary / --tertiary as documented.
7. Run through the checklist in section 7.

Do not change backend models or controllers unless required for empty-string vs null in JSTL tests.
```

---

## 10. Notes on `empty` in JSTL

`${not empty station.notes}` is false for `null`, `""`, and empty collections. If the application prints whitespace-only strings, trim in the controller or use a custom tag; otherwise blank notes may still render a row.

Numeric `0` is **not** empty in JSTL — temperature `0` and direction `0` must still display. Do not use `empty` for numeric fields if zero is valid; use explicit null checks if needed.

---

*Document version: 2026-06-03 — aligned with `proposal-1-cards.html` in this directory.*
