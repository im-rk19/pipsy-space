/* ==========================================================================
   Pipsy — search, filter, and modal logic.
   No frameworks, no build step. Notes are fetched from notes.json at load
   time and rendered into .note-card elements with the same data-* attributes
   the rest of this file always expected; everything below this point is
   unchanged from the original hand-authored version.
   ========================================================================== */

(function () {
  "use strict";

  var grid = document.getElementById("note-grid");
  var cards = [];
  var searchInput = document.getElementById("search-input");
  var resultCount = document.getElementById("result-count");
  var emptyState = document.getElementById("empty-state");
  var clearBtn = document.getElementById("clear-filters");

  var chipRows = {
    year: document.getElementById("year-chips"),
    industry: document.getElementById("industry-chips"),
    geography: document.getElementById("geography-chips")
  };

  // active[key] is a Set of selected values for that filter group.
  // Multiple values within a group are OR'd together; the three
  // groups (and the search box) are AND'd together.
  var active = {
    year: new Set(),
    industry: new Set(),
    geography: new Set()
  };

  // Labels that don't just get Title Cased, e.g. "usa" -> "USA".
  var LABEL_OVERRIDES = {
    fmcg: "FMCG",
    usa: "USA",
    uk: "UK",
    b2b: "B2B",
    b2c: "B2C"
  };

  function formatLabel(value) {
    if (LABEL_OVERRIDES.hasOwnProperty(value)) {
      return LABEL_OVERRIDES[value];
    }
    return value
      .split(/[-_\s]+/)
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }

  function renderCard(note) {
    var card = document.createElement("article");
    card.className = "note-card";
    card.setAttribute("data-year", note.year || "");
    card.setAttribute("data-industry", note.industry || "");
    card.setAttribute("data-geography", note.geography || "");
    card.setAttribute("data-author", note.author || "");
    card.setAttribute("data-date", note.date || "");
    card.setAttribute("data-search", note.search || "");

    var badges = document.createElement("div");
    badges.className = "card-badges";
    [["industry", note.industry], ["geography", note.geography], ["year", note.year]].forEach(function (pair) {
      if (!pair[1]) return;
      var badge = document.createElement("span");
      badge.className = "badge badge-" + pair[0];
      badge.textContent = formatLabel(pair[1]);
      badges.appendChild(badge);
    });
    card.appendChild(badges);

    var title = document.createElement("h2");
    title.className = "card-title";
    title.textContent = note.title || "";
    card.appendChild(title);

    var byline = document.createElement("p");
    byline.className = "card-byline";
    byline.textContent = [note.author, note.date].filter(Boolean).join(" · ");
    card.appendChild(byline);

    var summary = document.createElement("p");
    summary.className = "card-summary";
    summary.textContent = note.summary || "";
    card.appendChild(summary);

    var template = document.createElement("template");
    template.className = "card-body";
    var paragraphs = (note.body || "").split(/\n\s*\n/);
    paragraphs.forEach(function (para) {
      if (!para.trim()) return;
      var p = document.createElement("p");
      p.textContent = para.trim();
      template.content.appendChild(p);
    });
    card.appendChild(template);

    return card;
  }

  function buildChips() {
    Object.keys(chipRows).forEach(function (key) {
      var values = [];
      cards.forEach(function (card) {
        var v = card.getAttribute("data-" + key);
        if (v && values.indexOf(v) === -1) {
          values.push(v);
        }
      });

      if (key === "year") {
        values.sort(function (a, b) { return b.localeCompare(a); });
      } else {
        values.sort(function (a, b) { return formatLabel(a).localeCompare(formatLabel(b)); });
      }

      var row = chipRows[key];
      values.forEach(function (value) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.textContent = formatLabel(value);
        chip.setAttribute("data-value", value);
        chip.setAttribute("aria-pressed", "false");
        chip.addEventListener("click", function () {
          toggleChip(key, value, chip);
        });
        row.appendChild(chip);
      });
    });
  }

  function toggleChip(key, value, chipEl) {
    if (active[key].has(value)) {
      active[key].delete(value);
      chipEl.classList.remove("active");
      chipEl.setAttribute("aria-pressed", "false");
    } else {
      active[key].add(value);
      chipEl.classList.add("active");
      chipEl.setAttribute("aria-pressed", "true");
    }
    applyFilters();
  }

  function clearAllFilters() {
    Object.keys(active).forEach(function (key) {
      active[key].clear();
    });
    document.querySelectorAll(".chip.active").forEach(function (chip) {
      chip.classList.remove("active");
      chip.setAttribute("aria-pressed", "false");
    });
    searchInput.value = "";
    applyFilters();
  }

  function cardMatchesFilters(card) {
    return Object.keys(active).every(function (key) {
      if (active[key].size === 0) return true;
      var cardValue = card.getAttribute("data-" + key);
      return active[key].has(cardValue);
    });
  }

  function cardMatchesSearch(card, query) {
    if (!query) return true;
    var haystack = (
      card.querySelector(".card-title").textContent + " " +
      card.querySelector(".card-summary").textContent + " " +
      (card.getAttribute("data-search") || "")
    ).toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function applyFilters() {
    var query = searchInput.value.trim().toLowerCase();
    var visibleCount = 0;

    cards.forEach(function (card) {
      var matches = cardMatchesFilters(card) && cardMatchesSearch(card, query);
      card.classList.toggle("is-hidden", !matches);
      card.style.display = matches ? "" : "none";
      if (matches) visibleCount++;
    });

    resultCount.textContent = "Showing " + visibleCount + " of " + cards.length + " notes";
    emptyState.hidden = visibleCount !== 0;

    var anyFilterActive = Object.keys(active).some(function (key) {
      return active[key].size > 0;
    }) || query.length > 0;
    clearBtn.hidden = !anyFilterActive;
  }

  // ---------- modal ----------

  var overlay = document.getElementById("modal-overlay");
  var modal = overlay.querySelector(".modal");
  var modalClose = document.getElementById("modal-close");
  var modalBadges = document.getElementById("modal-badges");
  var modalTitle = document.getElementById("modal-title");
  var modalByline = document.getElementById("modal-byline");
  var modalBody = document.getElementById("modal-body");
  var lastFocusedEl = null;

  function openModal(card) {
    var title = card.querySelector(".card-title").textContent;
    var author = card.getAttribute("data-author") || "";
    var date = card.getAttribute("data-date") || "";
    var bodyTemplate = card.querySelector(".card-body");

    modalBadges.innerHTML = "";
    ["industry", "geography", "year"].forEach(function (key) {
      var value = card.getAttribute("data-" + key);
      if (!value) return;
      var badge = document.createElement("span");
      badge.className = "badge badge-" + key;
      badge.textContent = formatLabel(value);
      modalBadges.appendChild(badge);
    });

    modalTitle.textContent = title;
    modalByline.textContent = [author, date].filter(Boolean).join(" · ");

    modalBody.innerHTML = "";
    if (bodyTemplate) {
      modalBody.appendChild(bodyTemplate.content.cloneNode(true));
    } else {
      var fallback = document.createElement("p");
      fallback.textContent = card.querySelector(".card-summary").textContent;
      modalBody.appendChild(fallback);
    }

    lastFocusedEl = document.activeElement;
    overlay.hidden = false;
    modal.focus();
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
      lastFocusedEl.focus();
    }
  }

  function wireCard(card) {
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.addEventListener("click", function () {
      openModal(card);
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal(card);
      }
    });
  }

  modalClose.addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });

  // ---------- wire up + init ----------

  searchInput.addEventListener("input", applyFilters);
  clearBtn.addEventListener("click", clearAllFilters);

  fetch("notes.json", { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("notes.json failed to load: " + res.status);
      return res.json();
    })
    .then(function (data) {
      var notes = (data && data.notes) || [];
      notes.forEach(function (note) {
        var card = renderCard(note);
        wireCard(card);
        grid.appendChild(card);
        cards.push(card);
      });
      buildChips();
      applyFilters();
    })
    .catch(function (err) {
      resultCount.textContent = "Could not load notes.";
      emptyState.hidden = false;
      emptyState.textContent = "Failed to load notes.json — check the console for details.";
      console.error(err);
    });
})();
