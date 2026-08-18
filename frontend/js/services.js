/**
 * Services page functionality
 * Requires authentication to access
 */

document.addEventListener("DOMContentLoaded", async function () {
  // Initialize services page
  await initServicesPage();
});

/**
 * Initialize services page
 */
async function initServicesPage() {
  // Load services
  await loadServices();

  // Setup filters
  setupFilters();

  // Setup search
  setupSearch();
}

// Store all services for client-side filtering
let allServices = [];

/**
 * Load services from API
 */
async function loadServices() {
  const container = document.getElementById("servicesContainer");
  if (!container) return;

  // Show loading state
  container.innerHTML = `
    <div class="loading-skeleton"></div>
    <div class="loading-skeleton"></div>
    <div class="loading-skeleton"></div>
  `;

  try {
    // Get providers from API
    const providers = await api.getProviders();
    console.log("Providers data:", providers); // Debug log

    // Check if we have providers
    if (!providers || providers.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i class="fas fa-search"></i>
          <h3>No services found</h3>
          <p>Try adjusting your filters or check back later for new services.</p>
        </div>
      `;
      return;
    }

    // Map providers to service format
    const services = providers.map((provider) => {
      // Handle categories - could be string, array, or null
      let categoriesArray = ["General"];

      if (provider.categories) {
        if (typeof provider.categories === "string") {
          try {
            const parsed = JSON.parse(provider.categories);
            if (Array.isArray(parsed)) {
              categoriesArray = parsed;
            } else {
              categoriesArray = provider.categories
                .split(",")
                .map((cat) => cat.trim());
            }
          } catch {
            categoriesArray = provider.categories
              .split(",")
              .map((cat) => cat.trim());
          }
        } else if (Array.isArray(provider.categories)) {
          categoriesArray = provider.categories;
        } else {
          categoriesArray = [String(provider.categories)];
        }
      }

      // Get the primary category for display
      const primaryCategory = categoriesArray[0] || "Service";

      return {
        id: provider.id,
        name: provider.username || provider.name || "Unknown Provider",
        category: primaryCategory,
        location: provider.location || "",
        rating: provider.rating || 0,
        description:
          provider.bio || provider.description || "No description available",
        availability: provider.is_available ? "Available" : "Busy",
        price:
          provider.hourly_rate || provider.base_price || "Contact for price",
        pricing_type: provider.pricing_type,
        avatar: provider.avatar || null,
        total_reviews: provider.total_reviews || 0,
        experience_years: provider.experience_years || 0,
        service_locations:
          provider.service_locations || provider.location || "",
        categories: categoriesArray.join(", "),
        categoriesArray: categoriesArray,
        completed_bookings_count: provider.completed_bookings_count || 0,
      };
    });

    // Store all services for client-side filtering
    allServices = services;
    console.log("Processed services:", services); // Debug log

    // Render services
    renderServices(services);
  } catch (error) {
    console.error("Error loading services:", error);
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fas fa-exclamation-circle text-danger"></i>
        <h3>Error loading services</h3>
        <p>${error.message || "Please try again later."}</p>
        <button onclick="loadServices()" class="btn btn-outline mt-4">Retry</button>
      </div>
    `;
  }
}

/**
 * Get category icon CSS class
 */
function getCategoryIcon(category) {
  if (!category) return "fas fa-tag";

  const categoryLower = category.toLowerCase();
  if (categoryLower.includes("cleaning")) return "fas fa-broom";
  if (categoryLower.includes("carpenter") || categoryLower.includes("carpentry")) return "fas fa-hammer";
  if (categoryLower.includes("electrical")) return "fas fa-bolt";
  if (categoryLower.includes("plumbing")) return "fas fa-faucet";
  if (categoryLower.includes("ceramic")) return "fas fa-palette";
  if (categoryLower.includes("fitness")) return "fas fa-dumbbell";
  if (categoryLower.includes("delivery") || categoryLower.includes("moving"))
    return "fas fa-truck";
  if (categoryLower.includes("education") || categoryLower.includes("tutor"))
    return "fas fa-graduation-cap";
  return "fas fa-tag";
}

/**
 * Get a CSS gradient color pair based on category (for fallback when no image)
 */
function getCategoryGradient(category) {
  if (!category) return ["#7495e8", "#a8c1ff"];

  const categoryLower = category.toLowerCase();
  if (categoryLower.includes("cleaning")) return ["#4caf50", "#81c784"];
  if (categoryLower.includes("carpenter") || categoryLower.includes("carpentry")) return ["#8d6e63", "#bcaaa4"];
  if (categoryLower.includes("electrical")) return ["#ffc107", "#ffecb3"];
  if (categoryLower.includes("plumbing")) return ["#2196f3", "#90caf9"];
  if (categoryLower.includes("ceramic")) return ["#ff9800", "#ffcc80"];
  if (categoryLower.includes("fitness")) return ["#e91e63", "#f48fb1"];
  if (categoryLower.includes("delivery") || categoryLower.includes("moving"))
    return ["#795548", "#d7ccc8"];
  if (categoryLower.includes("education") || categoryLower.includes("tutor"))
    return ["#9c27b0", "#ce93d8"];
  return ["#7495e8", "#a8c1ff"];
}

/**
 * Render services in grid — flicker-free approach
 */
function renderServices(services) {
  const container = document.getElementById("servicesContainer");
  if (!container) return;

  const isLoggedIn = !!localStorage.getItem("accessToken");
  const detailPage = isLoggedIn ? "service-detail.html" : "service-detail-guest.html";

  if (services.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fas fa-search"></i>
        <h3>No services found</h3>
        <p>Try adjusting your filters or check back later for new services.</p>
      </div>
    `;
    return;
  }

  // Build all cards at once to prevent DOM reflow flickering
  const fragment = document.createDocumentFragment();

  services.forEach((service) => {
    const serviceCard = document.createElement("div");
    serviceCard.className = "card";

    // Format price display
    let priceDisplay = "Contact for price";
    if (
      service.pricing_type === "HOURLY" &&
      service.price &&
      service.price !== "Contact for price"
    ) {
      priceDisplay = `${formatCurrency(service.price)}/hr`;
    } else if (service.price && service.price !== "Contact for price") {
      priceDisplay = `${formatCurrency(service.price)}`;
    }

    // Get appropriate icon for category
    const categoryIcon = getCategoryIcon(service.category);
    const [gradColor1, gradColor2] = getCategoryGradient(service.category);
    const categoryInitial = (service.category || "S").charAt(0).toUpperCase();
    const nameInitials = (service.name || "U")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);

    // Build image section — use avatar if available, otherwise a styled placeholder
    let imageHTML;
    if (service.avatar) {
      // Real avatar: use <img> with absolute positioning so card-img-wrapper padding doesn't push it out
      imageHTML = `
        <div class="card-img-wrapper" style="background: linear-gradient(135deg, ${gradColor1}, ${gradColor2}); position: relative; height: 180px; padding-top: 0; border-radius: var(--border-radius-sm); overflow: hidden; margin-bottom: 1rem;">
          <img src="${service.avatar}" 
               alt="${service.name}" 
               style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block;"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div style="display: none; position: absolute; inset: 0; align-items: center; justify-content: center; flex-direction: column; color: white; gap: 0.5rem;">
            <i class="${categoryIcon}" style="font-size: 2.5rem; opacity: 0.9;"></i>
            <span style="font-size: 1.1rem; font-weight: 600; opacity: 0.85;">${service.category}</span>
          </div>
        </div>`;
    } else {
      // No avatar: use a styled gradient placeholder — no network request, no flicker
      imageHTML = `
        <div class="card-img-wrapper" style="background: linear-gradient(135deg, ${gradColor1}, ${gradColor2}); height: 180px; padding-top: 0; border-radius: var(--border-radius-sm); overflow: hidden; margin-bottom: 1rem; display: flex; align-items: center; justify-content: center; flex-direction: column; color: white; gap: 0.5rem;">
          <i class="${categoryIcon}" style="font-size: 2.5rem; opacity: 0.9;"></i>
          <span style="font-size: 1.1rem; font-weight: 600; opacity: 0.85;">${service.category}</span>
        </div>`;
    }

    serviceCard.innerHTML = `
      ${imageHTML}
      <div class="card-content">
        <div class="card-header">
          <h3 class="card-title">${service.name}</h3>
          <span class="badge ${service.availability === "Available"
        ? "badge-success"
        : "badge-warning"
      }">
            ${service.availability}
          </span>
        </div>
        <div class="card-meta">
          <span><i class="${categoryIcon}"></i> ${service.category}</span>
          <span><i class="fas fa-map-marker-alt"></i> ${service.location || "Local"}</span>
          <span><i class="fas fa-star"></i> ${service.rating.toFixed(1)}</span>
          <span><i class="fas fa-check-circle"></i> ${service.completed_bookings_count || 0} jobs</span>
        </div>
        <p class="service-description-short">${service.description.substring(
        0,
        100,
      )}${service.description.length > 100 ? "..." : ""}</p>
        <div class="card-footer">
          <span class="card-price">${priceDisplay}</span>
          <a href="${detailPage}?id=${service.id}" class="btn btn-primary btn-sm">
            View Details
          </a>
        </div>
      </div>
    `;

    fragment.appendChild(serviceCard);
  });

  // Single DOM update — prevents flickering
  container.replaceChildren(...fragment.childNodes);
}

/**
 * Setup filter functionality
 */
function setupFilters() {
  // Category filter buttons
  const categoryButtons = document.querySelectorAll(".category-filter");
  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      // Update active state
      categoryButtons.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");

      // Apply filters
      applyFilters();
    });
  });

  // Location filter — apply immediately on change
  const locationFilter = document.getElementById("locationFilter");
  if (locationFilter) {
    locationFilter.addEventListener("change", applyFilters);
  }

  // Clear filters button
  const clearBtn = document.getElementById("clearFilters");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      // Reset filters
      document.querySelectorAll(".category-filter").forEach((btn) => {
        if (btn.dataset.category === "all") {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });

      if (locationFilter) locationFilter.value = "";

      const searchInput = document.getElementById("servicesSearch");
      if (searchInput) searchInput.value = "";

      // Render all services
      renderServices(allServices);
    });
  }
}

/**
 * Setup search functionality
 */
function setupSearch() {
  const searchInput = document.getElementById("servicesSearch");
  if (!searchInput) return;

  let searchTimer;

  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 300);
  });
}

/**
 * Normalize a string for comparison — lowercase + trim
 */
function normalize(str) {
  if (Array.isArray(str)) {
    return str.join(" ").toLowerCase().trim();
  }
  return String(str || "").toLowerCase().trim();
}

/**
 * Apply filters (client-side filtering)
 */
function applyFilters() {
  // Get active category
  const activeCategory = document.querySelector(".category-filter.active");
  const selectedCategory = activeCategory
    ? activeCategory.dataset.category
    : "all";

  // Get location filter
  const locationFilter = document.getElementById("locationFilter");
  const selectedLocation = locationFilter ? locationFilter.value : "";

  // Get search term
  const searchInput = document.getElementById("servicesSearch");
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";

  console.log("Applying filters:", { selectedCategory, selectedLocation, searchTerm });

  // Start with all services
  let filteredServices = allServices;

  // Apply category filter
  if (selectedCategory && selectedCategory !== "all") {
    const filterCat = normalize(selectedCategory);
    filteredServices = filteredServices.filter((service) => {
      // Check primary category
      if (normalize(service.category).includes(filterCat)) return true;
      // Check all categories array
      if (service.categoriesArray && service.categoriesArray.length > 0) {
        return service.categoriesArray.some((cat) =>
          normalize(cat).includes(filterCat)
        );
      }
      // Check comma-separated categories string
      if (service.categories) {
        return normalize(service.categories).includes(filterCat);
      }
      return false;
    });
  }

  // Apply location filter
  if (selectedLocation) {
    const filterLoc = normalize(selectedLocation);
    filteredServices = filteredServices.filter((service) => {
      // Check primary location
      const loc = normalize(service.location);
      if (loc === filterLoc || loc.includes(filterLoc)) return true;

      // Check service_locations (could be string or comma-separated)
      const svcLocs = normalize(service.service_locations);
      if (svcLocs.includes(filterLoc)) return true;

      return false;
    });
  }

  // Apply search filter
  if (searchTerm) {
    filteredServices = filteredServices.filter((service) => {
      return (
        normalize(service.name).includes(searchTerm) ||
        normalize(service.description).includes(searchTerm) ||
        normalize(service.category).includes(searchTerm) ||
        normalize(service.categories).includes(searchTerm) ||
        normalize(service.location).includes(searchTerm)
      );
    });
  }

  console.log(`Filter results: ${filteredServices.length} / ${allServices.length}`);

  // Render filtered services
  renderServices(filteredServices);
}
