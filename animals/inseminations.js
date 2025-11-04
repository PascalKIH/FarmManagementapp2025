const SUPABASE_URL = "https://kfonugwtvqmpltfdldri.supabase.co"; // <-- dein Projekt
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmb251Z3d0dnFtcGx0ZmRsZHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDY4MDUsImV4cCI6MjA3NDMyMjgwNX0.H-9mm9JdAAhLUrhvSRf_j47POPNQR4MhcXpT3dHCa38";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentFarmId = localStorage.getItem("currentFarmId");

// ---------------- Session laden ----------------
supabase.auth.getSession().then(async ({ data }) => {
  if (!data.session) {
    window.location.href = "../auth.html"; // nicht eingeloggt → zurück zur Auth-Seite
    return;
  }

  currentUser = data.session.user;
  await loadFarmAndProfile();
});

// ---------------- Logout ----------------
document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  localStorage.removeItem("currentFarmId");
  window.location.href = "../auth.html";
});

// ---------------- Farm + Profil laden ----------------
async function loadFarmAndProfile() {
  const farmId = localStorage.getItem("currentFarmId");
  if (!farmId) {
    document.getElementById("farm-info").textContent = "Keine Farm ausgewählt!";
    return;
  }

  // Farm aus DB laden
  const { data: farm, error } = await supabase
    .from("farms")
    .select("id, name, invite_code")
    .eq("id", farmId)
    .single();

  if (error || !farm) {
    document.getElementById("farm-info").textContent = "Farm nicht gefunden!";
    return;
  }

  currentFarm = farm;

  

  document.getElementById("navbar-username").textContent = currentUser.user_metadata?.username || currentUser.email;

  // Profil Modal füllen
  document.getElementById("profile-username").textContent =
    currentUser.user_metadata?.username || "(kein Benutzername)";
  document.getElementById("profile-email").textContent = currentUser.email;
  document.getElementById("profile-farm").textContent = farm.name;
  document.getElementById("profile-farmcode").textContent = farm.invite_code;
  document.getElementById("navbar-username").textContent =
  currentUser.user_metadata?.username || currentUser.email;
  document.getElementById("profile-username").textContent =
  currentUser.user_metadata?.username || "(kein Benutzername)";
  populateInseminationAnimals();
  populateBullSelect();
}

// ---------- Tiere laden ----------
async function populateInseminationAnimals() {
  const sel = document.getElementById("insemination-animal");
  sel.innerHTML = "<option>-- Tiere werden geladen... --</option>";

  const { data, error } = await supabase
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
    if (a.gender != 'weiblich') return; // nur weibliche Tiere anzeigen
    opt.textContent = `${a.animal_number} (${a.gender})`;
    sel.appendChild(opt);
  });
}
async function populateBullSelect() {
    const sel = document.getElementById("bull_id");
    sel.innerHTML = "<option>-- Bullen werden geladen... --</option>";

    const { data, error } = await supabase
        .from("bulls")
        .select("id, name")
        .eq("farm_id", currentFarmId)
        .order("name");

    if (error) {
        console.error("Fehler beim Laden der Bullen:", error.message);
        sel.innerHTML = "<option>Fehler beim Laden</option>";
        return;
    }

    sel.innerHTML = "<option value=''>-- Bullen auswählen --</option>";
    data.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b.id;
        opt.textContent = b.name;
        sel.appendChild(opt);
    });
}

// ---------- Besamung speichern ----------
document.getElementById("insemination-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const animalId = document.getElementById("insemination-animal").value;
  const date = document.getElementById("insemination_date").value;
  const bullId = document.getElementById("bull_id").value;

  if (!animalId || !date || !bullId) {
    alert("Bitte alle Felder ausfüllen.");
    return;
  }

  const { data, error } = await supabase
    .from("inseminations")
    .insert([
      {
        animal_id: animalId,
        date: date,
        bull_id: bullId,
        farm_id: currentFarmId,
        created_by: currentUser.id
      }
    ]);

  if (error) {
    console.error("Fehler beim Speichern der Besamung:", error.message);
    alert("Fehler beim Speichern der Besamung.");
    return;
  }

  alert("Besamung erfolgreich gespeichert!");
  document.getElementById("insemination-form").reset();
  populateInseminationAnimals();
});

document.getElementById("add-bull-btn").addEventListener("click", () => {
  const addBullModal = new bootstrap.Modal(document.getElementById("addBullModal"));
  addBullModal.show();
});
document.getElementById("save-bull-btn").onclick = async function() {
    const bullName = document.getElementById("bull-name").value.trim();
    const bullBreed = document.getElementById("bull-breed").value.trim();

    if (!bullName || !bullBreed) {
        alert("Bitte alle Felder ausfüllen.");
        return;
    }

    const payload = {
        name: bullName,
        breed: bullBreed,
        farm_id: currentFarmId,
    };

    console.log("➡️ Sende Payload:", payload);

    try {
    const { data, error } = await supabase
        .from("bulls")
        .insert([{ name: bullName, breed: bullBreed, farm_id: currentFarmId }])
        .select()
        .single();

    if (error) throw error;

    alert(`Bulle "${data.name}" erfolgreich gespeichert!`);
    document.getElementById("add-bull-form").reset();
    } catch (err) {
    console.error("Fehler beim Speichern des Bullen:", err.message);
    alert("Fehler beim Speichern des Bullen: " + err.message);
    }


    alert("✅ Bulle erfolgreich gespeichert!");
    document.getElementById("add-bull-form").reset();
    populateBullSelect();
    addBullModal.hide();
};

