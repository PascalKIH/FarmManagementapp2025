/* template.js – markiert aktive Ebene1/Ebene2, baut Breadcrumb & mobile Quick Actions */

(function () {
  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  const section    = document.documentElement.dataset.section || document.body.dataset.section || "";
  const subsection = document.documentElement.dataset.subsection || document.body.dataset.subsection || "";

  // Mapping für Breadcrumb & mobile Quick Actions
  const STRUCT = {
    dashboard: {
      title: "Dashboard",
      intro: "Überblick über die Farm.",
      actions: [] // keine Ebene-2 Quick Actions
    },
    tiere: {
      title: "Tiere",
      intro: "Übersicht & Verwaltung aller Tiere.",
      actions: [
        { key: "overview", label: "Übersicht", href: "animals.html" },
        { key: "inseminations", label: "Besamung", href: "inseminations.html" },
        { key: "pregnancy_tests", label: "Trächtigkeitsuntersuchung", href: "pregnancy_tests.html" },
        { key: "calving", label: "Geburt", href: "calving.html" },
      ]
    },
    behandlungen: {
      title: "Behandlungen",
      intro: "Übersicht & Erfassung medizinischer Maßnahmen.",
      actions: [
        { key: "overview", label: "Übersicht", href: "treatments.html" },
        { key: "vaccinations", label: "Impfung", href: "vaccinations.html" },
        { key: "treat", label: "Behandeln", href: "treat.html" },
        { key: "examinations", label: "Untersuchen", href: "examinations.html" },
        { key: "medications", label: "Medikamente", href: "medications.html" },
      ]
    },
    bewegungen: {
      title: "Bewegungen",
      intro: "Orte, Bestandsbewegungen & Transporte.",
      actions: [
        { key: "overview", label: "Übersicht", href: "movements.html" },
        { key: "move", label: "Tier verschieben", href: "move.html" },
        { key: "locations", label: "Ort hinzufügen", href: "locations.html" },
        { key: "intake", label: "Zugang", href: "intake.html" },
        { key: "exit", label: "Abgang", href: "exit.html" },
      ]
    }
  };

  // Aktiven Punkt in Navbar markieren
  if (section) {
    const topLink = qs(`a.nav-link[data-nav="${section}"]`);
    if (topLink) topLink.classList.add("active");

    // Dropdown-Subnav (nur optisch für aktiven Unterpunkt)
    if (subsection) {
      const subLink = qs(`a.dropdown-item[data-subnav="${subsection}"]`);
      if (subLink) subLink.classList.add("active");
    }
  }

  // Breadcrumb & Header
  const bc = qs("#breadcrumb");
  const titleEl = qs("#page-title");
  const introEl = qs("#page-intro");
  const page = STRUCT[section] || null;

  if (page) {
    if (bc) {
      bc.innerHTML = "";
      const liRoot = document.createElement("li");
      liRoot.className = "breadcrumb-item";
      liRoot.innerHTML = `<a href="index.html">Dashboard</a>`;
      const liSection = document.createElement("li");
      liSection.className = `breadcrumb-item ${subsection ? "" : "active"}`;
      if (subsection) {
        liSection.innerHTML = `<a href="${page.actions.find(a=>a.key==='overview')?.href || '#'}">${page.title}</a>`;
      } else {
        liSection.textContent = page.title;
      }
      bc.appendChild(liRoot);
      bc.appendChild(liSection);

      if (subsection) {
        const sub = page.actions.find(a => a.key === subsection);
        const liSub = document.createElement("li");
        liSub.className = "breadcrumb-item active";
        liSub.textContent = sub ? sub.label : "Detail";
        bc.appendChild(liSub);
      }
    }
    if (titleEl) {
      titleEl.textContent = subsection
        ? (page.actions.find(a => a.key === subsection)?.label || page.title)
        : page.title;
    }
    if (introEl) introEl.textContent = page.intro || "";
  } else {
    // Fallback
    if (bc) bc.innerHTML = `<li class="breadcrumb-item"><a href="index.html">Dashboard</a></li>`;
  }

  // Mobile Quick Actions (Buttons für Ebene 2)
  const btnWrap = qs("#subactions-buttons");
  if (btnWrap && page && page.actions?.length) {
    btnWrap.innerHTML = "";
    page.actions.forEach(a => {
      const btn = document.createElement("a");
      btn.className = `btn btn-outline-success btn-sm me-2 ${a.key === subsection ? "active" : ""}`;
      btn.href = a.href;
      btn.textContent = a.label;
      btnWrap.appendChild(btn);
    });
  } else if (btnWrap) {
    btnWrap.innerHTML = "";
  }

  // Optionale: Profil-Füllung – falls du später Supabase-Daten reinziehst
  // const username = localStorage.getItem("username");
  // if (username) {
  //   const n = qs("#navbar-username");
  //   const p = qs("#profile-username");
  //   if (n) n.textContent = username;
  //   if (p) p.textContent = username;
  // }

})();
