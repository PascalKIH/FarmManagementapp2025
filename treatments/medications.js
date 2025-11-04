// ---------- Supabase Konfiguration ----------
const SUPABASE_URL = "https://kfonugwtvqmpltfdldri.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmb251Z3d0dnFtcGx0ZmRsZHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDY4MDUsImV4cCI6MjA3NDMyMjgwNX0.H-9mm9JdAAhLUrhvSRf_j47POPNQR4MhcXpT3dHCa38";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- Globale Variablen ----------
let currentUser = null;
let currentFarmId = localStorage.getItem("currentFarmId");

// ---------- DOM Elemente ----------
const form = document.getElementById("medication-form");

// ---------- Initialisierung ----------
(async function init() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    alert("Bitte zuerst einloggen!");
    window.location.href = "../auth.html";
    return;
  }

  currentUser = session.user;
  document.getElementById("navbar-username").textContent =
    currentUser.user_metadata?.username || currentUser.email;

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await client.auth.signOut();
    window.location.href = "../auth.html";
  });
})();

// ---------- Medikament speichern ----------
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("med-name").value.trim();
    const substance = document.getElementById("med-substance").value.trim();
    const indication = document.getElementById("med-indication").value.trim();
    const dosage = document.getElementById("med-dosage").value.trim();
    const administration = document.getElementById("med-administration").value;
    const aftercare = document.getElementById("med-aftercare").value.trim();

    if (!name) {
      alert("Bitte einen Medikamentennamen angeben.");
      return;
    }

    const { data: { user } } = await client.auth.getUser();

    const payload = {
      name,
      substance,
      indication,
      dosage,
      administration,
      aftercare,
      farm_id: currentFarmId,
      created_by: user.id,
      created_by_email: user.email,
      updated_by: user.id,
      updated_by_email: user.email
    };

    const { error } = await client.from("medications").insert([payload]);

    if (error) {
      console.error("Fehler beim Speichern:", error.message);
      alert("Fehler beim Speichern: " + error.message);
      return;
    }

    alert("Medikament erfolgreich gespeichert!");
    form.reset();
  });
}
