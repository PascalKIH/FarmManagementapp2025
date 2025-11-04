/***** Supabase-Konfiguration *****/
const SUPABASE_URL = "https://kfonugwtvqmpltfdldri.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmb251Z3d0dnFtcGx0ZmRsZHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDY4MDUsImV4cCI6MjA3NDMyMjgwNX0.H-9mm9JdAAhLUrhvSRf_j47POPNQR4MhcXpT3dHCa38";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const TEAM_FIELD = "farm_id";

/***** State *****/
let currentUser = null;
let currentFarmId = localStorage.getItem("currentFarmId");
let currentAnimal = null;

// Paging + Filter
let page = 0;
const pageSize = 20;
let filterText = "";
let filterGender = "";

/***** UI Helpers *****/
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const toast = (id, text) => {
  if (text) {
    const elText = qs(id === "#toast-error" ? "#toast-error-text" : null);
    if (elText) elText.textContent = text;
  }
  const t = new bootstrap.Toast(qs(id));
  t.show();
};
const toastOk = (msg = "Gespeichert!") => toast("#toast-success", msg);
const toastErr = (msg = "Fehler") => toast("#toast-error", msg);

function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

/***** Init *****/
(async function init() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = "../auth.html";
    return;
  }
  currentUser = data.session.user;
  qs("#navbar-username").textContent = currentUser.user_metadata?.username || currentUser.email;

  if (!currentFarmId) {
    console.warn("Keine Farm/Team gewählt.");
    return;
  }

  bindEvents();
  await loadAnimals();
})();

/***** Events *****/
function bindEvents() {
  // Desktop Filter
  qs("#refresh-btn")?.addEventListener("click", () => { page = 0; loadAnimals(); });
  qs("#search-input")?.addEventListener("input", debounce(() => {
    filterText = qs("#search-input").value.trim();
    page = 0; loadAnimals();
  }, 250));
  qs("#filter-gender")?.addEventListener("change", () => {
    filterGender = qs("#filter-gender").value;
    page = 0; loadAnimals();
  });

  // Mobile Offcanvas Filter
  qs("#apply-mobile-filter")?.addEventListener("click", () => {
    filterText = qs("#search-input-m").value.trim();
    filterGender = qs("#filter-gender-m").value;
    // optional: in Desktop-Felder spiegeln
    if (qs("#search-input")) qs("#search-input").value = filterText;
    if (qs("#filter-gender")) qs("#filter-gender").value = filterGender;
    page = 0; loadAnimals();
  });

  // Paging
  qs("#prev-page")?.addEventListener("click", () => { if (page > 0) { page--; loadAnimals(); } });
  qs("#next-page")?.addEventListener("click", () => { page++; loadAnimals(); });

  // Formular „Neues Tier“
  const form = qs("#animal-form");
  const resetBtn = qs("#reset-form");
  form?.addEventListener("submit", onSaveAnimal);
  resetBtn?.addEventListener("click", () => form.reset());

  // Logout
  qs("#logout-btn")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("currentFarmId");
    window.location.href = "../auth.html";
  });
}
function isMobile() {
  return window.innerWidth < 768;
}

// holt ALLE Tiere in Chunks (robust bei >1000 rows)
async function fetchAllAnimals(teamId, filterText, filterGender) {
  const PAGE = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    let q = supabase
      .from("animals")
      .select("id, animal_number, animal_id, birth_date, gender, mother_id, father_id")
      .eq("farm_id", teamId)
      .order("animal_number", { ascending: true })
      .range(from, from + PAGE - 1);

    if (filterGender) q = q.eq("gender", filterGender);
    if (filterText) q = q.or(`animal_number.ilike.%${filterText}%,animal_id.ilike.%${filterText}%`);

    const { data, error } = await q;
    if (error) throw error;

    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE) break; // letzte Seite erreicht
    from += PAGE;
  }

  return rows;
}

/***** Tiere laden (mit Filter, Paging) *****/
async function loadAnimals() {
  // Loading UI
  qs("#cards-loading").style.display = "block";
  qs("#animal-cards").innerHTML = "";
  qs("#cards-empty").style.display = "none";
  qs("#table-count").textContent = "";
  qs("#list-meta").textContent = "Laden…";

  try {
    let data = [];
    let total = 0;

    if (isMobile()) {
      // 🔹 MOBIL: alles holen, keine Pagination
      data = await fetchAllAnimals(currentFarmId, filterText, filterGender);
      total = data.length;

      // Tabelle optional leeren (wir zeigen Cards)
      const tbody = qs("#animal-table tbody");
      if (tbody) tbody.innerHTML = "";
    } else {
      // 🔹 DESKTOP: Paged + Count
      let query = supabase
        .from("animals")
        .select("id, animal_number, animal_id, birth_date, gender, mother_id, father_id", { count: "exact" })
        .eq("farm_id", currentFarmId)
        .order("animal_number", { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (filterGender) query = query.eq("gender", filterGender);
      if (filterText) query = query.or(`animal_number.ilike.%${filterText}%,animal_id.ilike.%${filterText}%`);

      const res = await query;
      if (res.error) throw res.error;
      data = res.data || [];
      total = res.count ?? data.length;
    }

    // End Loading
    qs("#cards-loading").style.display = "none";

    // Render
    renderCards(data);
    if (!isMobile()) renderTable(data); // Tabelle nur Desktop

    // Meta / Pager
    if (isMobile()) {
      qs("#list-meta").textContent = total ? `Gesamt: ${total}` : "Keine Einträge";
      qs("#table-count").textContent = qs("#list-meta").textContent;
    } else {
      const from = total === 0 ? 0 : page * pageSize + 1;
      const to = Math.min((page + 1) * pageSize, total);
      qs("#list-meta").textContent = total ? `Zeige ${from}–${to} von ${total}` : "Keine Einträge";
      qs("#table-count").textContent = qs("#list-meta").textContent;
    }

    // Empty state für Cards
    if (!data || data.length === 0) qs("#cards-empty").style.display = "block";

  } catch (err) {
    console.error(err);
    qs("#cards-loading").style.display = "none";
    qs("#list-meta").textContent = "Fehler";
    toastErr(err.message || "Fehler beim Laden");
  }
}

/***** Mobile Karten *****/
function renderCards(rows) {
  const wrap = qs("#animal-cards");
  if (!wrap) return;
  wrap.innerHTML = "";

  (rows || []).forEach(a => {
    const card = document.createElement("div");
    card.className = "col-12";
    card.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body">
          <div class="d-flex align-items-center justify-content-between">
            <div>
              <div class="fw-bold">${a.animal_number ?? "—"}</div>
              <div class="text-muted small">ID: ${a.animal_id ?? "—"}</div>
            </div>
            <span class="badge text-bg-${badgeForGender(a.gender)}">${a.gender ?? "—"}</span>
          </div>
          <div class="mt-2 small">Geboren: ${fmtDate(a.birth_date)}</div>
          <div class="d-flex gap-2 mt-3">
            <button class="btn btn-outline-success btn-sm tap" data-id="${a.id}" data-action="details">Details</button>
          </div>
        </div>
      </div>`;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll("button[data-action='details']").forEach(btn => {
    btn.addEventListener("click", () => openDetails(btn.dataset.id));
  });
}

/***** Desktop Tabelle *****/
function renderTable(rows) {
  const tbody = qs("#animal-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  (rows || []).forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${a.animal_number ?? "—"}</td>
      <td>${a.animal_id ?? "—"}</td>
      <td>${fmtDate(a.birth_date) || "—"}</td>
      <td>${a.gender ?? "—"}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-success tap" data-id="${a.id}" data-action="details">Details</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-action='details']").forEach(btn => {
    btn.addEventListener("click", () => openDetails(btn.dataset.id));
  });
}

function badgeForGender(g) {
  if (g === "weiblich") return "success";
  if (g === "männlich") return "primary";
  return "secondary";
}


/***** Details + Behandlungen + Stammbaum *****/
async function openDetails(id) {
  const { data: a, error } = await supabase
    .from("animals")
    .select("id, animal_number, animal_id, birth_date, gender, mother_id, father_id")
    .eq("id", id)
    .single();

  if (error || !a) {
    toastErr("Tier nicht gefunden");
    return;
  }
  currentAnimal = a;

  qs("#detail-animal-number").textContent = a.animal_number ?? "—";
  qs("#detail-animal-id").textContent = a.animal_id ?? "—";
  qs("#detail-birth-date").textContent = fmtDate(a.birth_date) || "—";
  qs("#detail-gender").textContent = a.gender ?? "—";

  await loadTreatmentsForAnimal(a.id);
  const btn = qs("#show-pedigree");
  if (btn) btn.onclick = () => loadPedigree(a.id);

  new bootstrap.Modal(qs("#animalModal")).show();
}

async function loadTreatmentsForAnimal(animalId) {
  const list = qs("#treatment-list");
  if (!list) return;
  list.innerHTML = "<li class='list-group-item text-muted'>Laden…</li>";

  const { data, error } = await supabase
    .from("treatments")
    .select("id, treatment_date, description, vet")
    .eq("animal_id", animalId)
    .order("treatment_date", { ascending: false });

  if (error) {
    list.innerHTML = "<li class='list-group-item text-danger'>Fehler beim Laden</li>";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<li class='list-group-item text-muted'>Keine Behandlungen vorhanden</li>";
    return;
  }

  list.innerHTML = "";
  data.forEach(t => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `<strong>${fmtDate(t.treatment_date)}</strong>: ${t.description ?? "—"}<br><small>Tierarzt: ${t.vet ?? "—"}</small>`;
    list.appendChild(li);
  });
}

/***** Stammbaum (2 Ebenen – erweiterbar) *****/
async function loadPedigree(animalId) {
  const { data: animal } = await supabase
    .from("animals")
    .select("id, animal_number, gender, birth_date, mother_id, father_id")
    .eq("id", animalId)
    .single();

  async function fetchAnimal(id) {
    if (!id) return null;
    const { data } = await supabase
      .from("animals")
      .select("id, animal_number, gender, mother_id, father_id")
      .eq("id", id)
      .single();
    return data;
  }

  const mother = await fetchAnimal(animal?.mother_id);
  const father = await fetchAnimal(animal?.father_id);

  const treeData = {
    name: `${animal.animal_number ?? "?"} (${animal.gender ?? "?"})`,
    children: [
      mother ? { name: `${mother.animal_number} (${mother.gender})` } : { name: "Mutter unbekannt" },
      father ? { name: `${father.animal_number} (${father.gender})` } : { name: "Vater unbekannt" }
    ]
  };

  renderPedigree(treeData);
}

function renderPedigree(treeData) {
  const container = qs("#pedigree-container");
  if (!container) return;
  container.style.display = "block";

  const svg = d3.select("#pedigree-chart");
  svg.selectAll("*").remove();

  const rect = svg.node().getBoundingClientRect();
  const width = rect.width || 600;
  const height = 400;

  const root = d3.hierarchy(treeData);
  const treeLayout = d3.tree().size([width - 40, height - 40]);
  treeLayout(root);

  svg.append("g")
    .selectAll("line")
    .data(root.links())
    .enter()
    .append("line")
    .attr("x1", d => d.source.x + 20)
    .attr("y1", d => d.source.y + 20)
    .attr("x2", d => d.target.x + 20)
    .attr("y2", d => d.target.y + 20)
    .attr("stroke", "#6c757d");

  const node = svg.append("g")
    .selectAll("g")
    .data(root.descendants())
    .enter()
    .append("g")
    .attr("transform", d => `translate(${d.x + 20},${d.y + 20})`);

  node.append("circle").attr("r", 18).attr("fill", "#198754");
  node.append("text")
    .attr("dy", 5)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .style("font-size", "12px")
    .text(d => d.data.name);
}

/***** Utilities *****/
function debounce(fn, ms) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
