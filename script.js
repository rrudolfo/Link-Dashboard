const STORAGE_KEY = "link_dashboard_data_v1";

const categoryForm = document.getElementById("category-form");
const categoryNameInput = document.getElementById("category-name-input");
const categoriesContainer = document.getElementById("categories-container");
const newLinkBtn = document.getElementById("new-link-btn");

const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalCloseBtn = document.getElementById("modal-close-btn");
const linkForm = document.getElementById("link-form");
const linkNameInput = document.getElementById("link-name-input");
const linkUrlInput = document.getElementById("link-url-input");
const linkCategorySelect = document.getElementById("link-category-select");

const categoryTemplate = document.getElementById("category-template");
const linkTemplate = document.getElementById("link-template");

let state = loadState();
let editContext = null;

render();

categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
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

newLinkBtn.addEventListener("click", () => openLinkModal());
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

linkForm.addEventListener("submit", (event) => {
  event.preventDefault();

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
    categoryNode.querySelector(".category-title").textContent = category.name;

    const addLinkBtn = categoryNode.querySelector(".add-link-btn");
    addLinkBtn.addEventListener("click", () => openLinkModal({ selectedCategoryId: category.id }));

    const deleteCategoryBtn = categoryNode.querySelector(".delete-category-btn");
    deleteCategoryBtn.addEventListener("click", () => removeCategory(category.id));

    const linksList = categoryNode.querySelector(".links-list");
    if (category.links.length === 0) {
      const emptyLinkItem = document.createElement("li");
      emptyLinkItem.className = "empty-note";
      emptyLinkItem.textContent = "No links in this category.";
      linksList.appendChild(emptyLinkItem);
    } else {
      for (const link of category.links) {
        const linkNode = linkTemplate.content.firstElementChild.cloneNode(true);
        const anchor = linkNode.querySelector(".link-anchor");
        anchor.textContent = link.name;
        anchor.href = link.url;
        anchor.title = link.url;

        linkNode
          .querySelector(".edit-link-btn")
          .addEventListener("click", () => openLinkModal({ categoryId: category.id, linkId: link.id }));
        linkNode.querySelector(".delete-link-btn").addEventListener("click", () => {
          removeLink(category.id, link.id);
        });

        linksList.appendChild(linkNode);
      }
    }

    categoriesContainer.appendChild(categoryNode);
  }
}

function openLinkModal(options = {}) {
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

function removeCategory(categoryId) {
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
