const STORAGE_KEY = "senior-python-reader-preferences-v1";
const DEFAULTS = Object.freeze({ theme: null, sidebarCompact: false, completed: [], lastDocument: "orientation" });
function storageAvailable() { try { const key = "__reader_test__"; window.localStorage.setItem(key, key); window.localStorage.removeItem(key); return true; } catch { return false; } }
const canStore = typeof window !== "undefined" && storageAvailable();
export const safeStorage = {
  get() { if (!canStore) return null; try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; } },
  set(value) { if (!canStore) return false; try { window.localStorage.setItem(STORAGE_KEY, value); return true; } catch { return false; } },
};
export function getPreferences() {
  const raw = safeStorage.get();
  if (!raw) return { ...DEFAULTS, completed: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme === "light" || parsed.theme === "dark" ? parsed.theme : null,
      sidebarCompact: Boolean(parsed.sidebarCompact),
      completed: Array.isArray(parsed.completed) ? [...new Set(parsed.completed.filter((item) => typeof item === "string"))] : [],
      lastDocument: typeof parsed.lastDocument === "string" ? parsed.lastDocument : DEFAULTS.lastDocument,
    };
  } catch { return { ...DEFAULTS, completed: [] }; }
}
export function savePreferences(preferences) {
  const normalized = {
    theme: preferences.theme === "light" || preferences.theme === "dark" ? preferences.theme : null,
    sidebarCompact: Boolean(preferences.sidebarCompact),
    completed: [...new Set(preferences.completed || [])],
    lastDocument: typeof preferences.lastDocument === "string" ? preferences.lastDocument : DEFAULTS.lastDocument,
  };
  safeStorage.set(JSON.stringify(normalized));
  return normalized;
}
export function resolvedTheme(preferences) { if (preferences.theme) return preferences.theme; return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }

export function mergePreferencesInPlace(target, source) {
  target.theme = source.theme;
  target.sidebarCompact = Boolean(source.sidebarCompact);
  target.completed = [...(source.completed || [])];
  target.lastDocument = source.lastDocument;
  return target;
}

export function compactControlState(compact) {
  return compact ? { pressed: "true", label: "Expand" } : { pressed: "false", label: "Compact" };
}
