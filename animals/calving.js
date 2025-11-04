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

  // Eltern-Dropdowns füllen
  await populateParentSelects();

  // Form-Events
  const form = qs("#animal-form");
  const resetBtn = qs("#reset-form");
  if (form) form.addEventListener("submit", onSaveAnimal);
  if (resetBtn) resetBtn.addEventListener("click", () => form?.reset());
})();

/***** Eltern-Dropdowns *****/
async function populateParentSelects() {
  const selM = qs("#mother_id");
  const selF = qs("#father_id");
  if (!selM || !selF) return;

  const { data, error } = await supabase
    .from("animals")
    .select("id, animal_number, gender")
    .eq(TEAM_FIELD, currentFarmId)
    .order("animal_number", { ascending: true });

  selM.innerHTML = '<option value="">Unbekannt</option>';
  selF.innerHTML = '<option value="">Unbekannt</option>';

  if (error) return;

  (data || []).forEach(a => {
    const o = document.createElement("option");
    o.value = a.id;
    o.textContent = `${a.animal_number} (${a.gender})`;
    selM.appendChild(o.cloneNode(true));
    selF.appendChild(o);
  });
}

/***** Duplikate prüfen *****/
async function hasDuplicateAnimal({ animal_number, animal_id }) {
  // Prüft innerhalb der aktuellen Farm, ob die Tiernummer ODER die Tier-ID bereits existiert
  // Hinweis: ilike für case-insensitive, kannst du auch eq verwenden, wenn exakt
  const { data, error } = await supabase
    .from("animals")
    .select("id, animal_number, animal_id")
    .eq("farm_id", currentFarmId)
    .or(
      [
        animal_number ? `animal_number.eq.${escapeOr(animal_number)}` : null,
        animal_id ? `animal_id.eq.${escapeOr(animal_id)}` : null
      ].filter(Boolean).join(",")
    )
    .limit(1);

  if (error) {
    console.error(error);
    throw new Error("Duplikatprüfung fehlgeschlagen.");
  }
  return Array.isArray(data) && data.length > 0;
}

// supabase or() helper – einfache Escapes für Komma/Komponentensonderfälle
function escapeOr(v) {
  // Supabase-Filter erwartet rohe Werte; falls Komma o.ä. vorkommt, einfache Escapes:
  return String(v).replace(/,/g, "\\,");
}



/***** Neues Tier speichern *****/
async function onSaveAnimal(e) {
  e.preventDefault();
  const form = e.currentTarget;

  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  const payload = {
    animal_number: qs("#animal_number").value.trim(),
    animal_id: qs("#animal_id").value.trim(),
    birth_date: qs("#birth_date").value || null,
    gender: qs("#gender").value || null,
    mother_id: qs("#mother_id").value || null,
    father_id: qs("#father_id").value || null,
    [TEAM_FIELD]: currentFarmId
  };
  try {
    const duplicate = await hasDuplicateAnimal(payload);
    if (duplicate) {
      showAlert(
        "danger",
        `
          <strong>Speichern nicht möglich:</strong> 
          Diese <em>Tiernummer</em> oder <em>Tier-ID</em> existiert bereits in dieser Farm.
          <br>Bitte prüfe deine Eingaben.
        `
      );
      return;
    } else {
      showAlert("success", "Keine Duplikate gefunden, speichere Tier...");
    }
    } catch (err) {
    showAlert("danger", err.message || "Duplikatprüfung fehlgeschlagen.");
    return;
    }

    const { error } = await supabase.from("animals").insert([payload]);
    if (error) {
        console.error(error);
        toastErr(error.message);
        return;
    }

    form.reset();
    form.classList.remove("was-validated");
    await populateParentSelects();
    page = 0;
    showAlert(
    "success",
    `
        <div class="d-flex align-items-start gap-3">
        <div class="mt-1">✅</div>
        <div>
            <div class="fw-semibold">Tier erfolgreich gespeichert.</div>
            <div class="mt-1 small text-muted">Zusammenfassung:</div>
            <ul class="mb-0 mt-1">
            <li><strong>Tiernummer:</strong> ${payload.animal_number || "—"}</li>
            <li><strong>Tier-ID:</strong> ${payload.animal_id || "—"}</li>
            <li><strong>Geburtsdatum:</strong> ${fmtDate(payload.birth_date) || "—"}</li>
            <li><strong>Geschlecht:</strong> ${payload.gender || "—"}</li>
            </ul>
        </div>
        </div>
    `
  );
}

