export function createReader({ data, elements, preferences, savePreferences, navigate, announce, onMobileNavigate }) {
  const documentsById = new Map(data.documents.map((document) => [document.id, document]));
  let activeDocument = null;
  let activeSectionObserver = null;
  let previousId = null;
  let nextId = null;

  function documentNumber(document) {
    if (document.kind === "chapter") return String(document.number).padStart(2, "0");
    if (document.kind === "orientation") return "→";
    if (document.kind === "capstone") return "◆";
    if (document.kind === "roadmap") return "90";
    if (document.kind === "glossary") return "Aa";
    return "↗";
  }

  function renderSidebar() {
    const fragment = document.createDocumentFragment();
    data.parts.forEach((part, partIndex) => {
      const section = document.createElement("section");
      section.className = "nav-part";
      section.dataset.collapsed = "false";
      const titleButton = document.createElement("button");
      titleButton.type = "button";
      titleButton.className = "nav-part-title";
      const titleSpan = document.createElement("span");
      titleSpan.textContent = part.title;
      titleButton.append(titleSpan);
      titleButton.setAttribute("aria-expanded", "true");
      titleButton.addEventListener("click", () => {
        const collapsed = section.dataset.collapsed === "true";
        section.dataset.collapsed = String(!collapsed);
        titleButton.setAttribute("aria-expanded", String(collapsed));
      });
      const items = document.createElement("div");
      items.className = "nav-part-items";
      items.id = "part-items-" + partIndex;
      titleButton.setAttribute("aria-controls", items.id);
      part.document_ids.forEach((documentId) => {
        const documentData = documentsById.get(documentId);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nav-document";
        button.dataset.documentId = documentData.id;
        button.dataset.complete = String(preferences.completed.includes(documentData.id));
        button.dataset.documentTitle = documentData.title;
        button.setAttribute("aria-label", documentData.title + (preferences.completed.includes(documentData.id) ? ", completed" : ""));
        button.innerHTML = '<span class="nav-document-number"></span><span class="nav-document-title"></span><span class="nav-complete" aria-hidden="true">✓</span>';
        button.querySelector(".nav-document-number").textContent = documentNumber(documentData);
        button.querySelector(".nav-document-title").textContent = documentData.title;
        button.addEventListener("click", () => { navigate(documentData.id); onMobileNavigate?.(); });
        items.append(button);
      });
      section.append(titleButton, items);
      fragment.append(section);
    });
    elements.chapterNavigation.replaceChildren(fragment);
    refreshSidebarState();
  }

  function refreshSidebarState() {
    elements.chapterNavigation.querySelectorAll(".nav-document").forEach((button) => {
      const id = button.dataset.documentId;
      if (activeDocument?.id === id) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
      const complete = preferences.completed.includes(id);
      button.dataset.complete = String(complete);
      button.setAttribute("aria-label", (button.dataset.documentTitle || id) + (complete ? ", completed" : ""));
    });
    const chapterIds = data.documents.filter((document) => document.kind === "chapter").map((document) => document.id);
    const completedCount = chapterIds.filter((id) => preferences.completed.includes(id)).length;
    elements.completedSummary.textContent = completedCount + " of " + chapterIds.length + " chapters complete";
  }

  function enhanceCodeBlocks() {
    elements.article.querySelectorAll(".code-block").forEach((block) => {
      const toolbar = block.querySelector(".code-toolbar");
      const code = block.querySelector("code");
      if (!toolbar || !code || toolbar.querySelector("button")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "copy-code";
      button.textContent = "Copy";
      button.setAttribute("aria-label", "Copy code block");
      button.addEventListener("click", async () => {
        const text = code.textContent || "";
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
          else {
            const area = document.createElement("textarea"); area.value = text; area.style.position = "fixed"; area.style.opacity = "0"; document.body.append(area); area.select(); document.execCommand("copy"); area.remove();
          }
          button.textContent = "Copied"; announce("Code copied to clipboard");
        } catch {
          button.textContent = "Copy failed"; announce("Code could not be copied");
        }
        window.setTimeout(() => { button.textContent = "Copy"; }, 1600);
      });
      toolbar.append(button);
    });
  }

  function renderOutline(documentData) {
    const fragment = document.createDocumentFragment();
    documentData.sections.forEach((section) => {
      const link = document.createElement("a");
      link.className = "outline-link level-" + section.level;
      link.href = "#/" + encodeURIComponent(documentData.id) + "/" + encodeURIComponent(section.id);
      link.dataset.sectionId = section.id;
      link.textContent = section.title;
      link.addEventListener("click", (event) => { event.preventDefault(); navigate(documentData.id, section.id); });
      fragment.append(link);
    });
    elements.sectionNavigation.replaceChildren(fragment);
  }

  function observeSections() {
    activeSectionObserver?.disconnect();
    if (!("IntersectionObserver" in window)) return;
    const headings = [...elements.article.querySelectorAll("h2[id], h3[id]")];
    activeSectionObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      elements.sectionNavigation.querySelectorAll(".outline-link").forEach((link) => {
        if (link.dataset.sectionId === visible.target.id) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-18% 0px -72% 0px", threshold: [0, 1] });
    headings.forEach((heading) => activeSectionObserver.observe(heading));
  }

  function updateProgress() {
    if (!activeDocument || elements.documentView.hidden) return;
    const rect = elements.article.getBoundingClientRect();
    const articleTop = window.scrollY + rect.top;
    const total = Math.max(1, elements.article.offsetHeight - window.innerHeight + 120);
    const current = Math.min(total, Math.max(0, window.scrollY - articleTop + 120));
    const percent = Math.round(current / total * 100);
    elements.progressBar.style.width = percent + "%";
    elements.progressLabel.textContent = activeDocument.title + " · " + percent + "%";
  }

  function scrollToSection(sectionId) {
    window.requestAnimationFrame(() => {
      if (sectionId) {
        const target = document.getElementById(sectionId);
        if (target) { target.scrollIntoView({ block: "start" }); target.focus({ preventScroll: true }); }
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
        elements.article.querySelector("h1")?.focus({ preventScroll: true });
      }
      updateProgress();
    });
  }

  function setDocumentButtons(documentData) {
    previousId = documentData.previous_id;
    nextId = documentData.next_id;
    const previous = previousId ? documentsById.get(previousId) : null;
    const next = nextId ? documentsById.get(nextId) : null;
    elements.previousButton.disabled = !previous;
    elements.nextButton.disabled = !next;
    elements.previousLabel.textContent = previous?.title || "Beginning of book";
    elements.nextLabel.textContent = next?.title || "End of book";
  }

  function updateCompleteControl() {
    if (!activeDocument) return;
    const complete = preferences.completed.includes(activeDocument.id);
    elements.completeToggle.setAttribute("aria-pressed", String(complete));
    elements.completeToggle.textContent = complete ? "Completed ✓" : "Mark complete";
  }

  function renderDocument(documentData, sectionId = null) {
    activeDocument = documentData;
    elements.landing.hidden = true;
    elements.notFound.hidden = true;
    elements.documentView.hidden = false;
    elements.article.innerHTML = documentData.html;
    elements.documentPart.textContent = documentData.part;
    elements.readingTime.textContent = documentData.reading_minutes + " min read · " + documentData.word_count.toLocaleString() + " words";
    document.title = documentData.title + " | Senior Python Engineering";
    enhanceCodeBlocks();
    renderOutline(documentData);
    setDocumentButtons(documentData);
    updateCompleteControl();
    refreshSidebarState();
    observeSections();
    scrollToSection(sectionId);
  }

  function renderLanding() {
    activeDocument = null;
    elements.landing.hidden = false;
    elements.documentView.hidden = true;
    elements.notFound.hidden = true;
    elements.progressBar.style.width = "0%";
    elements.progressLabel.textContent = "Start here";
    document.title = data.metadata.title;
    refreshSidebarState();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderNotFound(message) {
    activeDocument = null;
    elements.landing.hidden = true;
    elements.documentView.hidden = true;
    elements.notFound.hidden = false;
    elements.notFoundMessage.textContent = message || "The requested book section does not exist.";
    elements.progressBar.style.width = "0%";
    elements.progressLabel.textContent = "Not found";
    document.title = "Not found | Senior Python Engineering";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  elements.completeToggle.addEventListener("click", () => {
    if (!activeDocument) return;
    const set = new Set(preferences.completed);
    if (set.has(activeDocument.id)) set.delete(activeDocument.id); else set.add(activeDocument.id);
    preferences.completed = [...set];
    savePreferences(preferences);
    updateCompleteControl(); refreshSidebarState();
    announce(set.has(activeDocument.id) ? "Marked complete" : "Completion removed");
  });
  elements.previousButton.addEventListener("click", () => { if (previousId) navigate(previousId); });
  elements.nextButton.addEventListener("click", () => { if (nextId) navigate(nextId); });
  elements.backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  elements.printDocument.addEventListener("click", () => window.print());
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);

  renderSidebar();
  return {
    renderDocument,
    renderLanding,
    renderNotFound,
    refreshSidebarState,
    get activeDocument() { return activeDocument; },
    get previousId() { return previousId; },
    get nextId() { return nextId; },
    destroy() { activeSectionObserver?.disconnect(); },
  };
}
