/***** Supabase-Konfiguration *****/
const SUPABASE_URL = "https://kfonugwtvqmpltfdldri.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmb251Z3d0dnFtcGx0ZmRsZHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDY4MDUsImV4cCI6MjA3NDMyMjgwNX0.H-9mm9JdAAhLUrhvSRf_j47POPNQR4MhcXpT3dHCa38";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/***** State *****/
let currentUser = null;
let currentFarmId = localStorage.getItem("currentFarmId"); // von Login gesetzt
const TEAM_FIELD = "farm_id"; // das Feld in der animals-Tabelle, das die Farm referenziert

/***** Helpers *****/
const qs = (sel) => document.querySelector(sel);
function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}
function showAlert(type = "success", html = "") {
  // type: 'success' | 'danger' | 'warning' | 'info'
  const host = qs("#page-content") || document.body;
  const old = host.querySelector(".live-alert");
  if (old) old.remove();

  const wrap = document.createElement("div");
  wrap.className = "live-alert";
  wrap.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show shadow-sm" role="alert">
      ${html}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Schließen"></button>
    </div>
  `;
  host.prepend(wrap);
}

/***** Init *****/
(async function init() {
  // Session prüfen
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) {
    showAlert("danger", "Fehler beim Laden der Session.");
    return;
  }
  if (!sessionData.session) {
    window.location.href = "../auth.html";
    return;
  }
  currentUser = sessionData.session.user;

  // Navbar Profilname (falls vorhanden)
  const navUser = qs("#navbar-username");
  if (navUser) navUser.textContent = currentUser.user_metadata?.username || currentUser.email;

  // Farm prüfen
  if (!currentFarmId) {
    showAlert("danger", "Keine Farm ausgewählt. Bitte melde dich neu an.");
    return;
  }
})();


(function () {
  // ---------- Konfig ----------
  const PAGE_LIMIT = 20;         // max. Treffer pro Suche
  const MIN_QUERY_LEN = 1;       // ab wie vielen Zeichen suchen
  const TEAM_FIELD = "farm_id";  // dein Team/Farm-Feld

  // ---------- DOM ----------
  const elSearch   = document.getElementById("animal-search");
  const elResults  = document.getElementById("animal-results");
  const elSelected = document.getElementById("selected-animals");
  const elHidden   = document.getElementById("selected-animal-ids");

  // State
  let selectedMap = new Map(); // id -> {id, label}
  let results = [];
  let focusedIndex = -1;
  let searching = false;
  let lastQuery = "";

  // ---------- Utils ----------
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  const fmt = (d) => d ?? "—";

  function isOpen() {
    return elResults.classList.contains("show");
  }
  function openDropdown() {
    if (!elResults.classList.contains("show")) {
      elResults.classList.add("show");
      elSearch.setAttribute("aria-expanded", "true");
    }
  }
  function closeDropdown() {
    if (elResults.classList.contains("show")) {
      elResults.classList.remove("show");
      elSearch.setAttribute("aria-expanded", "false");
      focusedIndex = -1;
      updateFocus();
    }
  }

  function setHiddenValue() {
    elHidden.value = Array.from(selectedMap.keys()).join(",");
  }

  function addSelection(item) {
    if (selectedMap.has(item.id)) return; // keine Duplikate
    selectedMap.set(item.id, { id: item.id, label: item.label });

    // Pill rendern
    const pill = document.createElement("span");
    pill.className = "badge rounded-pill text-bg-success d-inline-flex align-items-center px-3 py-2";
    pill.dataset.id = item.id;
    pill.innerHTML = `
      <span class="me-2">${item.label}</span>
      <button type="button" class="btn btn-sm btn-light ms-1" aria-label="Entfernen">&times;</button>
    `;
    pill.querySelector("button").addEventListener("click", () => removeSelection(item.id));
    elSelected.appendChild(pill);

    setHiddenValue();
  }

  function removeSelection(id) {
    selectedMap.delete(id);
    const pill = elSelected.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (pill) pill.remove();
    setHiddenValue();
  }

  // Für Außen: hole die IDs als Array
  window.getSelectedAnimalIds = () => Array.from(selectedMap.keys());

  // ---------- Rendering der Ergebnisse ----------
  function renderResults() {
    elResults.innerHTML = "";

    if (searching) {
      elResults.innerHTML = `<div class="dropdown-item disabled text-muted">Suche…</div>`;
      openDropdown();
      return;
    }
    if (!results.length) {
      if (lastQuery.length >= MIN_QUERY_LEN) {
        elResults.innerHTML = `<div class="dropdown-item disabled text-muted">Keine Treffer</div>`;
        openDropdown();
      } else {
        closeDropdown();
      }
      return;
    }

    // Treffer bauen
    results.forEach((r, idx) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "dropdown-item d-flex justify-content-between align-items-center";
      item.setAttribute("data-index", String(idx));
      item.innerHTML = `
        <span>
          <strong>${fmt(r.animal_number)}</strong>
          <small class="text-muted ms-1">ID: ${fmt(r.animal_id)}</small>
        </span>
        <span class="badge ${badgeForGender(r.gender)}">${fmt(r.gender)}</span>
      `;
      item.addEventListener("click", () => {
        addSelection({ id: r.id, label: labelFor(r) });
        // Suche offen lassen, aber Text beibehalten
        elSearch.focus();
      });
      elResults.appendChild(item);
    });

    openDropdown();
    updateFocus();
  }

  function labelFor(a) {
    return `${fmt(a.animal_number)} · ${fmt(a.animal_id)}`;
  }
  function badgeForGender(g) {
    if (g === "weiblich") return "text-bg-success";
    if (g === "männlich") return "text-bg-primary";
    return "text-bg-secondary";
  }

  function updateFocus() {
    const items = Array.from(elResults.querySelectorAll(".dropdown-item:not(.disabled)"));
    items.forEach((it, i) => {
      if (i === focusedIndex) it.classList.add("active");
      else it.classList.remove("active");
    });
  }

  // ---------- Suche (Server-seitig via Supabase) ----------
  const runSearch = debounce(async function (q) {
    lastQuery = q;

    if (q.length < MIN_QUERY_LEN) {
      results = [];
      renderResults();
      return;
    }

    searching = true;
    renderResults();

    // Supabase-Query
    // HINWEIS: supabase-Objekt & currentFarmId müssen global verfügbar sein
    const query = supabase
      .from("animals")
      .select("id, animal_number, animal_id, gender")
      .eq(TEAM_FIELD, localStorage.getItem("currentFarmId"))
      .or(`animal_number.ilike.%${q}%,animal_id.ilike.%${q}%`)
      .order("animal_number", { ascending: true })
      .limit(PAGE_LIMIT);

    const { data, error } = await query;

    searching = false;

    if (error) {
      console.error("Suche Fehler:", error.message);
      results = [];
      renderResults();
      return;
    }

    results = (data || []);
    renderResults();
  }, 200);

  // ---------- Events ----------
  // Tippen → suchen
  elSearch.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    runSearch(val);
    document.getElementById("selected-animals").classList.add("mt-3");
    console.log("Suchbegriff:", val);
  });

  // Fokus → öffnen, wenn es Ergebnisse gibt
  elSearch.addEventListener("focus", () => {
    if (results.length) openDropdown();
  });

  // Keyboard-Steuerung
  elSearch.addEventListener("keydown", (e) => {
    if (!isOpen() && (e.key === "ArrowDown" || e.key === "Enter")) {
      openDropdown();
      return;
    }
    const items = Array.from(elResults.querySelectorAll(".dropdown-item:not(.disabled)"));
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusedIndex = (focusedIndex + 1) % items.length;
      updateFocus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusedIndex = (focusedIndex - 1 + items.length) % items.length;
      updateFocus();
    } else if (e.key === "Enter") {
      if (focusedIndex >= 0 && focusedIndex < items.length) {
        e.preventDefault();
        const idx = Number(items[focusedIndex].getAttribute("data-index"));
        const r = results[idx];
        if (r) addSelection({ id: r.id, label: labelFor(r) });
      }
    } else if (e.key === "Escape") {
      closeDropdown();
    }
  });

  // Klick außerhalb → Dropdown schließen
  document.addEventListener("click", (e) => {
    const within = e.composedPath().includes(elSearch) || e.composedPath().includes(elResults);
    if (!within) closeDropdown();
  });
})();

const dropdown = document.getElementById("animal-results");
const selectedList = document.getElementById("selected-animals");

const observer = new MutationObserver(() => {
  if (dropdown.classList.contains("show")) {
    const rect = dropdown.getBoundingClientRect();
    selectedList.style.marginTop = rect.height + 12 + "px"; // +12px Abstand
  } else {
    selectedList.style.marginTop = "0";
  }
});

observer.observe(dropdown, { attributes: true, attributeFilter: ["class"] });
