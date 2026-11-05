# Pipsy

A personal research archive of written notes and PDFs. Plain HTML, CSS and JavaScript: no build step, no backend, no database. GitHub Pages serves it as it is.

## How it works

- `notes.json` holds every note. `script.js` loads it and draws the catalogue.
- Each note has its own page at `#/note/<slug>`. Series have a page at `#/series/<slug>`. These are hash links, so they work on GitHub Pages without any server setup.
- PDFs are ordinary files in the `pdfs/` folder. A note points to its PDF with the `pdf` field.

## Adding a written note

Add an object to the `notes` list in `notes.json`:

| Field | Required | Notes |
|---|---|---|
| `title` | yes | |
| `year` | yes | The year the note is about, for example `"2015"`. Drives the timeline. |
| `industry` | yes | Lowercase, for example `"automotive"`. Becomes a filter automatically. |
| `geography` | yes | Lowercase, for example `"india"`. Becomes a filter automatically. |
| `summary` | yes | One short paragraph, shown in the catalogue. |
| `body` | yes for written notes | Paragraphs separated by a blank line. |
| `author`, `date` | no | `date` like `"12 Mar 2015"`. Used for ordering within a year. |
| `search` | no | Extra lowercase keywords for the search box. The body is searched too. |
| `slug` | no | URL name. Made from the title when left out. Keep it stable once shared. |

Body formatting is cleaned up when the page is drawn: rows of `====` are dropped, and a line written in ALL CAPS becomes a heading (the leading emoji is removed). Lines starting with a bullet become a list.

## Adding a PDF

1. Save the file in `pdfs/`. Use a plain name such as `royal-enfield-playbook.pdf`. Letters, numbers, dashes and underscores only.
2. Add a note to `notes.json` with the usual fields plus:

```json
{
  "title": "Royal Enfield: Territory Playbook",
  "year": "2026",
  "industry": "automotive",
  "geography": "india",
  "author": "RJ",
  "date": "5 Nov 2026",
  "summary": "What the PDF covers, in two sentences.",
  "search": "keywords that appear inside the pdf",
  "body": "",
  "pdf": "pdfs/royal-enfield-playbook.pdf",
  "pages": 12
}
```

`body` can be left empty. Browsers cannot search inside a PDF, so put the main keywords in `search`, or paste the extracted text into `body`.

On desktop the PDF is shown on the note page with a Download button. On phones only the buttons show, because phones do not display PDFs inline reliably.

Limits: GitHub rejects files over 100 MB, and the whole site should stay under about 1 GB. Aim for PDFs under 25 MB so pages stay quick.

## Series

Notes whose title looks like `Name 2/4 — Title` are grouped into one series automatically. To group notes with other titles, give them the same `series` value and a `part` number.

## Running it locally

```
python -m http.server 4173
```

Then open http://localhost:4173. Opening `index.html` directly will not work, because browsers block `fetch` on `file://` pages.
