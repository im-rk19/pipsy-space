/* ==========================================================================
   Pipsy — tabs, search, filter, and modal logic.
   No frameworks, no build step. Reads note data straight from the
   data-* attributes on each .note-card in index.html. The same
   search/filter/modal behavior is instantiated once per tab (Notes,
   Wishlist), each scoped to its own grid and controls.
   ========================================================================== */

(function () {
  "use strict";

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

  // ---------- shared modal (one overlay, reused by every tab) ----------

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

  modalClose.addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });

  // ---------- one archive instance (search + filter chips + cards) ----------

  function initArchive(opts) {
    var grid = document.getElementById(opts.gridId);
    if (!grid) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll(".note-card"));
    var searchInput = document.getElementById(opts.searchId);
    var resultCount = document.getElementById(opts.resultCountId);
    var emptyState = document.getElementById(opts.emptyStateId);
    var clearBtn = document.getElementById(opts.clearBtnId);
    var noun = opts.noun || "notes";

    var chipRows = {
      year: document.getElementById(opts.chipIds.year),
      industry: document.getElementById(opts.chipIds.industry),
      geography: document.getElementById(opts.chipIds.geography)
    };

    // active[key] is a Set of selected values for that filter group.
    // Multiple values within a group are OR'd together; the three
    // groups (and the search box) are AND'd together.
    var active = {
      year: new Set(),
      industry: new Set(),
      geography: new Set()
    };

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
      grid.querySelectorAll(".chip.active").forEach(function (chip) {
        chip.classList.remove("active");
        chip.setAttribute("aria-pressed", "false");
      });
      Object.keys(chipRows).forEach(function (key) {
        chipRows[key].querySelectorAll(".chip.active").forEach(function (chip) {
          chip.classList.remove("active");
          chip.setAttribute("aria-pressed", "false");
        });
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

      resultCount.textContent = "Showing " + visibleCount + " of " + cards.length + " " + noun;
      emptyState.hidden = visibleCount !== 0;

      var anyFilterActive = Object.keys(active).some(function (key) {
        return active[key].size > 0;
      }) || query.length > 0;
      clearBtn.hidden = !anyFilterActive;
    }

    cards.forEach(function (card) {
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
    });

    searchInput.addEventListener("input", applyFilters);
    clearBtn.addEventListener("click", clearAllFilters);

    buildChips();
    applyFilters();
  }

  // ---------- tabs ----------

  function initTabs() {
    var tabButtons = Array.prototype.slice.call(document.querySelectorAll(".tab-btn"));
    tabButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-tab");

        tabButtons.forEach(function (b) {
          var isActive = b === btn;
          b.classList.toggle("active", isActive);
          b.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        document.querySelectorAll(".tab-panel").forEach(function (panel) {
          panel.hidden = panel.id !== "panel-" + target;
        });
      });
    });
  }

  // ---------- init ----------

  initTabs();

  initArchive({
    gridId: "note-grid",
    searchId: "search-input",
    resultCountId: "result-count",
    emptyStateId: "empty-state",
    clearBtnId: "clear-filters",
    chipIds: { year: "year-chips", industry: "industry-chips", geography: "geography-chips" },
    noun: "notes"
  });

  initArchive({
    gridId: "wishlist-grid",
    searchId: "wishlist-search-input",
    resultCountId: "wishlist-result-count",
    emptyStateId: "wishlist-empty-state",
    clearBtnId: "wishlist-clear-filters",
    chipIds: { year: "wishlist-year-chips", industry: "wishlist-industry-chips", geography: "wishlist-geography-chips" },
    noun: "wishlist items"
  });
})();
