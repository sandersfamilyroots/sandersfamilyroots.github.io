/* Sanders Family Roots — renders people index, person view, and line lists
   from data/people.json. Living people carry no dates or places in the data,
   so nothing private can be rendered. */
(function () {
  "use strict";

  var byId = {};
  var meta = null;
  var memorials = {};
  var service = {};

  function load() {
    var peopleP = fetch("data/people.json")
      .then(function (r) { return r.json(); });
    // Memorials are a hand-curated overlay (see MEMORIALS.md); if the file
    // is missing the site simply renders without them.
    var memorialsP = fetch("data/memorials.json")
      .then(function (r) { return r.json(); })
      .catch(function () { return {}; });
    // Military service views are a hand-curated overlay too
    // (data/service.json); missing file simply means no service views.
    var serviceP = fetch("data/service.json")
      .then(function (r) { return r.json(); })
      .catch(function () { return {}; });
    return Promise.all([peopleP, memorialsP, serviceP]).then(function (res) {
      var data = res[0];
      memorials = res[1] || {};
      service = res[2] || {};
      meta = data.meta;
      data.people.forEach(function (p) { byId[p.id] = p; });
      return data.people;
    });
  }

  function personLink(p) {
    return '<a href="person.html?id=' + encodeURIComponent(p.id) + '">' +
      escapeHtml(p.name) + "</a>";
  }

  function datesLine(p) {
    if (p.living) return '<span class="living-note">Living</span>';
    var b = p.birth_year || (p.birth_date ? p.birth_date : "?");
    var d = p.death_year || (p.death_date ? p.death_date : "");
    if (!b && !d) return "";
    return escapeHtml(String(b)) + (d ? "–" + escapeHtml(String(d)) : "");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------------- People index ---------------- */
  function renderPeople(people) {
    var box = document.getElementById("people-list");
    var input = document.getElementById("people-search");
    var count = document.getElementById("people-count");
    if (!box) return;

    function draw(list) {
      var html = "";
      var lastLetter = "";
      list.forEach(function (p) {
        var letter = (p.surname || p.name || "?").charAt(0).toUpperCase();
        if (letter !== lastLetter) {
          lastLetter = letter;
          html += '<h3 class="alpha-head">' + escapeHtml(letter) + "</h3>";
        }
        html += '<div class="person-row">' + personLink(p) +
          ' <span class="person-meta">' + datesLine(p) +
          (p.line ? ' · <span class="line-tag">' + escapeHtml(p.line.replace(" Sanders", "")) + " line</span>" : "") +
          "</span></div>";
      });
      box.innerHTML = html || "<p>No one matches that name yet.</p>";
      if (count) count.textContent = list.length + " of " + people.length + " people";
    }

    draw(people);
    if (input) {
      input.addEventListener("input", function () {
        var q = input.value.trim().toLowerCase();
        if (!q) { draw(people); return; }
        draw(people.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; }));
      });
      // Arriving via a #search anchor focuses the box.
      if (location.hash === "#search") input.focus();
    }
  }

  /* ---------------- Person view ---------------- */
  function relList(ids) {
    if (!ids || !ids.length) return '<p class="none">Not recorded.</p>';
    var items = ids.map(function (id) {
      var p = byId[id];
      if (!p) return "";
      return "<li>" + personLink(p) + ' <span class="person-meta">' + datesLine(p) + "</span></li>";
    }).filter(Boolean);
    return items.length ? "<ul class='rel-list'>" + items.join("") + "</ul>"
                        : '<p class="none">Not recorded.</p>';
  }

  /* Spouse list with the marriage line under each spouse's name.
     Marriage details render ONLY for a deceased person whose spouse is
     also deceased (the generator withholds them otherwise, emitting a
     bare "withheld" flag with no date or place). A living person's own
     page never shows a marriage line at all. */
  function spouseList(p) {
    if (!p.spouses || !p.spouses.length) return '<p class="none">Not recorded.</p>';
    var marrBySpouse = {};
    (p.marriages || []).forEach(function (m) { marrBySpouse[m.spouse] = m; });
    var items = p.spouses.map(function (id) {
      var s = byId[id];
      if (!s) return "";
      var html = "<li>" + personLink(s) + ' <span class="person-meta">' + datesLine(s) + "</span>";
      if (!p.living) {
        var m = marrBySpouse[id];
        if (m && m.withheld) {
          html += '<div class="marr-line">marriage details withheld — spouse living</div>';
        } else if (m && (m.date || m.place)) {
          html += '<div class="marr-line">m. ' +
            escapeHtml([m.date, m.place].filter(Boolean).join(" · ")) + "</div>";
        }
      }
      return html + "</li>";
    }).filter(Boolean);
    return items.length ? "<ul class='rel-list'>" + items.join("") + "</ul>"
                        : '<p class="none">Not recorded.</p>';
  }

  /* Sources box (deceased people only): source titles from the family
     file, grouped by fact, plus contributor credits under "Family". */
  function sourcesBox(p) {
    if (p.living || !p.sources) return "";
    var order = ["Born", "Married", "Died", "Buried", "Family"];
    var rows = order.filter(function (g) {
      return p.sources[g] && p.sources[g].length;
    }).map(function (g) {
      return "<dt>" + escapeHtml(g) + "</dt><dd>" +
        p.sources[g].map(escapeHtml).join("<br>") + "</dd>";
    });
    if (!rows.length) return "";
    return '<div class="sources"><h3>Sources</h3><dl class="facts">' +
      rows.join("") + "</dl></div>";
  }

  /* Contributor credit on a living person's page: the ONLY addition the
     new format makes there — a name and a date, no facts. */
  function sharedByLine(p) {
    if (!p.living || !p.shared_by || !p.shared_by.length) return "";
    var credits = p.shared_by.map(function (c) {
      return escapeHtml(c.name) + " · family group sheet" +
        (c.date ? ", " + escapeHtml(c.date) : "");
    });
    return '<p class="shared-by"><strong>Shared by</strong> ' +
      credits.join("; ") + "</p>";
  }

  function renderPerson() {
    var box = document.getElementById("person-view");
    if (!box) return;
    var id = new URLSearchParams(location.search).get("id");
    var p = id && byId[id];
    if (!p) {
      box.innerHTML = "<h2>Person not found</h2><p>That link doesn't match anyone in the tree. " +
        'Try the <a href="people.html">People index</a>.</p>';
      return;
    }
    // Military-only view, as the They Served roster links open it:
    // person.html?id=...&view=service, for a person with service data.
    if (new URLSearchParams(location.search).get("view") === "service" &&
        !p.living && service[p.id]) {
      renderServiceView(p, service[p.id]);
      return;
    }
    document.title = p.name + " — Sanders Family Roots";
    var html = "<h2>" + escapeHtml(p.name) + "</h2>";
    if (p.line) {
      html += '<p><span class="line-badge">' + escapeHtml(p.line) +
        (p.line === "Founders" || p.line === "Connected family" ? "" : " line") + "</span></p>";
    }
    if (p.living) {
      html += '<p class="living-note">Living — dates and details are kept private.</p>';
    } else {
      html += '<dl class="facts">';
      if (p.birth_date || p.birth_place)
        html += "<dt>Born</dt><dd>" + escapeHtml([p.birth_date, p.birth_place].filter(Boolean).join(" · ")) + "</dd>";
      if (p.death_date || p.death_place)
        html += "<dt>Died</dt><dd>" + escapeHtml([p.death_date, p.death_place].filter(Boolean).join(" · ")) + "</dd>";
      if (p.burial_date || p.burial_place)
        html += "<dt>Buried</dt><dd>" + escapeHtml([p.burial_date, p.burial_place].filter(Boolean).join(" · ")) + "</dd>";
      html += "</dl>";
    }
    html += memorialSection(p);
    if (!p.living && service[p.id]) {
      html += '<p class="lines-intro"><a href="person.html?id=' + encodeURIComponent(p.id) +
        '&view=service">They Served &middot; See ' + (p.sex === "F" ? "her" : "his") +
        ' military service view &rarr;</a></p>';
    }
    html += "<h3>Parents</h3>" + relList([p.father, p.mother].filter(Boolean));
    html += "<h3>" + (p.spouses && p.spouses.length > 1 ? "Spouses" : "Spouse") + "</h3>" + spouseList(p);
    html += "<h3>Children</h3>" + relList(p.children);
    html += sourcesBox(p);
    html += sharedByLine(p);
    html += '<p class="back-links"><a href="people.html">&larr; Everyone in the tree</a> · ' +
      '<a href="lines.html">The five lines</a></p>';
    box.innerHTML = html;
  }

  /* ---------------- Military service view ----------------
     Data comes from data/service.json (curated by hand, like the
     memorials overlay). HARD RULE: only ever rendered for a person
     who is NOT flagged living in people.json. Shows service only —
     summary, military records, documents note — with everything
     else left on the full page, which it links back to. */
  function renderServiceView(p, s) {
    var box = document.getElementById("person-view");
    if (!box) return;
    document.title = p.name + ", military service view — Sanders Family Roots";
    var fullUrl = "person.html?id=" + encodeURIComponent(p.id);
    var html = '<p class="lines-intro"><a href="they-served.html">They Served</a> &middot; ' +
      'Military service view &middot; <a href="' + fullUrl + '">See ' +
      (p.sex === "F" ? "her" : "his") + ' full page &rarr;</a></p>';
    html += "<h2>" + escapeHtml(p.name) + "</h2>";
    if (s.dates_line)
      html += '<p class="line-dates">' + escapeHtml(s.dates_line) + "</p>";
    html += '<div class="line-cards"><article class="line-card"><h3>Service summary</h3><p>';
    if (s.summary_lead) html += "<strong>" + escapeHtml(s.summary_lead) + "</strong> ";
    html += escapeHtml(s.summary || "") + "</p></article></div>";
    if (s.records && s.records.length) {
      html += "<h3>Military records</h3><ul class='finds'>";
      s.records.forEach(function (r) {
        html += "<li>";
        if (r.url)
          html += '<a href="' + escapeHtml(r.url) + '">' + escapeHtml(r.text) + "</a>";
        else if (r.lead)
          html += "<strong>" + escapeHtml(r.lead) + "</strong>";
        if (r.note) html += " &mdash; " + escapeHtml(r.note);
        html += "</li>";
      });
      html += "</ul>";
    }
    if (s.documents_before || s.documents_after) {
      html += "<h3>Documents &amp; photos</h3>" +
        '<p class="lines-intro">' + escapeHtml(s.documents_before || "") +
        '<a href="' + fullUrl + '">full page</a>' +
        escapeHtml(s.documents_after || "") + "</p>";
    }
    box.innerHTML = html;
  }

  /* ---------------- Memorials ----------------
     Data comes from data/memorials.json (curated by hand — see
     MEMORIALS.md). HARD RULE: a memorial is only ever rendered for a
     person who is NOT flagged living in people.json. */
  function memorialSection(p) {
    if (p.living) return "";
    var m = memorials[p.id];
    if (!m || (!m.photo && !(m.obituary && m.obituary.text))) return "";
    var html = '<div class="memorial"><h3>Memorial</h3>';
    if (m.photo) {
      html += '<figure class="memorial-photo"><img src="' + escapeHtml(m.photo) +
        '" alt="Headstone of ' + escapeHtml(p.name) + '">';
      if (m.photo_caption)
        html += "<figcaption>" + escapeHtml(m.photo_caption) + "</figcaption>";
      html += "</figure>";
    }
    if (m.obituary && m.obituary.text) {
      html += '<div class="obituary">';
      if (m.obituary.source)
        html += '<p class="obituary-source">Obituary — ' + escapeHtml(m.obituary.source) + "</p>";
      m.obituary.text.split(/\n\s*\n/).forEach(function (para) {
        html += "<p>" + escapeHtml(para.trim()) + "</p>";
      });
      html += "</div>";
    }
    return html + "</div>";
  }

  function renderMemorials() {
    var box = document.getElementById("memorials-list");
    var input = document.getElementById("memorial-search");
    var count = document.getElementById("memorial-count");
    if (!box) return;
    var entries = Object.keys(memorials).map(function (id) {
      return { p: byId[id], m: memorials[id] };
    }).filter(function (e) {
      return e.p && !e.p.living &&
        (e.m.photo || (e.m.obituary && e.m.obituary.text));
    });
    entries.sort(function (a, b) {
      var da = a.p.death_year || 0;
      var db = b.p.death_year || 0;
      if (da !== db) return da - db;
      return a.p.name.localeCompare(b.p.name);
    });
    if (!entries.length) {
      box.innerHTML = "<p>No memorials have been added yet.</p>";
      if (count) count.textContent = "";
      return;
    }

    function draw(list) {
      if (count) count.textContent = list.length + " of " + entries.length + " memorials";
      if (!list.length) {
        box.innerHTML = "<p>No one matches that search yet.</p>";
        return;
      }
      var html = '<div class="memorial-cards">';
      list.forEach(function (e) {
        var p = e.p;
        var m = e.m;
        var has = [];
        if (m.photo) has.push("Headstone photo");
        if (m.obituary && m.obituary.text) has.push("Obituary");
        html += '<a class="memorial-card" href="person.html?id=' + encodeURIComponent(p.id) + '">';
        if (m.photo)
          html += '<img src="' + escapeHtml(m.photo) + '" alt="Headstone of ' + escapeHtml(p.name) + '">';
        html += '<span class="memorial-card-name">' + escapeHtml(p.name) + "</span>";
        html += '<span class="memorial-card-dates">' + datesLine(p) + "</span>";
        if (p.burial_place)
          html += '<span class="memorial-card-burial">' + escapeHtml(p.burial_place) + "</span>";
        if (has.length)
          html += '<span class="memorial-card-has">' + has.join(" · ") + "</span>";
        html += "</a>";
      });
      box.innerHTML = html + "</div>";
    }

    draw(entries);
    if (input) {
      input.addEventListener("input", function () {
        var q = input.value.trim().toLowerCase();
        if (!q) { draw(entries); return; }
        draw(entries.filter(function (e) {
          var p = e.p;
          var hay = [p.name, p.burial_place || "", p.birth_year || "", p.death_year || ""]
            .join(" ").toLowerCase();
          return hay.indexOf(q) !== -1;
        }));
      });
      if (location.hash === "#search") input.focus();
    }
  }

  /* ---------------- Lines page ---------------- */
  function descendantsByGeneration(headId, memberIds) {
    // Breadth-first from the line head; generation 1 is the head.
    var gens = {};
    var seen = {};
    var frontier = [headId];
    var g = 1;
    while (frontier.length) {
      var next = [];
      frontier.forEach(function (id) {
        if (seen[id] || !memberIds[id]) return;
        seen[id] = true;
        (gens[g] = gens[g] || []).push(byId[id]);
        (byId[id].children || []).forEach(function (c) { next.push(c); });
      });
      frontier = next;
      g++;
    }
    // Include spouses who carry this line but aren't blood descendants,
    // listed with the generation of their spouse where possible.
    return gens;
  }

  function renderLines(people) {
    if (!document.getElementById("lines-view") || !meta) return;
    meta.lines.forEach(function (line) {
      var section = document.getElementById(line.anchor);
      if (!section) return;
      var members = people.filter(function (p) {
        return p.lines && p.lines.indexOf(line.name) !== -1;
      });
      var memberIds = {};
      members.forEach(function (p) { memberIds[p.id] = true; });
      var gens = descendantsByGeneration(line.head_id, memberIds);
      var html = "";
      Object.keys(gens).sort(function (a, b) { return a - b; }).forEach(function (g) {
        html += '<h4>Generation ' + g + "</h4><ul class='rel-list'>";
        gens[g].slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
          .forEach(function (p) {
            html += "<li>" + personLink(p) + ' <span class="person-meta">' + datesLine(p) + "</span></li>";
          });
        html += "</ul>";
      });
      // Members attached by marriage rather than descent.
      var inGens = {};
      Object.keys(gens).forEach(function (g) { gens[g].forEach(function (p) { inGens[p.id] = true; }); });
      var marriedIn = members.filter(function (p) { return !inGens[p.id]; });
      if (marriedIn.length) {
        html += "<h4>Married into this line</h4><ul class='rel-list'>";
        marriedIn.sort(function (a, b) { return a.name.localeCompare(b.name); })
          .forEach(function (p) {
            html += "<li>" + personLink(p) + ' <span class="person-meta">' + datesLine(p) + "</span></li>";
          });
        html += "</ul>";
      }
      var target = section.querySelector(".line-members");
      if (target) target.innerHTML = html || "<p>No members recorded yet.</p>";
      var countEl = section.querySelector(".line-count");
      if (countEl) countEl.textContent = members.length + " people in this line";
    });
  }

  load().then(function (people) {
    renderPeople(people);
    renderPerson();
    renderMemorials();
    renderLines(people);
  }).catch(function () {
    ["people-list", "person-view", "lines-view", "memorials-list"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = "<p>The family data could not be loaded. Please try again in a moment.</p>";
    });
  });
})();
