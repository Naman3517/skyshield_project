const API_BASE = "http://127.0.0.1:8000";
const THEME_STORAGE_KEY = "skyshield_theme";

const form = document.getElementById("incidentForm");
const formMessage = document.getElementById("formMessage");
const actionBanner = document.getElementById("actionBanner");
const incidentsList = document.getElementById("incidentsList");
const incidentCount = document.getElementById("incidentCount");

const filterTail = document.getElementById("filterTail");
const filterSeverity = document.getElementById("filterSeverity");
const filterStatus = document.getElementById("filterStatus");
const filterCompliance = document.getElementById("filterCompliance");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const refreshBtn = document.getElementById("refreshBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");

const statTotal = document.getElementById("statTotal");
const statNonCompliant = document.getElementById("statNonCompliant");
const statOpen = document.getElementById("statOpen");

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isDark ? "Command Light Theme" : "Night Ops Theme";
    themeToggleBtn.setAttribute("aria-pressed", String(isDark));
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  } catch (_) {
    // Ignore storage restrictions
  }
}

function initTheme() {
  let saved = "light";
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY) || "light";
  } catch (_) {
    saved = "light";
  }
  applyTheme(saved);
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

function setBanner(message, isError = false) {
  actionBanner.textContent = message;
  actionBanner.style.color = isError ? "#b91c1c" : "#15803d";
}

function updateSummaryStats(items) {
  statTotal.textContent = items.length;
  statNonCompliant.textContent = items.filter((item) => item.is_compliant === false).length;
  statOpen.textContent = items.filter((item) => (item.status || "").toLowerCase() === "open").length;
}

async function loadIncidents() {
  incidentsList.innerHTML = `<p class="muted">Loading incidents...</p>`;

  const params = new URLSearchParams();
  if (filterTail.value.trim()) params.set("tail_number", filterTail.value.trim());
  if (filterSeverity.value) params.set("severity", filterSeverity.value);
  if (filterStatus.value) params.set("status", filterStatus.value);
  if (filterCompliance.value) params.set("is_compliant", filterCompliance.value);

  const queryString = params.toString() ? `?${params.toString()}` : "";

  try {
    const res = await fetch(`${API_BASE}/incidents${queryString}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    const items = result.data || [];

    incidentCount.textContent = result.count ?? items.length;
    updateSummaryStats(items);

    if (items.length === 0) {
      incidentsList.innerHTML = `<p class="muted">No matching incident reports found.</p>`;
      return;
    }

    incidentsList.innerHTML = items
      .map((item) => {
        const nextCompliant = !Boolean(item.is_compliant);
        const nextStatus = item.status === "closed" ? "open" : "closed";
        const safeTail = escapeHtml(item.tail_number || "");
        const sevKey = String(item.severity || "medium").toLowerCase();
        const cardSevClass =
          sevKey === "critical" ? "sev-critical" : sevKey === "high" ? "sev-high" : sevKey === "low" ? "sev-low" : "";
        const badgeSevClass =
          sevKey === "critical" ? "badge-critical" : sevKey === "high" ? "badge-high" : sevKey === "low" ? "badge-low" : "";

        return `
          <article class="incident-item ${cardSevClass}">
            <div class="incident-top">
              <strong>${escapeHtml(item.tail_number || "N/A")} — ${escapeHtml(item.location || "N/A")}</strong>
              <div class="badges">
                <span class="badge ${badgeSevClass}">${escapeHtml(item.severity || "Unknown")}</span>
                <span class="badge badge-status">${escapeHtml(item.status || "open")}</span>
                ${
                  item.is_compliant === false
                    ? `<span class="badge badge-warn">Non-Compliant</span>`
                    : `<span class="badge badge-ok">Compliant</span>`
                }
              </div>
            </div>
            <p class="meta">
              Date: ${escapeHtml(item.incident_date ? item.incident_date.slice(0, 10) : "N/A")} |
              Regulator: ${escapeHtml(item.regulatory_body || "N/A")} |
              Compliant: ${item.is_compliant ? "Yes" : "No"} |
              Status: ${escapeHtml(item.status || "N/A")}
            </p>
            <p>${escapeHtml(item.description || "")}</p>
            ${
              item.root_cause
                ? `<p class="meta" style="margin-top:0.4rem;"><strong>Root Cause:</strong> ${escapeHtml(item.root_cause)}</p>`
                : ""
            }
            <div class="incident-actions">
              <button type="button" class="btn btn-sm" onclick="toggleRootCauseBox('${item.id}')">Edit Root Cause</button>
              <button type="button" class="btn btn-sm" onclick="updateIncidentField('${item.id}', { is_compliant: ${nextCompliant} }, 'Compliance updated')">
                Mark ${item.is_compliant ? "Non-Compliant" : "Compliant"}
              </button>
              <button type="button" class="btn btn-sm" onclick="updateIncidentField('${item.id}', { status: '${nextStatus}' }, 'Status updated to ${nextStatus}')">
                ${item.status === "closed" ? "Reopen" : "Close"} Report
              </button>
              <button type="button" class="btn btn-sm btn-danger" onclick="deleteIncident('${item.id}', '${safeTail}')">
                Delete
              </button>
            </div>
            <div id="rc-box-${item.id}" class="inline-edit" style="display: none;">
              <input
                id="rc-input-${item.id}"
                type="text"
                value="${escapeHtml(item.root_cause || "")}"
                placeholder="Enter root cause..."
              />
              <button type="button" class="btn btn-sm" onclick="saveRootCause('${item.id}')">Save</button>
              <button type="button" class="btn btn-sm btn-secondary" onclick="toggleRootCauseBox('${item.id}')">Cancel</button>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (err) {
    incidentsList.innerHTML = `<p class="status-msg" style="color:#b91c1c;">Failed to load incidents: ${escapeHtml(err.message)}</p>`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMessage.textContent = "Submitting...";
  formMessage.style.color = "var(--text-sub)";

  const payload = {
    tail_number: document.getElementById("tail_number").value.trim(),
    location: document.getElementById("location").value.trim(),
    severity: document.getElementById("severity").value,
    description: document.getElementById("description").value.trim(),
    is_compliant: document.getElementById("is_compliant").checked,
  };

  const incidentDate = document.getElementById("incident_date").value;
  const regulatoryBody = document.getElementById("regulatory_body").value.trim();
  const rootCause = document.getElementById("root_cause").value.trim();

  if (incidentDate) payload.incident_date = incidentDate;
  if (regulatoryBody) payload.regulatory_body = regulatoryBody;
  if (rootCause) payload.root_cause = rootCause;

  try {
    const res = await fetch(`${API_BASE}/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || `HTTP ${res.status}`);
    }

    form.reset();
    document.getElementById("severity").value = "Medium";
    document.getElementById("is_compliant").checked = true;
    formMessage.textContent = "Incident report saved!";
    formMessage.style.color = "var(--verified-text)";
    setBanner("");
    await loadIncidents();
  } catch (err) {
    formMessage.textContent = `Error: ${err.message}`;
    formMessage.style.color = "var(--critical-text)";
  }
});

async function updateIncidentField(incidentId, updates, successMsg = "Incident updated") {
  try {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `HTTP ${res.status}`);
    }
    setBanner(successMsg, false);
    await loadIncidents();
  } catch (err) {
    setBanner(`Update failed: ${err.message}`, true);
  }
}

function toggleRootCauseBox(incidentId) {
  const box = document.getElementById(`rc-box-${incidentId}`);
  if (!box) return;
  const isHidden = box.style.display === "none" || !box.style.display;
  box.style.display = isHidden ? "flex" : "none";
}

async function saveRootCause(incidentId) {
  const input = document.getElementById(`rc-input-${incidentId}`);
  if (!input) return;
  const value = input.value.trim();
  if (!value) {
    setBanner("Root cause cannot be empty", true);
    return;
  }
  await updateIncidentField(incidentId, { root_cause: value }, "Root cause updated");
}

async function deleteIncident(incidentId, tailNumber) {
  const confirmed = confirm(`Delete incident report for ${tailNumber || "this aircraft"}?`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `HTTP ${res.status}`);
    }
    setBanner("Incident report deleted", false);
    await loadIncidents();
  } catch (err) {
    setBanner(`Delete failed: ${err.message}`, true);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

filterTail.addEventListener("input", loadIncidents);
filterSeverity.addEventListener("change", loadIncidents);
filterStatus.addEventListener("change", loadIncidents);
filterCompliance.addEventListener("change", loadIncidents);

clearFiltersBtn.addEventListener("click", () => {
  filterTail.value = "";
  filterSeverity.value = "";
  filterStatus.value = "";
  filterCompliance.value = "";
  setBanner("");
  loadIncidents();
});

refreshBtn.addEventListener("click", loadIncidents);

initTheme();
loadIncidents();