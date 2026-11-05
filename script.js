/* ==========================================================================
   Pipsy — catalogue, filters, per-note pages and PDF notes.
   No frameworks, no build step. Notes are loaded from notes.json.

   Optional note fields (all existing notes keep working without them):
     slug    URL-safe id. Generated from the title when absent.
     pdf     Path to a PDF inside the repo, e.g. "pdfs/royal-enfield.pdf".
     pages   Page count of the PDF, shown on the page.
     series  Series name. When absent, titles like "Name 2/4 — Title" are
             grouped automatically.
   Pages use hash URLs (#/note/<slug>) so they work on GitHub Pages.
   ========================================================================== */

(function () {
  "use strict";

  // ---------- helpers ----------

  var LABEL_OVERRIDES = { fmcg: "FMCG", usa: "USA", uk: "UK", b2b: "B2B", b2c: "B2C" };

  function formatLabel(value) {
    if (Object.prototype.hasOwnProperty.call(LABEL_OVERRIDES, value)) return LABEL_OVERRIDES[value];
    return String(value).split(/[-_\s]+/).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(" ");
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] === null || attrs[k] === undefined || attrs[k] === false) return;
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function slugify(text) {
    return String(text).toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "note";
  }

  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  function dateValue(note) {
    var m = String(note.date || "").match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/);
    if (m) return Date.UTC(+m[3], MONTHS[m[2].toLowerCase()] || 0, +m[1]);
    return Date.UTC(+note.year || 0, 0, 1);
  }

  // Only plain relative paths to .pdf files are allowed (no schemes, no "..").
  function safePdfPath(path) {
    if (typeof path !== "string") return null;
    if (!/^[A-Za-z0-9_\-./ %]+\.pdf$/i.test(path)) return null;
    if (path.charAt(0) === "/" || path.indexOf("..") !== -1) return null;
    return path;
  }

  // ---------- note body cleanup (done at render time, notes.json is untouched) ----------

  var EMOJI_LEAD = /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\s]+/u;
  var RULE_LINE = /^[=\-_*#~\s]{3,}$/;
  var SMALL_WORDS = { a: 1, an: 1, and: 1, as: 1, at: 1, but: 1, by: 1, for: 1, in: 1, is: 1, it: 1, of: 1, on: 1, or: 1, the: 1, to: 1, vs: 1, with: 1 };
  var ACRONYMS = {
    "tl;dr": "TL;DR", nasa: "NASA", isro: "ISRO", spacex: "SpaceX", usa: "USA", uk: "UK",
    fmcg: "FMCG", ckd: "CKD", pslv: "PSLV", gslv: "GSLV", sslv: "SSLV", ev: "EV", gst: "GST", hal: "HAL"
  };

  function isAllCapsLine(text) {
    var letters = text.replace(/[^A-Za-z]/g, "");
    return letters.length >= 3 && letters === letters.toUpperCase();
  }

  var LETTER_LABEL_AFTER = { type: 1, part: 1, option: 1, plan: 1, tier: 1, class: 1, group: 1, case: 1, section: 1, appendix: 1 };

  function titleCaseWord(word, isFirst, prev) {
    var bare = word.replace(/^[^A-Za-z0-9;]+|[^A-Za-z0-9;]+$/g, "").toLowerCase();
    if (ACRONYMS[bare]) return word.replace(new RegExp(bare.replace(/[;]/g, "\\;"), "i"), ACRONYMS[bare]);
    if (/[A-Z][0-9]|[0-9][A-Z]|&/.test(word) && word === word.toUpperCase()) return word;   // HEX20, LVM3, HAL-L&T
    // A lone capital stays capital when it labels something ("Type B"); "A" mid-sentence is the article.
    if (/^[A-Z]$/.test(word) && (word !== "A" || isFirst || LETTER_LABEL_AFTER[prev])) return word;
    if (word.indexOf("-") > 0) {                                                // SPACEX-NASA, FIVE-STEP
      return word.split("-").map(function (part, i) {
        return part ? titleCaseWord(part, isFirst && i === 0) : part;
      }).join("-");
    }
    if (!isFirst && SMALL_WORDS[bare]) return word.toLowerCase();
    return word.toLowerCase().replace(/(^|[–—(])([a-z])/g, function (_, pre, ch) {
      return pre + ch.toUpperCase();
    });
  }

  function cleanHeading(raw) {
    var text = raw.replace(EMOJI_LEAD, "").trim();
    var startsPhrase = true;
    var prev = "";
    return text.split(/\s+/).map(function (w) {
      var out = titleCaseWord(w, startsPhrase, prev);
      prev = w.toLowerCase().replace(/[^a-z]/g, "");
      // A phrase starts after "5." style numbering, a colon, or a dash.
      startsPhrase = /^\d+[.)]$/.test(w) || /[:—–]$/.test(w) || w === "—" || w === "–";
      return out;
    }).join(" ");
  }

  var BULLET = /^\s*[•●▪\-*–]\s+/;

  function renderBody(body) {
    var frag = document.createDocumentFragment();
    String(body || "").split(/\n\s*\n/).forEach(function (block) {
      var text = block.trim();
      if (!text || RULE_LINE.test(text)) return;

      var firstLine = text.split("\n")[0].trim();
      if (text.indexOf("\n") === -1 && text.length < 100 && isAllCapsLine(text.replace(EMOJI_LEAD, ""))) {
        frag.appendChild(el("h3", { class: "body-heading", text: cleanHeading(text) }));
        return;
      }

      var lines = text.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      var bullets = lines.filter(function (l) { return BULLET.test(l); });
      if (bullets.length === lines.length) {
        frag.appendChild(el("ul", { class: "body-list" }, lines.map(function (l) {
          return el("li", { text: l.replace(BULLET, "") });
        })));
        return;
      }

      var p = el("p");
      lines.forEach(function (l, i) {
        if (i > 0) p.appendChild(document.createElement("br"));
        p.appendChild(document.createTextNode(l));
      });
      frag.appendChild(p);
    });
    return frag;
  }

  // ---------- data ----------

  var notes = [];      // normalised notes
  var series = {};     // slug -> { slug, name, parts: [note] }
  var items = [];      // catalogue items: single notes and series

  var SERIES_TITLE = /^(.+?)\s+(\d+)\s*\/\s*(\d+)\s+[—–-]\s+(.+)$/;

  function normalise(raw, index) {
    var note = {
      raw: raw,
      title: raw.title || "Untitled",
      year: String(raw.year || ""),
      industry: raw.industry || "",
      geography: raw.geography || "",
      author: raw.author || "",
      date: raw.date || "",
      summary: raw.summary || "",
      body: raw.body || "",
      searchExtra: raw.search || "",
      pdf: safePdfPath(raw.pdf),
      pages: raw.pages ? parseInt(raw.pages, 10) || null : null,
      slug: raw.slug ? slugify(raw.slug) : slugify(raw.title || "note-" + index),
      seriesName: raw.series || null,
      part: raw.part ? parseInt(raw.part, 10) : null,
      partTotal: null,
      shortTitle: null
    };
    note.type = note.pdf ? "pdf" : "note";

    var m = note.title.match(SERIES_TITLE);
    if (m) {
      if (!note.seriesName) note.seriesName = m[1].trim();
      if (!note.part) note.part = parseInt(m[2], 10);
      note.partTotal = parseInt(m[3], 10);
      note.shortTitle = m[4].trim();
    }
    note.time = dateValue(note);
    note.haystack = (note.title + " " + note.summary + " " + note.searchExtra + " " + note.body).toLowerCase();
    return note;
  }

  function buildModel(rawNotes) {
    var used = {};
    notes = rawNotes.map(normalise);
    notes.forEach(function (n) {
      var base = n.slug, i = 2;
      while (used[n.slug]) n.slug = base + "-" + i++;
      used[n.slug] = true;
    });

    series = {};
    notes.forEach(function (n) {
      if (!n.seriesName) return;
      var key = slugify(n.seriesName);
      if (!series[key]) series[key] = { slug: key, name: n.seriesName, parts: [] };
      series[key].parts.push(n);
      n.seriesSlug = key;
    });
    Object.keys(series).forEach(function (key) {
      var s = series[key];
      if (s.parts.length < 2) {           // a "series" of one is just a note
        s.parts[0].seriesName = null;
        s.parts[0].seriesSlug = null;
        delete series[key];
        return;
      }
      s.parts.sort(function (a, b) { return (a.part || 0) - (b.part || 0) || a.time - b.time; });
      s.time = Math.max.apply(null, s.parts.map(function (p) { return p.time; }));
      s.year = String(Math.max.apply(null, s.parts.map(function (p) { return +p.year || 0; })));
    });

    items = [];
    var seen = {};
    notes.forEach(function (n) {
      if (n.seriesSlug) {
        if (seen[n.seriesSlug]) return;
        seen[n.seriesSlug] = true;
        items.push({ kind: "series", series: series[n.seriesSlug], time: series[n.seriesSlug].time, year: series[n.seriesSlug].year });
      } else {
        items.push({ kind: "note", note: n, time: n.time, year: n.year });
      }
    });
    items.sort(function (a, b) { return b.time - a.time; });
  }

  // ---------- filters ----------

  var active = { industry: new Set(), geography: new Set(), year: new Set(), type: new Set() };
  var query = "";

  function noteMatches(n, skipKey) {
    var ok = Object.keys(active).every(function (key) {
      if (key === skipKey || active[key].size === 0) return true;
      return active[key].has(n[key]);
    });
    if (!ok) return false;
    return !query || n.haystack.indexOf(query) !== -1;
  }

  function anyFilter() {
    return query.length > 0 || Object.keys(active).some(function (k) { return active[k].size > 0; });
  }

  // ---------- catalogue view ----------

  var viewList = document.getElementById("view-list");
  var viewNote = document.getElementById("view-note");
  var catalogue = document.getElementById("catalogue");
  var searchInput = document.getElementById("search-input");
  var resultCount = document.getElementById("result-count");
  var emptyState = document.getElementById("empty-state");
  var clearBtn = document.getElementById("clear-filters");
  var timelineEl = document.getElementById("timeline");
  var filtersPanel = document.getElementById("filters-panel");

  function tagLine(values) {
    var wrap = el("span", { class: "tags" });
    values.filter(Boolean).forEach(function (v) { wrap.appendChild(el("span", { class: "tag", text: formatLabel(v) })); });
    return wrap;
  }

  function uniq(list) {
    return list.filter(function (v, i) { return v && list.indexOf(v) === i; });
  }

  function pdfLabel(n) {
    return n.pages ? "PDF, " + n.pages + (n.pages === 1 ? " page" : " pages") : "PDF";
  }

  function marker(kind, text) {
    return el("span", { class: "mark mark-" + kind, text: text });
  }

  function renderRow(item, matchingParts) {
    var href, title, summary, meta, marks = [];
    if (item.kind === "series") {
      var s = item.series;
      href = "#/series/" + s.slug;
      title = s.name;
      summary = s.parts[0].summary;
      marks.push(marker("series", s.parts.length + " parts"));
      var latest = s.parts.slice().sort(function (a, b) { return b.time - a.time; })[0];
      meta = [s.parts[0].author, latest.date].filter(Boolean);
      var industries = uniq(s.parts.map(function (p) { return p.industry; }));
      var geos = uniq(s.parts.map(function (p) { return p.geography; }));
      return el("li", { class: "row" }, [
        el("a", { class: "row-link", href: href }, [
          el("h3", { class: "row-title" }, [title, " ", marks[0]]),
          el("p", { class: "row-summary", text: summary }),
          el("p", { class: "row-meta" }, [el("span", { class: "byline", text: meta.join(", ") }), tagLine(industries.concat(geos))])
        ])
      ]);
    }
    var n = item.note;
    href = "#/note/" + n.slug;
    if (n.pdf) marks.push(marker("pdf", pdfLabel(n)));
    return el("li", { class: "row" }, [
      el("a", { class: "row-link", href: href }, [
        el("h3", { class: "row-title" }, [n.title].concat(marks.length ? [" ", marks[0]] : [])),
        el("p", { class: "row-summary", text: n.summary }),
        el("p", { class: "row-meta" }, [
          el("span", { class: "byline", text: [n.author, n.date].filter(Boolean).join(", ") }),
          tagLine([n.industry, n.geography])
        ])
      ])
    ]);
  }

  function renderCatalogue() {
    var visible = 0;
    var byYear = {};
    var years = [];

    items.forEach(function (item) {
      var shown = item.kind === "series"
        ? item.series.parts.filter(function (p) { return noteMatches(p); }).length > 0
        : noteMatches(item.note);
      if (!shown) return;
      if (!byYear[item.year]) { byYear[item.year] = []; years.push(item.year); }
      byYear[item.year].push(item);
    });

    notes.forEach(function (n) { if (noteMatches(n)) visible++; });
    years.sort(function (a, b) { return +b - +a; });

    catalogue.textContent = "";
    years.forEach(function (year) {
      var list = el("ol", { class: "rows" });
      byYear[year].forEach(function (item) { list.appendChild(renderRow(item)); });
      catalogue.appendChild(el("section", { class: "year-group", "aria-labelledby": "y-" + year }, [
        el("h2", { class: "year-heading", id: "y-" + year, text: year }),
        list
      ]));
    });

    resultCount.textContent = "Showing " + visible + " of " + notes.length + " notes";
    emptyState.hidden = visible !== 0;
    clearBtn.hidden = !anyFilter();
  }

  var FILTER_KEYS = ["industry", "geography", "type"];

  function valuesFor(key) {
    var vals = uniq(notes.map(function (n) { return n[key]; }));
    if (key === "type") return vals.sort();
    return vals.sort(function (a, b) { return formatLabel(a).localeCompare(formatLabel(b)); });
  }

  function typeLabel(v) { return v === "pdf" ? "PDFs" : "Written notes"; }

  function renderFilters() {
    FILTER_KEYS.forEach(function (key) {
      var host = document.getElementById(key + "-chips");
      host.textContent = "";
      var values = valuesFor(key);
      host.parentNode.hidden = key === "type" && values.length < 2;   // nothing to choose between
      values.forEach(function (value) {
        var count = notes.filter(function (n) { return n[key] === value && noteMatches(n, key); }).length;
        var on = active[key].has(value);
        var btn = el("button", { type: "button", class: "filter-btn" + (on ? " active" : ""), "aria-pressed": on ? "true" : "false" }, [
          el("span", { class: "filter-name", text: key === "type" ? typeLabel(value) : formatLabel(value) }),
          el("span", { class: "filter-count", text: String(count) })
        ]);
        btn.addEventListener("click", function () { toggle(key, value); });
        host.appendChild(btn);
      });
    });
  }

  function renderTimeline() {
    timelineEl.textContent = "";
    var years = uniq(notes.map(function (n) { return n.year; })).filter(Boolean).sort();
    if (years.length < 2) { timelineEl.hidden = true; return; }
    timelineEl.hidden = false;

    var min = +years[0], max = +years[years.length - 1];
    var track = el("div", { class: "tl-track" });
    var width = timelineEl.clientWidth || 800;

    // Decide which years get a text label, newest first, so crowded years
    // never hide the most recent one.
    var labelled = {};
    var lastLabelX = Infinity;
    years.slice().reverse().forEach(function (year) {
      var px = ((+year - min) / (max - min)) * width;
      if (lastLabelX - px >= 56) { labelled[year] = true; lastLabelX = px; }
      else if (lastLabelX === Infinity) { labelled[year] = true; lastLabelX = px; }
    });

    years.forEach(function (year) {
      var x = ((+year - min) / (max - min)) * 100;
      var count = notes.filter(function (n) { return n.year === year && noteMatches(n, "year"); }).length;
      var on = active.year.has(year);
      var mark = el("button", {
        type: "button",
        class: "tl-mark" + (on ? " active" : "") + (x > 88 ? " edge-right" : "") + (x < 4 ? " edge-left" : ""),
        style: "left:" + x + "%",
        "aria-pressed": on ? "true" : "false",
        "aria-label": year + ", " + count + (count === 1 ? " note" : " notes"),
        title: year + ": " + count + (count === 1 ? " note" : " notes")
      }, [
        el("span", { class: "tl-dot" }),
        labelled[year] || on ? el("span", { class: "tl-year", text: year }) : null
      ]);
      mark.addEventListener("click", function () { toggle("year", year); });
      track.appendChild(mark);
    });
    timelineEl.appendChild(track);
  }

  function toggle(key, value) {
    if (active[key].has(value)) active[key].delete(value); else active[key].add(value);
    refresh();
  }

  function refresh() {
    renderCatalogue();
    renderFilters();
    renderTimeline();
  }

  // ---------- note / series pages ----------

  function badgesFor(n) {
    return el("p", { class: "page-tags" }, [tagLine([n.industry, n.geography, n.year])]);
  }

  function pdfBlock(n) {
    var url = encodeURI(n.pdf);
    var label = pdfLabel(n);
    return el("section", { class: "pdf-block", "aria-label": "PDF document" }, [
      el("div", { class: "pdf-actions" }, [
        el("span", { class: "mark mark-pdf", text: label }),
        el("a", { class: "btn btn-primary", href: url, download: "" , text: "Download PDF" }),
        el("a", { class: "btn", href: url, target: "_blank", rel: "noopener", text: "Open in a new tab" })
      ]),
      el("iframe", { class: "pdf-frame", src: url + "#view=FitH", title: "PDF: " + n.title, loading: "lazy" })
    ]);
  }

  function relatedNotes(n) {
    return notes.filter(function (o) {
      return o !== n && (!n.seriesSlug || o.seriesSlug !== n.seriesSlug) &&
        (o.industry === n.industry || o.geography === n.geography);
    }).sort(function (a, b) {
      var sa = (a.industry === n.industry ? 2 : 0) + (a.geography === n.geography ? 1 : 0);
      var sb = (b.industry === n.industry ? 2 : 0) + (b.geography === n.geography ? 1 : 0);
      return sb - sa || b.time - a.time;
    }).slice(0, 3);
  }

  function linkList(list, className) {
    return el("ul", { class: className || "link-list" }, list.map(function (o) {
      return el("li", {}, [
        el("a", { href: "#/note/" + o.slug }, [
          el("span", { class: "link-title", text: o.shortTitle || o.title }),
          el("span", { class: "link-meta", text: [o.year, formatLabel(o.industry)].filter(Boolean).join(", ") })
        ])
      ]);
    }));
  }

  function showNote(slug) {
    var n = notes.filter(function (x) { return x.slug === slug; })[0];
    if (!n) return showMissing();

    var children = [
      el("a", { class: "back-link", href: "#/", text: "All notes" }),
      badgesFor(n),
      el("h1", { class: "page-title", text: n.title }),
      el("p", { class: "page-byline", text: [n.author, n.date].filter(Boolean).join(", ") }),
      n.summary ? el("p", { class: "standfirst", text: n.summary }) : null,
      n.pdf ? pdfBlock(n) : null
    ];

    if (n.body && n.body.trim()) {
      var body = el("div", { class: "prose" });
      body.appendChild(renderBody(n.body));
      children.push(body);
    }

    if (n.seriesSlug) {
      var s = series[n.seriesSlug];
      var idx = s.parts.indexOf(n);
      var nav = el("nav", { class: "series-nav", "aria-label": "From this series" }, [
        el("h2", { class: "aside-heading" }, [
          "From the series ", el("a", { href: "#/series/" + s.slug, text: s.name })
        ])
      ]);
      var prevNext = el("div", { class: "prev-next" });
      if (s.parts[idx - 1]) prevNext.appendChild(el("a", { href: "#/note/" + s.parts[idx - 1].slug }, [
        el("span", { class: "pn-label", text: "Previous" }), el("span", { class: "pn-title", text: s.parts[idx - 1].shortTitle || s.parts[idx - 1].title })]));
      if (s.parts[idx + 1]) prevNext.appendChild(el("a", { class: "next", href: "#/note/" + s.parts[idx + 1].slug }, [
        el("span", { class: "pn-label", text: "Next" }), el("span", { class: "pn-title", text: s.parts[idx + 1].shortTitle || s.parts[idx + 1].title })]));
      nav.appendChild(prevNext);
      children.push(nav);
    }

    var related = relatedNotes(n);
    if (related.length) {
      children.push(el("aside", { class: "related", "aria-label": "Related notes" }, [
        el("h2", { class: "aside-heading", text: "Related notes" }),
        linkList(related)
      ]));
    }

    setPage(n.title, el("article", { class: "page" }, children));
  }

  function showSeries(slug) {
    var s = series[slug];
    if (!s) return showMissing();
    var parts = el("ol", { class: "parts" }, s.parts.map(function (p) {
      return el("li", {}, [
        el("a", { href: "#/note/" + p.slug }, [
          el("span", { class: "part-no", text: "Part " + (p.part || "") }),
          el("span", { class: "part-title", text: p.shortTitle || p.title }),
          el("span", { class: "part-summary", text: p.summary })
        ])
      ]);
    }));
    setPage(s.name, el("article", { class: "page" }, [
      el("a", { class: "back-link", href: "#/", text: "All notes" }),
      el("p", { class: "page-tags" }, [marker("series", s.parts.length + " parts")]),
      el("h1", { class: "page-title", text: s.name }),
      el("p", { class: "page-byline", text: [s.parts[0].author, s.parts[0].year].filter(Boolean).join(", ") }),
      parts
    ]));
  }

  function showMissing() {
    setPage("Not found", el("article", { class: "page" }, [
      el("a", { class: "back-link", href: "#/", text: "All notes" }),
      el("h1", { class: "page-title", text: "That note is not here" }),
      el("p", { class: "standfirst", text: "It may have been renamed or removed. Go back to the full list to find it." })
    ]));
  }

  function setPage(title, node) {
    viewList.hidden = true;
    viewNote.hidden = false;
    viewNote.textContent = "";
    viewNote.appendChild(node);
    document.body.classList.add("on-page");
    document.title = title + " — Pipsy";
    window.scrollTo(0, 0);
    viewNote.setAttribute("tabindex", "-1");
    viewNote.focus({ preventScroll: true });
  }

  function showList() {
    viewNote.hidden = true;
    viewList.hidden = false;
    document.body.classList.remove("on-page");
    document.title = "Pipsy — Research Archive";
    renderTimeline();
  }

  // ---------- routing ----------

  function route() {
    var hash = decodeURIComponent(location.hash || "");
    var m;
    if ((m = hash.match(/^#\/note\/(.+)$/))) return showNote(m[1]);
    if ((m = hash.match(/^#\/series\/(.+)$/))) return showSeries(m[1]);
    showList();
  }

  // ---------- init ----------

  function syncFiltersPanel() {
    filtersPanel.open = window.matchMedia("(min-width: 860px)").matches;
  }

  searchInput.addEventListener("input", function () {
    query = searchInput.value.trim().toLowerCase();
    refresh();
  });

  clearBtn.addEventListener("click", function () {
    Object.keys(active).forEach(function (k) { active[k].clear(); });
    query = "";
    searchInput.value = "";
    refresh();
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!viewList.hidden) renderTimeline();
    }, 120);
  });

  window.addEventListener("hashchange", route);

  syncFiltersPanel();

  fetch("notes.json", { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("notes.json failed to load: " + res.status);
      return res.json();
    })
    .then(function (data) {
      buildModel((data && data.notes) || []);
      refresh();
      route();
    })
    .catch(function (err) {
      resultCount.textContent = "Could not load notes.";
      emptyState.hidden = false;
      emptyState.textContent = "The notes could not be loaded. Check the browser console for details.";
      console.error(err);
    });
})();
