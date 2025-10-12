// ---------- Supabase Setup ----------
const SUPABASE_URL = "https://kfonugwtvqmpltfdldri.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmb251Z3d0dnFtcGx0ZmRsZHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDY4MDUsImV4cCI6MjA3NDMyMjgwNX0.H-9mm9JdAAhLUrhvSRf_j47POPNQR4MhcXpT3dHCa38";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 🔹 redirect token handling (verhindert „Auth session missing“) ---
(async function handleRedirect() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const type = params.get("type");

  if (access_token && refresh_token) {
    console.log("🔐 Session aus Redirect erkannt – setze Tokens...");
    await supabase.auth.setSession({ access_token, refresh_token });

    // optional: Nutzer sofort weiterleiten
    if (type === "signup") {
      alert("✅ E-Mail erfolgreich bestätigt!");
      window.location.href = "login_register.html";
    }
  }
})();

let currentUser = null;


// ---------- LOGIN ----------
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert("Login fehlgeschlagen: " + error.message);

  currentUser = data.user || data.session?.user;

  // Farmzuordnung prüfen
  const { data: farmUser, error: farmError } = await supabase
    .from("farm_users")
    .select("farm_id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (farmError) return alert("Fehler beim Laden der Farm: " + farmError.message);

  if (!farmUser) {
    alert("Du bist noch keiner Farm zugeordnet. Bitte registriere dich neu oder trete einer Farm bei.");
    return;
  }

  localStorage.setItem("currentFarmId", farmUser.farm_id);
  window.location.href = "index.html";
});


// ---------- REGISTRIERUNG ----------
document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("register-username").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value.trim();
  const farmName = document.getElementById("farm-name").value.trim();
  const farmCode = document.getElementById("farm-code").value.trim().toUpperCase();

  // 1️⃣ Benutzer registrieren
  console.log("Registriere Benutzer...", { email, username, farmName, farmCode });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { 
          emailRedirectTo: "https://farm-app.vercel.app/auth.html",
      data: { username } 
    }
  });

  if (error) {
    alert("Fehler bei Registrierung: " + error.message);
    return;
  }

  // Wenn Email-Verifizierung aktiv ist → user = null
  if (!data.user.email_confirmed_at) {
    console.log("Verifizierung erforderlich – zeige Modal");
    startVerificationPolling(username, farmName, farmCode);
    return;
  }

  // Wenn Email-Verifizierung deaktiviert → direkt weiter
  handleFarmSetup(data.user, username, farmName, farmCode);
});


// ---------- VERIFIZIERUNGS-MODAL MIT POLLING ----------
function startVerificationPolling(username, farmName, farmCode) {
  const modalEl = document.getElementById("verifyModal");
  if (!modalEl) {
    console.error("verifyModal fehlt im HTML!");
    return;
  }

  const verifyModal = new bootstrap.Modal(modalEl);
  const checkBtn = document.getElementById("check-verification-btn");
  const verifyStatus = document.getElementById("verify-status");

  verifyModal.show();
  verifyStatus.textContent = "Bitte bestätige deine E-Mail-Adresse. Wir prüfen automatisch...";

  let checkInterval = setInterval(async () => {
    const { data: userData, error: checkError } = await supabase.auth.getUser();
    console.log("Prüfe Verifizierung...", userData);
    if (checkError) return console.warn(checkError.message);
    console.log("Prüfe Verifizierung...", userData);

    if (userData.user && userData.user.email_confirmed_at) {
      clearInterval(checkInterval);
      verifyStatus.textContent = "✅ E-Mail bestätigt! Einen Moment...";
      setTimeout(() => {
        verifyModal.hide();
        handleFarmSetup(userData.user, username, farmName, farmCode);
      }, 1200);
    }
  }, 5000);

  // Manuelles Prüfen-Button
  checkBtn.addEventListener("click", async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user && userData.user.email_confirmed_at) {
      clearInterval(checkInterval);
      verifyStatus.textContent = "✅ E-Mail bestätigt!";
      setTimeout(() => {
        verifyModal.hide();
        handleFarmSetup(userData.user, username, farmName, farmCode);
      }, 1200);
    } else {
      verifyStatus.textContent = "❌ Noch nicht bestätigt – bitte prüfe deine Mails.";
    }
  });
}


// ---------- FARM ERSTELLUNG / BEITRITT ----------
async function handleFarmSetup(currentUser, username, farmName, farmCode) {
  let farmId = null;

  // Neue Farm erstellen
  if (farmName) {
    const inviteCode = generateInviteCode();

    const { data: farm, error: farmError } = await supabase
      .from("farms")
      .insert([{ name: farmName, invite_code: inviteCode }])
      .select()
      .single();

    if (farmError) {
      alert("Fehler beim Erstellen der Farm: " + farmError.message);
      return;
    }

    farmId = farm.id;

    await supabase.from("farm_users").insert([{
      user_id: currentUser.id,
      farm_id: farmId,
      role: "admin",
      username: currentUser.user_metadata?.username || username || null
    }]);

    alert(`Farm "${farmName}" erstellt! Einladungscode: ${inviteCode}`);
  }

  // Farm beitreten
  else if (farmCode) {
    const { data: farm, error: codeError } = await supabase
      .from("farms")
      .select("id")
      .eq("invite_code", farmCode)
      .single();

    if (codeError || !farm) {
      alert("Ungültiger Farm-Code");
      return;
    }

    farmId = farm.id;

    await supabase.from("farm_users").insert([{
      user_id: currentUser.id,
      farm_id: farmId,
      role: "member",
      username
    }]);

    alert("Erfolgreich der Farm beigetreten!");
  } else {
    alert("Bitte Farmname oder Code eingeben.");
    return;
  }

  localStorage.setItem("currentFarmId", farmId);
  window.location.href = "index.html";
}


// ---------- Helper ----------
function generateInviteCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}
