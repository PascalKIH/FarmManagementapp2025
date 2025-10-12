// ---------- Supabase Konfiguration ----------
const SUPABASE_URL = "https://kfonugwtvqmpltfdldri.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmb251Z3d0dnFtcGx0ZmRsZHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDY4MDUsImV4cCI6MjA3NDMyMjgwNX0.H-9mm9JdAAhLUrhvSRf_j47POPNQR4MhcXpT3dHCa38";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- Globale Variablen ----------
let currentUser = null;
let currentFarmId = localStorage.getItem("currentFarmId");

// ---------- DOM Elemente ----------
const moveForm = document.getElementById("move-animal-form");
const moveAnimalSelect = document.getElementById("move-animal");
const moveLocationSelect = document.getElementById("move-location");
const locationForm = document.getElementById("location-form");

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

  await loadAnimals();
  await loadLocations();

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await client.auth.signOut();
    window.location.href = "auth.html";
  });
})();

// ---------- Tiere laden ----------
async function loadAnimals() {
  if (!currentFarmId) return;

  const { data, error } = await client
    .from("animals")
    .select("id, animal_number, gender")
    .eq("farm_id", currentFarmId)
    .order("animal_number");

  if (error) {
    console.error("Fehler beim Laden der Tiere:", error.message);
    return;
  }

  moveAnimalSelect.innerHTML = "";
  data.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = `${a.animal_number} (${a.gender})`;
    moveAnimalSelect.appendChild(opt);
  });
}

// ---------- Aufenthaltsorte laden ----------
async function loadLocations() {
  if (!currentFarmId) return;

  const { data, error } = await client
    .from("locations")
    .select("id, name, capacity")
    .eq("farm_id", currentFarmId)
    .order("name");

  if (error) {
    console.error("Fehler beim Laden der Orte:", error.message);
    return;
  }

  moveLocationSelect.innerHTML = "<option value=''>-- Zielort wählen --</option>";
  data.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc.id;
    opt.textContent = `${loc.name} (Kapazität: ${loc.capacity})`;
    moveLocationSelect.appendChild(opt);
  });
}

// ---------- Tiere verschieben ----------
if (moveForm) {
  moveForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedAnimals = Array.from(moveAnimalSelect.selectedOptions).map(o => o.value);
    const locationId = moveLocationSelect.value;

    if (selectedAnimals.length === 0) {
      alert("Bitte mindestens ein Tier auswählen.");
      return;
    }
    if (!locationId) {
      alert("Bitte Zielort auswählen.");
      return;
    }

    const { data: { user } } = await client.auth.getUser();

    const { error } = await client
      .from("animals")
      .update({
        location_id: locationId,
        updated_by: user.id,
        updated_by_email: user.email
      })
      .in("id", selectedAnimals);

    if (error) {
      alert("Fehler beim Verschieben: " + error.message);
      console.error(error);
      return;
    }

    alert(`${selectedAnimals.length} Tier(e) erfolgreich verschoben!`);
    await loadAnimals();
  });
}

// ---------- Ort speichern ----------
if (locationForm) {
  locationForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("location-name").value.trim();
    const capacity = parseInt(document.getElementById("location-capacity").value, 10);

    if (!name || isNaN(capacity)) {
      alert("Bitte alle Felder ausfüllen.");
      return;
    }

    const { data: { user } } = await client.auth.getUser();

    const payload = {
      name,
      capacity,
      farm_id: currentFarmId,
      created_by: user.id,
      created_by_email: user.email,
      updated_by: user.id,
      updated_by_email: user.email
    };

    const { error } = await client.from("locations").insert([payload]);

    if (error) {
      alert("Fehler beim Speichern des Ortes: " + error.message);
      console.error(error);
      return;
    }

    alert("Ort erfolgreich gespeichert!");
    locationForm.reset();
    await loadLocations();
  });
}
