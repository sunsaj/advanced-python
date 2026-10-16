export function normalizeSearchText(value) { return String(value || "").toLocaleLowerCase().replace(/\s+/g, " ").trim(); }
export function createSearchIndex(records) { return records.map((record) => ({ ...record, normalizedTitle: normalizeSearchText(record.title), normalizedHeading: normalizeSearchText(record.heading), normalizedText: normalizeSearchText(record.text) })); }
function escapeRegex(value) { return value.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&"); }
function scoreRecord(record, query) {
  let score = 0;
  if (record.normalizedTitle === query) score += 140; else if (record.normalizedTitle.includes(query)) score += 90;
  if (record.normalizedHeading === query) score += 120; else if (record.normalizedHeading.includes(query)) score += 70;
  if (record.kind === "glossary" && (record.normalizedHeading.includes(query) || record.normalizedText.includes(query))) score += 30;
  const first = record.normalizedText.indexOf(query);
  if (first >= 0) { score += 22; score += Math.min(18, (record.normalizedText.match(new RegExp(escapeRegex(query), "g")) || []).length * 3); }
  return score;
}
function excerpt(record, query) {
  const text = String(record.text || record.heading || record.title); const normalized = normalizeSearchText(text); const index = normalized.indexOf(query);
  const start = Math.max(0, index < 0 ? 0 : index - 90); const end = Math.min(text.length, index < 0 ? 180 : index + query.length + 130);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}
export function search(index, rawQuery, limit = 24) {
  const query = normalizeSearchText(rawQuery); if (query.length < 2) return [];
  const ranked = index.map((record) => ({ record, score: scoreRecord(record, query) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title));
  const seen = new Set(); const results = [];
  for (const item of ranked) { const key = item.record.document_id + "::" + (item.record.section_id || "root"); if (seen.has(key)) continue; seen.add(key); results.push({ ...item.record, score: item.score, excerpt: excerpt(item.record, query), query }); if (results.length >= limit) break; }
  return results;
}
export function appendHighlightedText(container, text, query) {
  const source = String(text || ""); const normalized = source.toLocaleLowerCase(); const needle = normalizeSearchText(query);
  if (!needle) { container.textContent = source; return; }
  let cursor = 0; let match = normalized.indexOf(needle, cursor);
  while (match >= 0) { container.append(document.createTextNode(source.slice(cursor, match))); const mark = document.createElement("mark"); mark.textContent = source.slice(match, match + needle.length); container.append(mark); cursor = match + needle.length; match = normalized.indexOf(needle, cursor); }
  container.append(document.createTextNode(source.slice(cursor)));
}
