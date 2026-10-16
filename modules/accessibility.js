export function announce(element, message) { if (!element) return; element.textContent = ""; window.setTimeout(() => { element.textContent = message; }, 20); }
export function createDrawerController({ drawer, backdrop, openButtons, closeButtons, onStateChange }) {
  let lastFocus = null; const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function open(opener) { lastFocus = opener || document.activeElement; document.body.classList.add("sidebar-open"); backdrop.hidden = false; openButtons.forEach((button) => button.setAttribute("aria-expanded", "true")); document.body.style.overflow = "hidden"; window.setTimeout(() => drawer.querySelector(focusableSelector)?.focus(), 0); onStateChange?.(true); }
  function close() { document.body.classList.remove("sidebar-open"); backdrop.hidden = true; openButtons.forEach((button) => button.setAttribute("aria-expanded", "false")); document.body.style.overflow = ""; lastFocus?.focus?.(); onStateChange?.(false); }
  function handleKeydown(event) {
    if (!document.body.classList.contains("sidebar-open")) return;
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const items = [...drawer.querySelectorAll(focusableSelector)].filter((item) => item.offsetParent !== null); if (!items.length) return;
    const first = items[0]; const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  openButtons.forEach((button) => button.addEventListener("click", () => open(button))); closeButtons.forEach((button) => button.addEventListener("click", close)); backdrop.addEventListener("click", close); document.addEventListener("keydown", handleKeydown);
  return { open, close, destroy() { document.removeEventListener("keydown", handleKeydown); } };
}
export function createDialogController(dialog, openButton, closeButton, onOpen) {
  let lastFocus = null;
  function open() { lastFocus = document.activeElement; if (!dialog.open) dialog.showModal(); onOpen?.(); }
  function close() { if (dialog.open) dialog.close(); lastFocus?.focus?.(); }
  openButton?.addEventListener("click", open); closeButton?.addEventListener("click", close); dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  return { open, close };
}
export function installKeyboardShortcuts({ openSearch, previous, next, closeOverlays }) {
  const handler = (event) => {
    const target = event.target; const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    if (event.key === "Escape") { closeOverlays?.(); return; }
    if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "/") { event.preventDefault(); openSearch?.(); }
    else if (event.key === "[") { event.preventDefault(); previous?.(); }
    else if (event.key === "]") { event.preventDefault(); next?.(); }
  };
  document.addEventListener("keydown", handler); return () => document.removeEventListener("keydown", handler);
}
