import { apiOrigin, phoneCandidate, checkBody, companyPage, checkResult, apiRequest, CATEGORIES } from "./core.js";
import { showResult } from "./view.js";
import { DEFAULT_API_ORIGIN } from "./settings.js";

const api = globalThis.browser || globalThis.chrome;
const $ = id => document.getElementById(id);
let origin = "", companies = [], nextOffset = null, directoryFilter = "", busy = false, companyBusy = false;
let checkedRevision = 0;
function status(id, message) { $(id).textContent = message; }
function setup(open) { $("setup").hidden = !open; $("settings-toggle").setAttribute("aria-expanded", String(open)); }
function resetResult() {
  checkedRevision++;
  $("result").replaceChildren(); $("result").hidden = true; $("consent").checked = false;
  $("hook").dataset.state = "idle"; status("hook-caption", "Hook is here with you.");
}
function busyState(value) {
  busy = value;
  for (const id of ["phone", "country", "company", "category", "company-search", "scan", "inline", "load-companies", "more-companies", "consent", "check", "disconnect"]) $(id).disabled = value;
  $("check").textContent = value ? "Checking the evidence…" : "Check this number";
}
async function permission() {
  if (!origin) throw new Error("Connect a published evidence service in Setup first.");
  const allowed = await api.permissions.contains({ origins: [`${origin}/*`] });
  if (!allowed) throw new Error("Allow access to your evidence service in Setup first.");
}
function selectedCompany() { return companies.find(c => c.id === $("company").value); }
function selected(number) {
  if (busy) return;
  resetResult(); $("phone").value = number; $("phone").focus();
  status("page-status", "Number selected locally. Review it, choose the country if needed, and confirm before checking.");
}
async function activeTabScript(file) {
  if (!api?.scripting) throw new Error("Page access is not available here. Paste the number instead.");
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!Number.isInteger(tab?.id)) throw new Error("Open a normal search page, then use the extension again.");
  const results = await api.scripting.executeScript({ target: { tabId: tab.id }, files: [file] });
  return results[0]?.result;
}
async function loadCompanies(more = false) {
  if (companyBusy || busy) return;
  companyBusy = true; $("load-companies").disabled = true; $("more-companies").disabled = true;
  resetResult();
  try {
    await permission();
    const filter = new URLSearchParams({ limit: "20", search: $("company-search").value.trim() });
    if ($("category").value) filter.set("category", $("category").value);
    const key = filter.toString();
    if (more && key !== directoryFilter) throw new Error("Your search changed. Search the directory again first.");
    filter.set("offset", String(more ? nextOffset : 0));
    status("directory-status", "Loading the travel directory…");
    const data = companyPage(await apiRequest(origin, `/companies?${filter}`));
    companies = more ? [...companies, ...data.items] : data.items;
    directoryFilter = key; nextOffset = data.nextOffset;
    $("company").replaceChildren(new Option("Not selected — check number only", ""));
    for (const company of companies) $("company").append(new Option(`${company.name} · ${CATEGORIES[company.category]}`, company.id));
    $("more-companies").hidden = nextOffset === null;
    status("directory-status", `${companies.length} of ${data.total} listed companies. Coverage is limited; some entries have website support only.`);
  } catch (error) {
    companies = []; nextOffset = null;
    $("company").replaceChildren(new Option("Not selected — check number only", ""));
    $("more-companies").hidden = true;
    status("directory-status", error.message || "Directory unavailable. No company was selected.");
  } finally { companyBusy = false; $("load-companies").disabled = busy; $("more-companies").disabled = busy; }
}

$("settings-toggle").addEventListener("click", () => setup($("setup").hidden));
$("setup-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;
  try {
    const next = apiOrigin($("api-origin").value.trim());
    // Request synchronously within this click gesture, not after storage/network work.
    const granted = await api.permissions.request({ origins: [`${next}/*`] });
    if (!granted) throw new Error("Access was not granted. No number was sent.");
    const previous = origin;
    await api.storage.local.set({ apiOrigin: next });
    origin = next; companies = []; nextOffset = null; resetResult();
    $("company").replaceChildren(new Option("Not selected — check number only", ""));
    $("more-companies").hidden = true;
    if (previous && previous !== next) await api.permissions.remove({ origins: [`${previous}/*`] });
    status("destination", `Selected checks go to ${origin}.`);
    status("setup-status", "Connected. No number has been sent. You can now choose a number to check.");
  } catch (error) { status("setup-status", error.message || "Setup failed. Try opening the extension from the browser toolbar."); }
});
$("disconnect").addEventListener("click", async () => {
  if (busy) return;
  try {
    if (origin) await api.permissions.remove({ origins: [`${origin}/*`] });
    await api.storage.local.remove("apiOrigin");
    origin = ""; companies = []; nextOffset = null;
    $("phone").value = ""; $("country").value = ""; $("api-origin").value = "";
    $("company-search").value = ""; $("candidates").replaceChildren();
    $("company").replaceChildren(new Option("Not selected — check number only", ""));
    $("more-companies").hidden = true; resetResult();
    status("destination", "No evidence service connected.");
    status("setup-status", "Disconnected. Saved service settings and any displayed check were removed.");
  } catch { status("setup-status", "Could not remove access. Remove this service permission in browser extension settings."); }
});
$("scan").addEventListener("click", async () => {
  try {
    status("page-status", "Finding candidates locally. No number is being uploaded.");
    const candidates = await activeTabScript("scan.js");
    if (!Array.isArray(candidates)) throw new Error("The page did not return candidates.");
    $("candidates").replaceChildren();
    for (const value of candidates.slice(0, 20).filter(phoneCandidate)) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = value;
      button.addEventListener("click", () => selected(value)); $("candidates").append(button);
    }
    status("page-status", $("candidates").childElementCount ? "Choose the number you meant to call. These are candidates, not verified contacts." : "No phone candidates found. Select or paste one complete number instead.");
  } catch { status("page-status", "This page cannot be read. Open a normal HTTPS page and try again, or paste the number. No number was sent."); }
});
$("inline").addEventListener("click", async () => {
  try {
    await activeTabScript("inline.js");
    status("page-status", "Inline checks are enabled for this page only. Select a number or tap a phone link. Review and confirm before anything is sent.");
    window.close();
  } catch { status("page-status", "Inline checks are blocked on this page. You can still paste the number here. Nothing was sent."); }
});
$("load-companies").addEventListener("click", () => loadCompanies());
$("more-companies").addEventListener("click", () => loadCompanies(true));
for (const id of ["phone", "country", "company"]) $(id).addEventListener("input", () => { resetResult(); status("error", ""); });
for (const id of ["category", "company-search"]) $(id).addEventListener("input", () => {
  resetResult(); companies = []; nextOffset = null; $("more-companies").hidden = true;
  $("company").replaceChildren(new Option("Not selected — check number only", ""));
});
$("check-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy || companyBusy) return;
  status("error", "");
  try {
    if (!$("consent").checked) throw new Error("Confirm the selected number can be sent before checking.");
    const body = checkBody($("phone").value, $("country").value, $("company").value);
    const company = selectedCompany();
    busyState(true);
    await permission();
    const revision = ++checkedRevision;
    $("result").replaceChildren(); $("result").hidden = true;
    $("hook").dataset.state = "searching"; status("hook-caption", "Hook is checking the evidence.");
    const result = checkResult(await apiRequest(origin, "/checks", { body }), body);
    if (revision !== checkedRevision) return;
    $("hook").dataset.state = result.outcome;
    status("hook-caption", result.outcome === "official_match" ? "A listing match. Hook can rest a little." : result.outcome === "reports_found" ? "Pause. Hook found reports worth reviewing." : "Not sure yet. You still have a next step.");
    showResult($("result"), result, company, async number => {
      try { await navigator.clipboard.writeText(number); status("error", "Listed number copied. Review the official source before calling."); }
      catch { status("error", `Copy is unavailable here. Select and copy this listed number: ${number}`); }
    });
  } catch (error) {
    $("hook").dataset.state = "not_verified"; status("hook-caption", "No check completed. You can try another way.");
    status("error", error.message || "The check failed. No number was verified.");
  } finally { $("consent").checked = false; busyState(false); }
});

async function init() {
  if (!api?.runtime?.id) {
    status("error", "Open this page through the installed Phishing Trip extension. A website preview cannot check numbers.");
    $("check").disabled = true; $("scan").disabled = true; $("inline").disabled = true; return;
  }
  try {
    // The only stored field is configuration. No numbers, results or history.
    const saved = await api.storage.local.get("apiOrigin");
    origin = saved.apiOrigin ? apiOrigin(saved.apiOrigin) : DEFAULT_API_ORIGIN ? apiOrigin(DEFAULT_API_ORIGIN) : "";
    $("api-origin").value = origin;
    status("destination", origin ? `Selected checks go to ${origin}.` : "No evidence service connected. Open Setup to begin.");
    if (!origin || !(await api.permissions.contains({ origins: [`${origin}/*`] }))) setup(true);
    const initial = new URLSearchParams(location.hash.slice(1)).get("number");
    if (phoneCandidate(initial)) selected(initial);
    // Do not retain the selected number in extension history / address bar.
    if (location.hash) history.replaceState(null, "", location.pathname);
  } catch { setup(true); status("setup-status", "Saved configuration could not be read. Reconnect your service."); }
}
init();
