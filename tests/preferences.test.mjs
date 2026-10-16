import test from "node:test";
import assert from "node:assert/strict";
import { compactControlState, mergePreferencesInPlace } from "../modules/preferences.js";

test("saved preferences preserve the shared object identity", () => {
  const preferences = { theme: null, sidebarCompact: false, completed: [], lastDocument: "orientation" };
  const original = preferences;
  const result = mergePreferencesInPlace(preferences, { theme: "light", sidebarCompact: true, completed: ["chapter-15"], lastDocument: "chapter-15" });
  assert.strictEqual(result, original);
  assert.deepEqual(preferences, { theme: "light", sidebarCompact: true, completed: ["chapter-15"], lastDocument: "chapter-15" });
});

test("compact control labels match restored state", () => {
  assert.deepEqual(compactControlState(true), { pressed: "true", label: "Expand" });
  assert.deepEqual(compactControlState(false), { pressed: "false", label: "Compact" });
});
