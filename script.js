const STORAGE_KEY = "link_dashboard_data_v1";
const THEME_STORAGE_KEY = "link_dashboard_theme_preference_v1";
const EDIT_UNLOCK_STORAGE_KEY = "link_dashboard_edit_unlocked_v1";
const VALID_THEME_PREFERENCES = new Set(["light", "dark", "system"]);
const EDIT_PASSWORD = "password";
const KNOWN_PLATFORM_ICONS = [
  { domains: ["youtube.com", "youtu.be"], slug: "youtube" },
  { domains: ["github.com", "gist.github.com"], slug: "github" },
  { domains: ["linkedin.com"], slug: "linkedin" },
  { domains: ["reddit.com"], slug: "reddit" },
  { domains: ["x.com", "twitter.com"], slug: "x" },
  { domains: ["notion.so", "notion.site"], slug: "notion" },
  { domains: ["figma.com"], slug: "figma" },
  { domains: ["slack.com"], slug: "slack" },
  { domains: ["discord.com"], slug: "discord" },
  { domains: ["openai.com", "chatgpt.com"], slug: "openai" },
  { domains: ["mail.google.com"], slug: "gmail" },
  { domains: ["calendar.google.com"], slug: "googlecalendar" }
];
const GENERIC_LINK_ICON_URL = createSvgDataUri(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'>" +
    "<path d='M10 14L14 10' stroke='#8A8A8A' stroke-width='2' stroke-linecap='round'/>" +
    "<path d='M7.5 16.5l-1.5 1.5a4 4 0 1 1-5.7-5.7l3.2-3.2a4 4 0 0 1 5.7 0' " +
    "stroke='#8A8A8A' stroke-width='2' stroke-linecap='round'/>" +
    "<path d='M16.5 7.5l1.5-1.5a4 4 0 1 1 5.7 5.7l-3.2 3.2a4 4 0 0 1-5.7 0' " +
    "stroke='#8A8A8A' stroke-width='2' stroke-linecap='round'/>" +
    "</svg>"
);

const categoryForm = document.getElementById("category-form");
const categoryNameInput = document.getElementById("category-name-input");
const categoriesContainer = document.getElementById("categories-container");
const newLinkBtn = document.getElementById("new-link-btn");
const themeSelect = document.getElementById("theme-select");
const lockBtn = document.getElementById("lock-btn");
const lockOverlay = document.getElementById("lock-overlay");
const unlockForm = document.getElementById("unlock-form");
const unlockPasswordInput = document.getElementById("unlock-password-input");
const unlockError = document.getElementById("unlock-error");

const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalCloseBtn = document.getElementById("modal-close-btn");
const linkForm = document.getElementById("link-form");
const linkNameInput = document.getElementById("link-name-input");
const linkUrlInput = document.getElementById("link-url-input");
const linkCategorySelect = document.getElementById("link-category-select");

const categoryTemplate = document.getElementById("category-template");
const linkTemplate = document.getElementById("link-template");
const colorSchemeMediaQuery =
  typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

let state = loadState();
let editContext = null;
let draggedLink = null;
let dragSourceNode = null;
let themePreference = loadThemePreference();
let isEditUnlocked = loadEditUnlockState();

initializeTheme();
initializeAccessControl();
render();

categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requireEditUnlock()) {
    return;
  }

  const name = categoryNameInput.value.trim();
  if (!name) {
    return;
  }

  if (state.categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
    alert("A category with that name already exists.");
    return;
  }

  state.categories.push({ id: generateId(), name, links: [] });
  categoryNameInput.value = "";
  saveState();
  render();
});

newLinkBtn.addEventListener("click", () => {
  if (!requireEditUnlock()) {
    return;
  }
  openLinkModal();
});
modalCloseBtn.addEventListener("click", closeLinkModal);
document.getElementById("link-form-cancel").addEventListener("click", closeLinkModal);

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) {
    closeLinkModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalOverlay.classList.contains("hidden")) {
    closeLinkModal();
  }
});

categoriesContainer.addEventListener("dragover", (event) => {
  if (!draggedLink) {
    return;
  }

  if (!(event.target instanceof Element)) {
    clearDropTargets();
    return;
  }

  if (!event.target.closest(".category-card")) {
    clearDropTargets();
  }
});

linkForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requireEditUnlock()) {
    return;
  }

  const linkName = linkNameInput.value.trim();
  const linkUrl = normalizeUrl(linkUrlInput.value.trim());
  const targetCategoryId = linkCategorySelect.value;

  if (!linkName || !linkUrl || !targetCategoryId) {
    alert("Please complete all fields with valid values.");
    return;
  }

  if (editContext) {
    updateLink(editContext.categoryId, editContext.linkId, {
      name: linkName,
      url: linkUrl,
      categoryId: targetCategoryId
    });
  } else {
    createLink(targetCategoryId, {
      id: generateId(),
      name: linkName,
      url: linkUrl
    });
  }

  closeLinkModal();
  saveState();
  render();
});

function render() {
  categoriesContainer.textContent = "";

  if (state.categories.length === 0) {
    const emptyNode = document.createElement("div");
    emptyNode.className = "empty-note";
    emptyNode.textContent = "No categories yet. Create one to start saving links.";
    categoriesContainer.appendChild(emptyNode);
    return;
  }

  for (const category of state.categories) {
    const categoryNode = categoryTemplate.content.firstElementChild.cloneNode(true);
    categoryNode.dataset.categoryId = category.id;
    categoryNode.querySelector(".category-title").textContent = category.name;

    categoryNode.addEventListener("dragover", (event) => onCategoryDragOver(event, category.id));
    categoryNode.addEventListener("drop", (event) => onCategoryDrop(event, category.id));

    const addLinkBtn = categoryNode.querySelector(".add-link-btn");
    addLinkBtn.addEventListener("click", () => {
      if (!requireEditUnlock()) {
        return;
      }
      openLinkModal({ selectedCategoryId: category.id });
    });

    const deleteCategoryBtn = categoryNode.querySelector(".delete-category-btn");
    deleteCategoryBtn.addEventListener("click", () => {
      if (!requireEditUnlock()) {
        return;
      }
      removeCategory(category.id);
    });

    const linksList = categoryNode.querySelector(".links-list");
    if (category.links.length === 0) {
      const emptyLinkItem = document.createElement("li");
      emptyLinkItem.className = "empty-note";
      emptyLinkItem.textContent = "No links in this category.";
      linksList.appendChild(emptyLinkItem);
    } else {
      for (const link of category.links) {
        const linkNode = linkTemplate.content.firstElementChild.cloneNode(true);
        linkNode.setAttribute("draggable", "true");
        linkNode.addEventListener("dragstart", (event) =>
          onLinkDragStart(event, category.id, link.id, linkNode)
        );
        linkNode.addEventListener("dragend", onLinkDragEnd);

        const anchor = linkNode.querySelector(".link-anchor");
        anchor.textContent = link.name;
        anchor.href = link.url;
        anchor.title = link.url;
        const iconImage = linkNode.querySelector(".link-icon");
        if (iconImage instanceof HTMLImageElement) {
          setLinkIcon(iconImage, link.url);
        }

        linkNode
          .querySelector(".edit-link-btn")
          .addEventListener("click", () => {
            if (!requireEditUnlock()) {
              return;
            }
            openLinkModal({ categoryId: category.id, linkId: link.id });
          });
        linkNode.querySelector(".delete-link-btn").addEventListener("click", () => {
          if (!requireEditUnlock()) {
            return;
          }
          removeLink(category.id, link.id);
        });

        linksList.appendChild(linkNode);
      }
    }

    categoriesContainer.appendChild(categoryNode);
  }
}

function initializeAccessControl() {
  applyEditUnlockState(isEditUnlocked, false);

  if (unlockForm) {
    unlockForm.addEventListener("submit", handleUnlockSubmit);
  }

  if (unlockPasswordInput) {
    unlockPasswordInput.addEventListener("input", () => setUnlockError(""));
  }

  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      if (!isEditUnlocked) {
        focusUnlockPasswordInput();
        return;
      }
      applyEditUnlockState(false, true);
    });
  }
}

function handleUnlockSubmit(event) {
  event.preventDefault();
  const entered = unlockPasswordInput ? unlockPasswordInput.value : "";

  if (entered === EDIT_PASSWORD) {
    applyEditUnlockState(true, true);
    if (unlockForm) {
      unlockForm.reset();
    }
    setUnlockError("");
    return;
  }

  setUnlockError("Incorrect password.");
  if (unlockPasswordInput) {
    unlockPasswordInput.focus();
    unlockPasswordInput.select();
  }
}

function applyEditUnlockState(nextValue, persist) {
  isEditUnlocked = Boolean(nextValue);
  document.documentElement.setAttribute("data-edit-unlocked", isEditUnlocked ? "true" : "false");
  if (lockOverlay) {
    lockOverlay.setAttribute("aria-hidden", String(isEditUnlocked));
  }

  if (lockBtn) {
    lockBtn.disabled = !isEditUnlocked;
    lockBtn.setAttribute("aria-disabled", String(!isEditUnlocked));
  }

  if (persist) {
    saveEditUnlockState(isEditUnlocked);
  }

  if (!isEditUnlocked) {
    closeLinkModal();
    clearDragState();
    focusUnlockPasswordInput();
  }
}

function requireEditUnlock() {
  if (isEditUnlocked) {
    return true;
  }
  focusUnlockPasswordInput();
  return false;
}

function focusUnlockPasswordInput() {
  if (!unlockPasswordInput) {
    return;
  }

  const schedule =
    typeof requestAnimationFrame === "function" ? requestAnimationFrame : (callback) => setTimeout(callback, 0);
  schedule(() => {
    unlockPasswordInput.focus();
    unlockPasswordInput.select();
  });
}

function setUnlockError(message) {
  if (unlockError) {
    unlockError.textContent = message;
  }
}

function initializeTheme() {
  applyTheme(themePreference);

  if (themeSelect) {
    themeSelect.value = themePreference;
    themeSelect.addEventListener("change", handleThemeSelectionChange);
  }

  if (!colorSchemeMediaQuery) {
    return;
  }

  const onSchemeChange = () => {
    if (themePreference === "system") {
      applyTheme(themePreference);
    }
  };

  if (typeof colorSchemeMediaQuery.addEventListener === "function") {
    colorSchemeMediaQuery.addEventListener("change", onSchemeChange);
    return;
  }

  if (typeof colorSchemeMediaQuery.addListener === "function") {
    colorSchemeMediaQuery.addListener(onSchemeChange);
  }
}

function handleThemeSelectionChange(event) {
  const nextPreference = normalizeThemePreference(event?.target?.value);
  themePreference = nextPreference;
  applyTheme(themePreference);
  saveThemePreference(themePreference);

  if (themeSelect && themeSelect.value !== themePreference) {
    themeSelect.value = themePreference;
  }
}

function normalizeThemePreference(value) {
  return VALID_THEME_PREFERENCES.has(value) ? value : "system";
}

function resolveTheme(preference) {
  if (preference === "dark") {
    return "dark";
  }
  if (preference === "light") {
    return "light";
  }

  const prefersDark = colorSchemeMediaQuery ? colorSchemeMediaQuery.matches : false;
  return prefersDark ? "dark" : "light";
}

function applyTheme(preference) {
  const normalizedPreference = normalizeThemePreference(preference);
  const resolvedTheme = resolveTheme(normalizedPreference);
  document.documentElement.setAttribute("data-theme-preference", normalizedPreference);
  document.documentElement.setAttribute("data-theme", resolvedTheme);
}

function onLinkDragStart(event, categoryId, linkId, linkNode) {
  if (!isEditUnlocked) {
    event.preventDefault();
    return;
  }

  draggedLink = { categoryId, linkId };
  dragSourceNode = linkNode;
  document.body.classList.add("is-dragging-link");
  linkNode.classList.add("is-dragging");

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", linkId);
  }
}

function onLinkDragEnd() {
  clearDragState();
}

function onCategoryDragOver(event, categoryId) {
  if (!draggedLink) {
    return;
  }

  if (draggedLink.categoryId === categoryId) {
    clearDropTargets();
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }

  clearDropTargets();
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.classList.add("is-drop-target");
  }
}

function onCategoryDrop(event, destinationCategoryId) {
  if (!requireEditUnlock()) {
    clearDragState();
    return;
  }

  if (!draggedLink) {
    return;
  }

  event.preventDefault();
  const sourceCategoryId = draggedLink.categoryId;
  const linkId = draggedLink.linkId;
  clearDragState();

  if (sourceCategoryId === destinationCategoryId) {
    return;
  }

  if (!moveLink(sourceCategoryId, linkId, destinationCategoryId)) {
    return;
  }

  saveState();
  render();
}

function clearDragState() {
  document.body.classList.remove("is-dragging-link");
  if (dragSourceNode) {
    dragSourceNode.classList.remove("is-dragging");
  }
  dragSourceNode = null;
  draggedLink = null;
  clearDropTargets();
}

function clearDropTargets() {
  for (const node of categoriesContainer.querySelectorAll(".category-card.is-drop-target")) {
    node.classList.remove("is-drop-target");
  }
}

function openLinkModal(options = {}) {
  if (!requireEditUnlock()) {
    return;
  }

  if (state.categories.length === 0) {
    alert("Create a category before adding links.");
    return;
  }

  editContext = null;
  populateCategorySelect(options.selectedCategoryId);
  linkForm.reset();

  if (options.linkId && options.categoryId) {
    const category = state.categories.find((item) => item.id === options.categoryId);
    const link = category?.links.find((item) => item.id === options.linkId);
    if (!category || !link) {
      return;
    }

    editContext = { categoryId: category.id, linkId: link.id };
    modalTitle.textContent = "Edit Link";
    linkNameInput.value = link.name;
    linkUrlInput.value = link.url;
    linkCategorySelect.value = category.id;
  } else {
    modalTitle.textContent = "Add Link";
    if (options.selectedCategoryId) {
      linkCategorySelect.value = options.selectedCategoryId;
    }
  }

  modalOverlay.classList.remove("hidden");
  linkNameInput.focus();
}

function closeLinkModal() {
  editContext = null;
  linkForm.reset();
  modalOverlay.classList.add("hidden");
}

function populateCategorySelect(selectedCategoryId = "") {
  linkCategorySelect.textContent = "";
  for (const category of state.categories) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    linkCategorySelect.appendChild(option);
  }

  if (selectedCategoryId) {
    linkCategorySelect.value = selectedCategoryId;
  }
}

function createLink(categoryId, link) {
  const category = state.categories.find((item) => item.id === categoryId);
  if (!category) {
    return;
  }
  category.links.push(link);
}

function updateLink(fromCategoryId, linkId, payload) {
  const sourceCategory = state.categories.find((item) => item.id === fromCategoryId);
  if (!sourceCategory) {
    return;
  }

  const linkIndex = sourceCategory.links.findIndex((link) => link.id === linkId);
  if (linkIndex === -1) {
    return;
  }

  const existingLink = sourceCategory.links[linkIndex];
  const updatedLink = { ...existingLink, name: payload.name, url: payload.url };

  if (payload.categoryId === fromCategoryId) {
    sourceCategory.links[linkIndex] = updatedLink;
    return;
  }

  sourceCategory.links.splice(linkIndex, 1);
  const destinationCategory = state.categories.find((item) => item.id === payload.categoryId);
  if (!destinationCategory) {
    sourceCategory.links.push(existingLink);
    return;
  }
  destinationCategory.links.push(updatedLink);
}

function moveLink(fromCategoryId, linkId, destinationCategoryId) {
  if (fromCategoryId === destinationCategoryId) {
    return false;
  }

  const sourceCategory = state.categories.find((item) => item.id === fromCategoryId);
  const destinationCategory = state.categories.find((item) => item.id === destinationCategoryId);
  if (!sourceCategory || !destinationCategory) {
    return false;
  }

  const linkIndex = sourceCategory.links.findIndex((item) => item.id === linkId);
  if (linkIndex === -1) {
    return false;
  }

  const [link] = sourceCategory.links.splice(linkIndex, 1);
  destinationCategory.links.push(link);
  return true;
}

function removeCategory(categoryId) {
  if (!requireEditUnlock()) {
    return;
  }

  const category = state.categories.find((item) => item.id === categoryId);
  if (!category) {
    return;
  }
  const count = category.links.length;
  const message =
    count > 0
      ? `Delete "${category.name}" and its ${count} link${count === 1 ? "" : "s"}?`
      : `Delete "${category.name}"?`;

  if (!confirm(message)) {
    return;
  }

  state.categories = state.categories.filter((item) => item.id !== categoryId);
  saveState();
  render();
}

function removeLink(categoryId, linkId) {
  if (!requireEditUnlock()) {
    return;
  }

  const category = state.categories.find((item) => item.id === categoryId);
  if (!category) {
    return;
  }

  const link = category.links.find((item) => item.id === linkId);
  if (!link) {
    return;
  }

  if (!confirm(`Delete "${link.name}"?`)) {
    return;
  }

  category.links = category.links.filter((item) => item.id !== linkId);
  saveState();
  render();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return initialState();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.categories)) {
      return initialState();
    }

    const normalized = {
      categories: parsed.categories
        .filter((category) => category && typeof category.name === "string")
        .map((category) => ({
          id: String(category.id || generateId()),
          name: category.name.trim() || "Untitled",
          links: Array.isArray(category.links)
            ? category.links
                .filter((link) => link && typeof link.name === "string" && typeof link.url === "string")
                .map((link) => ({
                  id: String(link.id || generateId()),
                  name: link.name.trim() || "Untitled",
                  url: normalizeUrl(link.url) || "https://example.com"
                }))
            : []
        }))
    };

    if (normalized.categories.length === 0) {
      return initialState();
    }
    return normalized;
  } catch {
    return initialState();
  }
}

function loadThemePreference() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return normalizeThemePreference(stored);
  } catch {
    return "system";
  }
}

function saveThemePreference(preference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, normalizeThemePreference(preference));
  } catch {}
}

function loadEditUnlockState() {
  try {
    return localStorage.getItem(EDIT_UNLOCK_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveEditUnlockState(value) {
  try {
    if (value) {
      localStorage.setItem(EDIT_UNLOCK_STORAGE_KEY, "true");
      return;
    }
    localStorage.removeItem(EDIT_UNLOCK_STORAGE_KEY);
  } catch {}
}

function initialState() {
  return {
    categories: []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeUrl(value) {
  if (!value) {
    return "";
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value) ? value : `https://${value}`;
  try {
    return new URL(candidate).toString();
  } catch {
    return "";
  }
}

function createSvgDataUri(svgMarkup) {
  return `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`;
}

function setLinkIcon(imageElement, url) {
  const hostname = extractHostname(url);
  const knownIconUrl = getKnownPlatformIconUrl(hostname);
  const faviconUrl = getFaviconUrl(hostname, url);
  const initialUrl = knownIconUrl || faviconUrl || GENERIC_LINK_ICON_URL;

  imageElement.loading = "lazy";
  imageElement.decoding = "async";
  imageElement.referrerPolicy = "no-referrer";
  imageElement.dataset.iconStep = knownIconUrl ? "known" : "favicon";
  imageElement.dataset.faviconUrl = faviconUrl;
  imageElement.dataset.genericUrl = GENERIC_LINK_ICON_URL;
  imageElement.onerror = () => {
    const step = imageElement.dataset.iconStep;
    if (step === "known" && imageElement.dataset.faviconUrl) {
      imageElement.dataset.iconStep = "favicon";
      imageElement.src = imageElement.dataset.faviconUrl;
      return;
    }

    imageElement.dataset.iconStep = "generic";
    imageElement.onerror = null;
    imageElement.src = imageElement.dataset.genericUrl || GENERIC_LINK_ICON_URL;
  };
  imageElement.src = initialUrl;
}

function extractHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function getKnownPlatformIconUrl(hostname) {
  if (!hostname) {
    return "";
  }

  const matched = KNOWN_PLATFORM_ICONS.find((entry) =>
    entry.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  );

  return matched ? `https://cdn.simpleicons.org/${matched.slug}` : "";
}

function getFaviconUrl(hostname, url) {
  const source = hostname ? `https://${hostname}` : url;
  if (!source) {
    return "";
  }

  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(source)}`;
}
