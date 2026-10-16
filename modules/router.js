function decodePart(value) { try { return decodeURIComponent(value); } catch { return value; } }
export function parseHash(hash, documents) {
  const value = String(hash || "").replace(/^#/, "");
  if (!value || value === "/" || value === "/home" || value === "home") return { kind: "home" };
  const pieces = value.replace(/^\//, "").split("/").filter(Boolean).map(decodePart);
  const documentId = pieces[0];
  const sectionId = pieces[1] || null;
  const document = documents.find((item) => item.id === documentId);
  if (!document) return { kind: "not-found", documentId, reason: "document" };
  if (sectionId && !document.sections.some((section) => section.id === sectionId)) return { kind: "document", documentId, sectionId: null, fallbackReason: "section" };
  return { kind: "document", documentId, sectionId };
}
export function navigateTo(documentId, sectionId = null) {
  if (!documentId || documentId === "home") { window.location.hash = "/home"; return; }
  const section = sectionId ? "/" + encodeURIComponent(sectionId) : "";
  window.location.hash = "/" + encodeURIComponent(documentId) + section;
}
export function subscribeToRoute(documents, callback) {
  const handler = () => callback(parseHash(window.location.hash, documents));
  window.addEventListener("hashchange", handler); handler();
  return () => window.removeEventListener("hashchange", handler);
}
