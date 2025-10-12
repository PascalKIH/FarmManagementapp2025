const SUPABASE_URL = "https://kfonugwtvqmpltfdldri.supabase.co"; // <-- dein Projekt
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmb251Z3d0dnFtcGx0ZmRsZHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDY4MDUsImV4cCI6MjA3NDMyMjgwNX0.H-9mm9JdAAhLUrhvSRf_j47POPNQR4MhcXpT3dHCa38";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentFarm = null;

// ---------------- Session laden ----------------
supabase.auth.getSession().then(async ({ data }) => {
  if (!data.session) {
    window.location.href = "auth.html"; // nicht eingeloggt → zurück zur Auth-Seite
    return;
  }

  currentUser = data.session.user;
  await loadFarmAndProfile();
});

// ---------------- Logout ----------------
document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  localStorage.removeItem("currentFarmId");
  window.location.href = "auth.html";
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

  // UI aktualisieren
  document.getElementById("farm-info").innerHTML = `
    Du bist in der Farm <strong>${farm.name}</strong>.
  `;

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


}
