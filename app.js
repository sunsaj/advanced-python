import { announce as announceTo, createDialogController, createDrawerController, installKeyboardShortcuts } from "./modules/accessibility.js";
import { compactControlState, getPreferences, mergePreferencesInPlace, resolvedTheme, savePreferences } from "./modules/preferences.js";
import { createReader } from "./modules/reader.js";
import { navigateTo, subscribeToRoute } from "./modules/router.js";
import { appendHighlightedText, createSearchIndex, search } from "./modules/search.js";

const data = window.SENIOR_PYTHON_BOOK;
const byId = (id) => document.getElementById(id);
const elements = {
  landing: byId("landing-view"), documentView: byId("document-view"), notFound: byId("not-found-view"), notFoundMessage: byId("not-found-message"),
  article: byId("book-article"), documentPart: byId("document-part"), readingTime: byId("reading-time"), completeToggle: byId("complete-toggle"),
  previousButton: byId("previous-document"), previousLabel: byId("previous-label"), nextButton: byId("next-document"), nextLabel: byId("next-label"),
  progressBar: byId("progress-bar"), progressLabel: byId("progress-label"), chapterNavigation: byId("chapter-navigation"), sectionNavigation: byId("section-navigation"),
  completedSummary: byId("completed-summary"), backToTop: byId("back-to-top"), printDocument: byId("print-document"),
};

if (!data?.documents?.length) {
  elements.landing.hidden = true;
  elements.notFound.hidden = false;
  elements.notFoundMessage.textContent = "The generated book data could not be loaded. Run website/scripts/build_content.py and refresh.";
  throw new Error("SENIOR_PYTHON_BOOK is unavailable");
}

let preferences = getPreferences();
const liveRegion = byId("live-region");
const announce = (message) => announceTo(liveRegion, message);
function persist() { const normalized = savePreferences(preferences); return mergePreferencesInPlace(preferences, normalized); }

function applyTheme() {
  const theme = resolvedTheme(preferences);
  document.documentElement.dataset.theme = theme;
  const toggle = byId("theme-toggle");
  toggle.setAttribute("aria-pressed", String(theme === "dark"));
  toggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  byId("theme-icon").textContent = theme === "dark" ? "☀" : "◐";
}
applyTheme();
document.body.classList.toggle("sidebar-compact", preferences.sidebarCompact);
const compactButton = byId("collapse-sidebar");
function syncCompactControl() { const state = compactControlState(preferences.sidebarCompact); compactButton.setAttribute("aria-pressed", state.pressed); compactButton.textContent = state.label; }
syncCompactControl();

const sidebarToggle = byId("sidebar-toggle");
const drawer = createDrawerController({
  drawer: byId("chapter-sidebar"), backdrop: byId("mobile-backdrop"), openButtons: [sidebarToggle, byId("browse-chapters")], closeButtons: [byId("sidebar-close")],
});

const reader = createReader({
  data, elements, preferences,
  savePreferences: () => persist(),
  navigate: navigateTo,
  announce,
  onMobileNavigate: () => { if (window.matchMedia("(max-width: 62rem)").matches) drawer.close(); },
});

byId("theme-toggle").addEventListener("click", () => {
  preferences.theme = resolvedTheme(preferences) === "dark" ? "light" : "dark";
  persist(); applyTheme(); announce("Theme changed to " + preferences.theme);
});
compactButton.addEventListener("click", () => {
  preferences.sidebarCompact = !preferences.sidebarCompact;
  persist(); document.body.classList.toggle("sidebar-compact", preferences.sidebarCompact);
  syncCompactControl();
});

const searchDialog = byId("search-dialog");
const searchInput = byId("search-input");
const searchResults = byId("search-results");
const searchIndex = createSearchIndex(data.search_records);
let activeResult = -1;

function setActiveResult(index) {
  const buttons = [...searchResults.querySelectorAll(".search-result")];
  if (!buttons.length) { activeResult = -1; return; }
  activeResult = Math.max(0, Math.min(index, buttons.length - 1));
  buttons.forEach((button, position) => button.setAttribute("aria-selected", String(position === activeResult)));
  buttons[activeResult].focus();
}

function renderSearchResults(query) {
  const results = search(searchIndex, query);
  searchResults.replaceChildren();
  activeResult = -1;
  if (String(query).trim().length < 2) {
    const empty = document.createElement("p"); empty.className = "search-empty"; empty.textContent = "Enter at least two characters to search all 38 reading sections."; searchResults.append(empty); return;
  }
  if (!results.length) {
    const empty = document.createElement("p"); empty.className = "search-empty"; empty.textContent = "No results found. Try a broader technical term."; searchResults.append(empty); return;
  }
  results.forEach((result, index) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "search-result"; button.role = "option"; button.setAttribute("aria-selected", "false");
    const meta = document.createElement("span"); meta.className = "search-result-meta"; meta.textContent = result.kind + (result.heading !== result.title ? " · section" : "");
    const title = document.createElement("strong"); title.textContent = result.title + (result.heading !== result.title ? " — " + result.heading : "");
    const excerpt = document.createElement("p"); appendHighlightedText(excerpt, result.excerpt, result.query);
    button.append(meta, title, excerpt);
    button.addEventListener("click", () => { searchController.close(); navigateTo(result.document_id, result.section_id); announce("Opened " + result.title); });
    button.addEventListener("focus", () => { activeResult = index; button.setAttribute("aria-selected", "true"); });
    searchResults.append(button);
  });
}

const searchController = createDialogController(searchDialog, byId("search-toggle"), byId("search-close"), () => {
  renderSearchResults(searchInput.value);
  window.setTimeout(() => { searchInput.focus(); searchInput.select(); }, 0);
});
searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
searchInput.addEventListener("keydown", (event) => {
  const count = searchResults.querySelectorAll(".search-result").length;
  if (!count) return;
  if (event.key === "ArrowDown") { event.preventDefault(); setActiveResult(activeResult + 1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); setActiveResult(activeResult <= 0 ? count - 1 : activeResult - 1); }
});
searchResults.addEventListener("keydown", (event) => {
  const count = searchResults.querySelectorAll(".search-result").length;
  if (event.key === "ArrowDown") { event.preventDefault(); setActiveResult((activeResult + 1) % count); }
  else if (event.key === "ArrowUp") { event.preventDefault(); setActiveResult((activeResult - 1 + count) % count); }
});

const helpController = createDialogController(byId("help-dialog"), byId("help-toggle"), byId("help-close"));
function closeOverlays() { if (searchDialog.open) searchController.close(); if (byId("help-dialog").open) helpController.close(); drawer.close(); }

installKeyboardShortcuts({
  openSearch: () => searchController.open(),
  previous: () => { if (reader.previousId) navigateTo(reader.previousId); },
  next: () => { if (reader.nextId) navigateTo(reader.nextId); },
  closeOverlays,
});

byId("start-reading").addEventListener("click", () => navigateTo(data.documents.some((document) => document.id === preferences.lastDocument) ? preferences.lastDocument : "orientation"));
byId("home-link").addEventListener("click", () => { navigateTo("home"); if (window.matchMedia("(max-width: 62rem)").matches) drawer.close(); });
byId("not-found-home").addEventListener("click", () => navigateTo("home"));

const stats = byId("book-stats");
if (stats) {
  const values = stats.querySelectorAll("dd");
  if (values[0]) values[0].textContent = data.metadata.chapter_count;
  if (values[1]) values[1].textContent = data.metadata.illustration_count;
}

subscribeToRoute(data.documents, (route) => {
  if (route.kind === "home") { reader.renderLanding(); return; }
  if (route.kind === "not-found") { reader.renderNotFound("No reading section named “" + (route.documentId || "unknown") + "” exists."); return; }
  const documentData = data.documents.find((document) => document.id === route.documentId);
  if (!documentData) { reader.renderNotFound(); return; }
  preferences.lastDocument = documentData.id; persist();
  reader.renderDocument(documentData, route.sectionId);
  if (route.fallbackReason === "section") announce("The requested heading was not found. Opened the beginning of the section instead.");
});

window.__BOOK_READER__ = { data, reader, search: (query) => search(searchIndex, query), navigateTo, preferences: () => ({ ...preferences }) };
