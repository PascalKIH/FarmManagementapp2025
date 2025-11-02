// ---------- Supabase Konfiguration ----------
const SUPABASE_URL = "https://kfonugwtvqmpltfdldri.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmb251Z3d0dnFtcGx0ZmRsZHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDY4MDUsImV4cCI6MjA3NDMyMjgwNX0.H-9mm9JdAAhLUrhvSRf_j47POPNQR4MhcXpT3dHCa38";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- Globale Variablen ----------
let currentUser = null;
let currentFarmId = localStorage.getItem("currentFarmId");

const form = document.getElementById("treatment-form");

// ---------- Initialisierung ----------
(async function init() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    alert("Bitte zuerst einloggen!");
    window.location.href = "auth.html";
    return;
  }

  currentUser = session.user;
  document.getElementById("navbar-username").textContent =
    currentUser.user_metadata?.username || currentUser.email;

  await populateTreatmentAnimals();
  await loadMedications();

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await client.auth.signOut();
    window.location.href = "auth.html";
  });
})();

// ---------- Tiere laden ----------
async function populateTreatmentAnimals() {
  const sel = document.getElementById("treatment-animal");
  sel.innerHTML = "<option>-- Tiere werden geladen... --</option>";

  const { data, error } = await client
    .from("animals")
    .select("id, animal_number, gender")
    .eq("farm_id", currentFarmId)
    .order("animal_number");

  if (error) {
    console.error("Fehler beim Laden der Tiere:", error.message);
    sel.innerHTML = "<option>Fehler beim Laden</option>";
    return;
  }

  sel.innerHTML = "<option value=''>-- Tier auswählen --</option>";
  data.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = `${a.animal_number} (${a.gender})`;
    sel.appendChild(opt);
  });
}

// ---------- Medikamente laden ----------
async function loadMedications() {
  const sel = document.getElementById("treatment-medications");
  sel.innerHTML = "<option>-- Medikamente werden geladen... --</option>";

  const { data, error } = await client
    .from("medications")
    .select("id, name")
    .eq("farm_id", currentFarmId)
    .order("name");

  if (error) {
    console.error("Fehler beim Laden der Medikamente:", error.message);
    sel.innerHTML = "<option>Fehler beim Laden</option>";
    return;
  }

  sel.innerHTML = "";
  data.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    sel.appendChild(opt);
  });
}

// ---------- Behandlung speichern ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const animal_id = document.getElementById("treatment-animal").value;
  const treatment_date = document.getElementById("treatment-date").value;
  const description = document.getElementById("treatment-description").value;
  const vet = document.getElementById("treatment-vet").value;
  const medicationIds = Array.from(document.getElementById("treatment-medications").selectedOptions).map(o => o.value);

  const payload = {
    animal_id,
    treatment_date,
    description,
    vet,
    farm_id: currentFarmId,
    created_by: currentUser.id,
    created_by_email: currentUser.email,
    updated_by: currentUser.id,
    updated_by_email: currentUser.email
  };

  const { data, error } = await client.from("treatments").insert([payload]).select().single();
  if (error) {
    alert("Fehler beim Speichern: " + error.message);
    console.error(error);
    return;
  }

  const treatmentId = data.id;
  if (medicationIds.length > 0) {
    const links = medicationIds.map(id => ({ treatment_id: treatmentId, medication_id: id }));
    const { error: linkError } = await client.from("treatment_medications").insert(links);
    if (linkError) console.error("Fehler beim Zuordnen:", linkError.message);
  }

  form.reset();
  alert("Behandlung erfolgreich gespeichert!");
});

// ---------- Behandlungsprotokoll exportieren ----------
document.getElementById("export-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const start = document.getElementById("export-start").value;
  const end = document.getElementById("export-end").value;

  const { data, error } = await client
    .from("treatments")
    .select(`
      treatment_date,
      description,
      vet,
      animals(animal_number)
    `)
    .eq("farm_id", currentFarmId)
    .gte("treatment_date", start)
    .lte("treatment_date", end)
    .order("treatment_date");

  if (error) {
    alert("Fehler beim Laden: " + error.message);
    return;
  }

  if (!data || data.length === 0) {
    alert("Keine Behandlungen im gewählten Zeitraum.");
    return;
  }

  // PDF erstellen
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  pdf.text("Behandlungsprotokoll", 14, 16);
  pdf.setFontSize(10);

  let y = 28;
  data.forEach(row => {
    pdf.text(`${row.treatment_date} – ${row.animals?.animal_number || "?"}`, 14, y);
    pdf.text(row.description, 14, y + 6);
    pdf.text(`Tierarzt: ${row.vet || "-"}`, 14, y + 12);
    y += 22;
  });

  pdf.save(`Behandlungen_${start}_bis_${end}.pdf`);
});
