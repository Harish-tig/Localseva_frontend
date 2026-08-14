/**
 * Marketplace Page - LocalSeva
 * Handles loading products, filtering, and adding new items
 */

let allProducts = [];

// Map backend category keys to human-readable labels
const CATEGORY_LABELS = {
  FURNITURE: "Furniture",
  ELECTRONICS: "Electronics",
  VEHICLES: "Vehicles",
  REAL_ESTATE: "Real Estate",
  HOME_APPLIANCES: "Home Appliances",
  CLOTHING: "Clothing & Accessories",
  BOOKS: "Books & Media",
  SPORTS: "Sports Equipment",
  OTHER: "Other"
};

document.addEventListener("DOMContentLoaded", function () {

  // Setup Add Product form
  const addProductForm = document.getElementById("addProductForm");
  if (addProductForm) {
    addProductForm.addEventListener("submit", handleAddProduct);
  }

  // Setup search and filters
  const searchInput = document.getElementById("productSearch");
  const categoryFilter = document.getElementById("categoryFilter");
  const conditionFilter = document.getElementById("conditionFilter");
  const clearFiltersBtn = document.getElementById("clearFilters");

  if (searchInput) searchInput.addEventListener("input", debounce(applyFilters, 300));
  if (categoryFilter) categoryFilter.addEventListener("change", applyFilters);
  if (conditionFilter) conditionFilter.addEventListener("change", applyFilters);
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (categoryFilter) categoryFilter.value = "";
      if (conditionFilter) conditionFilter.value = "";
      applyFilters();
    });
  }

  // Load Initial Data
  loadProducts();
});

// Debounce utility for search input
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function loadProducts() {
  const container = document.getElementById("productsContainer");

  if (!container) return;

  // Show loading state
  container.innerHTML = `
    <div class="loading-skeleton" style="height: 300px;"></div>
    <div class="loading-skeleton" style="height: 300px;"></div>
    <div class="loading-skeleton" style="height: 300px;"></div>
    <div class="loading-skeleton" style="height: 300px;"></div>
  `;

  try {
    allProducts = await api.getProducts({ ordering: "-created_at", is_sold: false });
    renderProducts(allProducts);
  } catch (error) {
    console.error("Error loading products:", error);
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fas fa-exclamation-circle text-danger"></i>
        <h3>Error loading marketplace</h3>
        <p>${error.message || "Please try again later."}</p>
        <button onclick="loadProducts()" class="btn btn-outline mt-4">Retry</button>
      </div>
    `;
  }
}

function applyFilters() {
  const searchTerm = document.getElementById("productSearch")?.value.toLowerCase() || "";
  const category = document.getElementById("categoryFilter")?.value || "";
  const condition = document.getElementById("conditionFilter")?.value || "";

  const filteredProducts = allProducts.filter((product) => {
    // Check search term (title, description, city)
    const matchesSearch =
      !searchTerm ||
      (product.title && product.title.toLowerCase().includes(searchTerm)) ||
      (product.description && product.description.toLowerCase().includes(searchTerm)) ||
      (product.city && product.city.toLowerCase().includes(searchTerm));

    // Check category
    const matchesCategory = !category || product.category === category;

    // Check condition
    const matchesCondition = !condition || product.condition === condition;

    return matchesSearch && matchesCategory && matchesCondition;
  });

  renderProducts(filteredProducts);
}

function renderProducts(products) {
  const container = document.getElementById("productsContainer");
  if (!container) return;

  const isLoggedIn = !!localStorage.getItem("accessToken");
  const detailPage = isLoggedIn ? "product-detail.html" : "product-detail-guest.html";

  if (!products || products.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fas fa-box-open"></i>
        <h3>No items found</h3>
        <p>Try adjusting your search or filters.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = products.map((product) => {
    // Condition badge color
    let conditionBadge = "badge-secondary";
    if (product.condition === "NEW") conditionBadge = "badge-success";
    else if (product.condition === "LIKE_NEW" || product.condition === "GOOD") conditionBadge = "badge-primary";

    // Format condition text
    const conditionText = product.condition ? product.condition.replace("_", " ") : "Unknown";

    // Image fallback
    const imgUrl = product.main_image || "https://placehold.co/600x400/e2e8f0/64748b?text=No+Image";

    return `
      <div class="card">
        <div class="card-img-wrapper">
          <img src="${imgUrl}" alt="${product.title}" class="card-img" onerror="this.src='https://placehold.co/600x400/e2e8f0/64748b?text=Image+Error'">
          <div style="position: absolute; top: var(--space-3); right: var(--space-3);">
            <span class="badge ${conditionBadge}">${conditionText}</span>
          </div>
        </div>
        
        <div class="card-content">
          <div class="card-header">
            <h3 class="card-title">${product.title}</h3>
          </div>
          
          <div class="card-meta">
            <span><i class="fas fa-map-marker-alt"></i> ${product.city || 'Unknown location'}</span>
            <span><i class="fas fa-tag"></i> ${CATEGORY_LABELS[product.category] || product.category || 'Other'}</span>
          </div>
          
          <p class="product-description-short">${product.description || 'No description provided.'}</p>
          
          <div class="card-footer">
            <span class="card-price">${formatCurrency(product.price)}</span>
            <a href="${detailPage}?id=${product.id}" class="btn btn-primary btn-sm">
              View Item
            </a>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function handleAddProduct(e) {
  e.preventDefault();

  const submitBtn = document.getElementById("submitProductBtn");
  const originalText = submitBtn.textContent;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Listing...';

    const formData = new FormData();
    formData.append("title", document.getElementById("title").value);
    formData.append("price", document.getElementById("price").value);
    formData.append("condition", document.getElementById("condition").value);
    formData.append("category", document.getElementById("category").value);
    formData.append("city", document.getElementById("city").value);
    formData.append("address", document.getElementById("address").value);
    formData.append("description", document.getElementById("description").value);
    formData.append("contact_phone", document.getElementById("contact_phone").value);
    formData.append("contact_whatsapp", document.getElementById("contact_whatsapp").value);

    // Main image
    const fileInput = document.getElementById("main_image");
    if (fileInput && fileInput.files && fileInput.files[0]) {
      formData.append("main_image", fileInput.files[0]);
    }

    // Additional images
    const image2Input = document.getElementById("image_2");
    if (image2Input && image2Input.files && image2Input.files[0]) {
      formData.append("image_2", image2Input.files[0]);
    }
    const image3Input = document.getElementById("image_3");
    if (image3Input && image3Input.files && image3Input.files[0]) {
      formData.append("image_3", image3Input.files[0]);
    }

    await api.createProduct(formData);

    showToast("Item listed successfully!", "success");
    closeModal("addProductModal");
    document.getElementById("addProductForm").reset();

    // Reload products to show the new one
    loadProducts();

  } catch (error) {
    console.error("Error creating product:", error);
    showToast(error.message || "Failed to list item.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}
