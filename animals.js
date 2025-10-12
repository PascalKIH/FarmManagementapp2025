// ---------- Supabase Config ----------
const SUPABASE_URL = "https://kfonugwtvqmpltfdldri.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmb251Z3d0dnFtcGx0ZmRsZHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDY4MDUsImV4cCI6MjA3NDMyMjgwNX0.H-9mm9JdAAhLUrhvSRf_j47POPNQR4MhcXpT3dHCa38";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- Globale Variablen ----------
let currentUser = null;
let currentFarmId = localStorage.getItem("currentFarmId");
const modal = new bootstrap.Modal(document.getElementById("animalModal"));
const tableBody = document.querySelector("#animal-table tbody");

// ---------- Initialisierung ----------
(async function init() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    alert("Bitte zuerst einloggen!");
    window.location.href = "auth.html";
    return;
  }

  currentUser = session.user;

  // Nutzername im Navbar
  document.getElementById("navbar-username").textContent =
    currentUser.user_metadata?.username || currentUser.email;

  await loadAnimals();
  await populateParentSelects();

  // Logout
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await client.auth.signOut();
    window.location.href = "auth.html";
  });
})();

// ---------- Tiere laden ----------
async function loadAnimals() {
  if (!currentFarmId) {
    tableBody.innerHTML = "<tr><td colspan='3'>Keine Farm ausgewählt</td></tr>";
    return;
  }

  const { data, error } = await client
    .from("animals")
    .select("id, animal_number, birth_date, gender")
    .eq("farm_id", currentFarmId)
    .order("animal_number", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden:", error.message);
    return;
  }

  tableBody.innerHTML = "";
  data.forEach(animal => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${animal.animal_number}</td>
      <td>${animal.birth_date || ""}</td>
      <td>${animal.gender || ""}</td>
    `;
    tr.addEventListener("click", () => showAnimalDetails(animal));
    tableBody.appendChild(tr);
  });
}

// ---------- Neues Tier speichern ----------
document.getElementById("animal-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentFarmId) return alert("Keine Farm ausgewählt.");

  const payload = {
    animal_number: document.getElementById("animal_number").value.trim(),
    birth_date: document.getElementById("birth_date").value,
    gender: document.getElementById("gender").value,
    mother_id: document.getElementById("mother_id").value || null,
    father_id: document.getElementById("father_id").value || null,
    farm_id: currentFarmId,
    created_by: currentUser.id,
    created_by_email: currentUser.email,
    updated_by: currentUser.id,
    updated_by_email: currentUser.email
  };

  const { error } = await client.from("animals").insert([payload]);

  if (error) {
    alert("Fehler beim Speichern: " + error.message);
    console.error(error);
    return;
  }

  e.target.reset();
  await loadAnimals();
  await populateParentSelects();
});

// ---------- Eltern-Dropdowns ----------
async function populateParentSelects() {
  if (!currentFarmId) return;
  const { data, error } = await client
    .from("animals")
    .select("id, animal_number, gender")
    .eq("farm_id", currentFarmId);

  if (error) return;

  const mother = document.getElementById("mother_id");
  const father = document.getElementById("father_id");
  mother.innerHTML = '<option value="">Unbekannt</option>';
  father.innerHTML = '<option value="">Unbekannt</option>';

  data.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = `${a.animal_number} (${a.gender})`;
    mother.appendChild(opt.cloneNode(true));
    father.appendChild(opt);
  });
}


// ---------- Tierdetails anzeigen ----------
function showAnimalDetails(animal) {
  const detailNumber = document.getElementById("detail-animal-number");
  const detailDate = document.getElementById("detail-birth-date");
  const detailGender = document.getElementById("detail-gender");
  currentAnimal = animal;
  detailNumber.textContent = animal.animal_number;
  detailDate.textContent = animal.birth_date || "";
  detailGender.textContent = animal.gender || "";

  // Behandlungen laden
  loadTreatmentsForAnimal(animal.id);

  // Stammbaum-Container anfangs ausblenden
  const pedigreeContainer = document.getElementById("pedigree-container");
  pedigreeContainer.style.display = "none";

  // Button: Stammbaum anzeigen
  const showPedigreeBtn = document.getElementById("show-pedigree");
  showPedigreeBtn.onclick = async () => {
    pedigreeContainer.style.display = "block";
    await drawPedigreeChart(animal.id);
  };

  modal.show();
}

// ---------- Behandlungen für das Tier laden ----------
async function loadTreatmentsForAnimal(animalId) {
  if (!animalId || !currentFarmId) return;

  const list = document.getElementById("treatment-list");
  list.innerHTML = "<li class='list-group-item text-muted'>Lade Daten...</li>";

  const { data, error } = await client
    .from("treatments")
    .select(`
      id,
      treatment_date,
      description,
      vet,
      created_by_email,
      treatment_medications (
        medications ( name, dosage, administration )
      )
    `)
    .eq("animal_id", animalId)
    .eq("farm_id", currentFarmId)
    .order("treatment_date", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Behandlungen:", error.message);
    list.innerHTML = "<li class='list-group-item text-danger'>Fehler beim Laden</li>";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<li class='list-group-item text-muted'>Keine Behandlungen vorhanden</li>";
    return;
  }

  list.innerHTML = "";
  data.forEach(t => {
    const meds = t.treatment_medications?.map(tm => {
      const m = tm.medications;
      return `${m.name} (${m.dosage || "-"}, ${m.administration || "-"})`;
    })?.join(", ") || "Keine Medikamente";

    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <strong>${t.treatment_date || "Unbekannt"}</strong>  
      – ${t.description || ""}<br>
      <small>
        Tierarzt: ${t.vet || "—"} | 
        Medikamente: ${meds}<br>
        Eingetragen von: ${t.created_by_email || "—"}
      </small>
    `;
    list.appendChild(li);
  });
}

// ---------- Stammbaum zeichnen ----------
async function drawPedigreeChart(animalId, generations = 4) {
  const svg = document.getElementById("pedigree-chart");
  svg.innerHTML = ""; // Alte Zeichnung löschen

  if (!animalId || !currentFarmId) return;

  // Tiere rekursiv laden
  const animalsMap = new Map();
  await loadAncestorsRecursive(animalId, 0, generations, animalsMap);

  // SVG-Konfiguration
  const width = 600, height = 400;
  const genGapY = 100;
  const nodeWidth = 100, nodeHeight = 30;
  const ns = "http://www.w3.org/2000/svg";

  // Nach Generation gruppieren
  const gens = Array.from(animalsMap.values()).reduce((acc, a) => {
    if (!acc[a.generation]) acc[a.generation] = [];
    acc[a.generation].push(a);
    return acc;
  }, {});

  // Knoten zeichnen
  Object.keys(gens).forEach(g => {
    const generation = parseInt(g);
    const y = 50 + generation * genGapY;
    const animals = gens[g];
    const stepX = width / (animals.length + 1);

    animals.forEach((a, i) => {
      const x = stepX * (i + 1);

      // Linie zu Kind
      if (a.childId && animalsMap.has(a.childId)) {
        const child = animalsMap.get(a.childId);
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", x);
        line.setAttribute("y1", y + nodeHeight / 2);
        line.setAttribute("x2", child.x || width / 2);
        line.setAttribute("y2", y + genGapY - nodeHeight / 2);
        line.setAttribute("stroke", "#bbb");
        line.setAttribute("stroke-width", "1");
        svg.appendChild(line);
      }

      // Rechteck
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", x - nodeWidth / 2);
      rect.setAttribute("y", y - nodeHeight / 2);
      rect.setAttribute("width", nodeWidth);
      rect.setAttribute("height", nodeHeight);
      rect.setAttribute("rx", 6);
      rect.setAttribute("fill", "#e9f7ef");
      rect.setAttribute("stroke", "#198754");
      rect.setAttribute("stroke-width", "1.5");
      svg.appendChild(rect);

      // Text
      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", x);
      text.setAttribute("y", y + 4);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "12");
      text.setAttribute("fill", "#198754");
      text.textContent = a.animal_number || "Unbekannt";
      svg.appendChild(text);

      // Position speichern
      a.x = x;
      a.y = y;
    });
  });
}

// ---------- Ahnen (Eltern) rekursiv laden ----------
async function loadAncestorsRecursive(animalId, generation, maxGen, map, childId = null) {
  if (generation >= maxGen) return;

  const { data, error } = await client
    .from("animals")
    .select("id, animal_number, mother_id, father_id")
    .eq("id", animalId)
    .eq("farm_id", currentFarmId)
    .maybeSingle();

  if (error || !data) return;

  data.generation = generation;
  data.childId = childId;
  map.set(data.id, data);

  if (data.mother_id)
    await loadAncestorsRecursive(data.mother_id, generation + 1, maxGen, map, data.id);
  if (data.father_id)
    await loadAncestorsRecursive(data.father_id, generation + 1, maxGen, map, data.id);
}
