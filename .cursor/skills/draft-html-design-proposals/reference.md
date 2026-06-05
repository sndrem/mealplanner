# HTML proposal templates

Copy and adapt filenames, titles, and column count. Replace `N` with the number of proposals.

## `index.html` skeleton

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>[Feature] — design proposals</title>
    <style>
      :root {
        --bg: #f4f6f8;
        --surface: #fff;
        --text: #1a2332;
        --muted: #5c6b7a;
        --border: #d8e0e8;
        --accent: #0d5c8c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.5;
        padding: 2rem 1.5rem 3rem;
      }
      .wrap { max-width: 42rem; margin: 0 auto; }
      h1 { font-size: 1.5rem; font-weight: 650; margin: 0 0 0.35rem; }
      .lead { color: var(--muted); margin: 0 0 2rem; font-size: 0.95rem; }
      nav { display: flex; flex-direction: column; gap: 0.75rem; }
      a.card-link {
        display: block;
        padding: 1rem 1.15rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 10px;
        text-decoration: none;
        color: inherit;
      }
      a.card-link:hover {
        border-color: var(--accent);
        box-shadow: 0 4px 14px rgba(13, 92, 140, 0.1);
      }
      a.card-link strong {
        display: block;
        color: var(--accent);
        font-size: 1.05rem;
        margin-bottom: 0.2rem;
      }
      a.card-link span { color: var(--muted); font-size: 0.88rem; }
      .compare { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
      a.compare-link { font-weight: 600; color: var(--accent); text-decoration: none; }
      .back { margin-top: 2rem; font-size: 0.85rem; color: var(--muted); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>[Feature] — design proposals</h1>
      <p class="lead">[One line: what is being compared and what data is shared.]</p>
      <nav>
        <a class="card-link" href="proposal-1-[slug].html">
          <strong>Proposal 1 — [Name]</strong>
          <span>[One-line description]</span>
        </a>
        <!-- repeat for proposal-2, proposal-3 -->
      </nav>
      <div class="compare">
        <a class="compare-link" href="compare-all.html">Compare all side by side →</a>
      </div>
      <p class="back">Folder: <code>temp-delete-later/[slug]-proposals/</code></p>
    </div>
  </body>
</html>
```

## `compare-all.html` skeleton

Adjust `grid-template-columns` to `repeat(2, …)` or `repeat(3, …)`. Duplicate `.col` blocks per proposal.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Compare all proposals</title>
    <style>
      :root {
        --bg: #e8edf2;
        --text: #1a2332;
        --muted: #5c6b7a;
        --accent: #0d5c8c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        background: var(--bg);
        color: var(--text);
        min-height: 100vh;
      }
      header.page {
        padding: 1.25rem 1.5rem;
        background: #fff;
        border-bottom: 1px solid #d0dae4;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      header.page h1 { margin: 0; font-size: 1.2rem; }
      header.page p { margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--muted); }
      header.page a { color: var(--accent); font-weight: 600; text-decoration: none; }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(280px, 1fr));
        gap: 1rem;
        padding: 1.25rem;
        align-items: start;
      }
      @media (max-width: 1100px) {
        .grid {
          grid-template-columns: 1fr;
          max-width: 520px;
          margin: 0 auto;
        }
      }
      .col { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
      .col-label { font-size: 0.8rem; font-weight: 700; color: var(--accent); }
      .col-label a { color: inherit; text-decoration: none; }
      .frame-wrap {
        background: #fff;
        border-radius: 10px;
        border: 1px solid #d0dae4;
        overflow: hidden;
        box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
      }
      iframe {
        display: block;
        width: 100%;
        height: 720px;
        border: 0;
        background: #fff;
      }
      @media (max-width: 1100px) {
        iframe { height: 680px; }
      }
    </style>
  </head>
  <body>
    <header class="page">
      <h1>Side-by-side comparison</h1>
      <p><a href="index.html">← Back to index</a> · Stacks below ~1100px width.</p>
    </header>
    <div class="grid">
      <div class="col">
        <div class="col-label">
          <a href="proposal-1-[slug].html" target="_blank" rel="noopener">Proposal 1 — [Short]</a>
        </div>
        <div class="frame-wrap">
          <iframe title="Proposal 1 — [Name]" src="proposal-1-[slug].html" loading="lazy"></iframe>
        </div>
      </div>
      <!-- duplicate .col per proposal -->
    </div>
  </body>
</html>
```

## Single `proposal-*.html` shell

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Proposal 1 — [Name]</title>
    <style>
      :root {
        --bg: #eef2f6;
        --surface: #fff;
        --text: #15202b;
        --muted: #64748b;
        --border: #e2e8f0;
        --accent: #0d5c8c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        background: var(--bg);
        color: var(--text);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .nav-top {
        width: 100%;
        max-width: 520px;
        margin-bottom: 1rem;
        font-size: 0.85rem;
      }
      .nav-top a { color: var(--accent); text-decoration: none; }
      .panel {
        width: 100%;
        max-width: 520px;
        background: var(--surface);
        border-radius: 12px;
        border: 1px solid var(--border);
        overflow: hidden;
      }
      /* variant-specific layout below */
    </style>
  </head>
  <body>
    <p class="nav-top"><a href="index.html">← All proposals</a></p>
    <article class="panel" aria-label="[Component name] mock">
      <!-- hardcoded fixture markup -->
    </article>
  </body>
</html>
```

## In-repo example

See `temp-delete-later/station-detail-proposals/` for a complete three-variant set (index, compare-all, proposals).
