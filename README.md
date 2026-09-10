# Pipsy

A personal research archive for publishing tagged research notes. Plain HTML, CSS, and JavaScript — no build step, no backend, no dependencies beyond a Google Fonts import.

## Viewing the site

Just open `index.html` in a browser, or enable GitHub Pages on this repo (Settings → Pages → Deploy from branch `main` / root) and it will be live with no configuration.

## Adding a new note

Open `index.html` and find the `<section class="grid" id="note-grid">`. Copy one of the existing `<article class="note-card">` blocks and edit:

| Field | Where | Notes |
|---|---|---|
| Year | `data-year` attribute | e.g. `"2015"` |
| Industry | `data-industry` attribute | e.g. `"automotive"`, `"fmcg"`, `"tech"` — lowercase, becomes a filter chip automatically |
| Geography | `data-geography` attribute | e.g. `"india"`, `"usa"`, `"global"` — lowercase, becomes a filter chip automatically |
| Search keywords | `data-search` attribute | lowercase words the search box should match, beyond the title/summary |
| Author | `data-author` attribute | shown as the byline |
| Date | `data-date` attribute | shown as the byline, e.g. `"12 Mar 2015"` |
| Title | `<h2 class="card-title">` | |
| Byline (visible) | `<p class="card-byline">` | keep in sync with the author/date attributes |
| Short summary | `<p class="card-summary">` | one paragraph, shown on the card |
| Full text | `<template class="card-body"><p>…</p></template>` | the long-form content shown in the pop-up when the card is clicked. Add as many `<p>` paragraphs as you like. |

New industries/geographies/years show up as filter chips automatically — nothing else to edit. Delete a card to remove a note.

No build step is required. Save the file and refresh the page.
