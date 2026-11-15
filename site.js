/* Sanders Family Roots — renders people index, person view, and line lists
   from data/people.json. Living people carry no dates or places in the data,
   so nothing private can be rendered. */
(function () {
  "use strict";

  var byId = {};
  var meta = null;
  var memorials = {};

  function load() {
    var peopleP = fetch("data/people.json")
      .then(function (r) { return r.json(); });
    // Memorials are a hand-curated overlay (see MEMORIALS.md); if the file
    // is missing the site simply renders without them.
    var memorialsP = fetch("data/memorials.json")
      .then(function (r) { return r.json(); })
      .catch(function () { return {}; });
    return Promise.all([peopleP, memorialsP]).then(function (res) {
      var data = res[0];
      memorials = res[1] || {};
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
    html += "<h3>Parents</h3>" + relList([p.father, p.mother].filter(Boolean));
    html += "<h3>" + (p.spouses && p.spouses.length > 1 ? "Spouses" : "Spouse") + "</h3>" + relList(p.spouses);
    html += "<h3>Children</h3>" + relList(p.children);
    html += '<p class="back-links"><a href="people.html">&larr; Everyone in the tree</a> · ' +
      '<a href="lines.html">The five lines</a></p>';
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
      return;
    }
    var html = '<div class="memorial-cards">';
    entries.forEach(function (e) {
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
