/**
 * Service Detail Page (Guest) - LocalSeva
 * Handles provider profile loading and guest redirections
 */

let currentProviderId = null;
let currentProvider = null;

document.addEventListener("DOMContentLoaded", function () {
  // Get provider ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  currentProviderId = urlParams.get("id");

  if (!currentProviderId) {
    showToast("Invalid provider ID", "error");
    window.location.href = "services.html";
    return;
  }

  // Load Data
  loadProviderDetails();
});

async function loadProviderDetails() {
  try {
    const provider = await api.getProviderById(currentProviderId);
    currentProvider = provider;
    
    // Update UI
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("providerContent").style.display = "block";
    
    document.getElementById("providerName").textContent = provider.username;
    document.getElementById("providerStatus").textContent = provider.is_available ? "Available" : "Busy";
    document.getElementById("providerStatus").className = provider.is_available ? "badge badge-success" : "badge badge-warning";

    // Avatar — show profile picture or initials fallback
    const avatarEl = document.getElementById("providerAvatar");
    if (provider.avatar) {
      const bust = `t=${Date.now()}`;
      const separator = provider.avatar.includes('?') ? '&' : '?';
      avatarEl.innerHTML = `<img src="${provider.avatar}${separator}${bust}" alt="${provider.username}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-user\\'></i>';">`;
    } else {
      const initials = (provider.username || "?")
        .split(/[\s_]+/)
        .map(w => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
      avatarEl.innerHTML = `<span style="font-size:2.5rem;font-weight:700;color:var(--primary);">${initials}</span>`;
    }
    
    document.getElementById("providerRating").textContent = `${parseFloat(provider.rating || 0).toFixed(1)} (${provider.total_reviews || 0} reviews)`;
    document.getElementById("providerExperience").textContent = `${provider.experience_years || 0} years exp.`;
    document.getElementById("providerCompleted").textContent = `${provider.completed_bookings_count || 0} jobs done`;
    document.getElementById("providerLocation").textContent = provider.location || "Location not specified";
    
    document.getElementById("providerBio").textContent = provider.bio || "No description provided.";
    
    // Pricing
    let priceDisplay = "Contact for price";
    if (provider.pricing_type === "HOURLY" && provider.base_price) {
      priceDisplay = `${formatCurrency(provider.base_price)}/hr`;
    } else if (provider.base_price) {
      priceDisplay = formatCurrency(provider.base_price);
    }
    document.getElementById("providerPrice").textContent = priceDisplay;
    document.getElementById("providerPricingType").textContent = provider.pricing_type || "N/A";
    
    // Categories and Areas
    const categories = Array.isArray(provider.categories) ? provider.categories.join(", ") : "General";
    document.getElementById("providerCategories").textContent = categories;
    
    const areas = Array.isArray(provider.service_locations) ? provider.service_locations.join(", ") : "All Areas";
    document.getElementById("providerServiceAreas").textContent = areas;

    // Bind Action Buttons (Redirect to login since user is a guest)
    const bookBtn = document.getElementById("bookServiceBtn");
    if (bookBtn) {
      bookBtn.addEventListener("click", () => {
        window.location.href = "login.html";
      });
    }

    const contactBtn = document.getElementById("contactProviderBtn");
    if (contactBtn) {
      contactBtn.addEventListener("click", () => {
        window.location.href = "login.html";
      });
    }

    // Load Reviews
    loadProviderReviews();

  } catch (error) {
    console.error("Error loading provider:", error);
    showToast("Error loading provider details: " + error.message, "error");
    document.getElementById("loadingState").innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle text-danger"></i>
        <h3>Provider Not Found</h3>
        <p>The service provider you are looking for does not exist or an error occurred.</p>
        <a href="services.html" class="btn btn-primary mt-4">Back to Services</a>
      </div>
    `;
  }
}

async function loadProviderReviews() {
  const reviewsContainer = document.getElementById("reviewsList");
  const reviewCountHeader = document.getElementById("reviewCountHeader");
  
  try {
    const reviews = await api.getProviderReviews(currentProviderId);
    
    reviewCountHeader.textContent = reviews.length;
    
    if (reviews.length === 0) {
      reviewsContainer.innerHTML = '<div class="text-muted text-center py-4">No reviews yet.</div>';
      return;
    }
    
    reviewsContainer.innerHTML = '';
    reviews.forEach(review => {
      const stars = Array(5).fill(0).map((_, i) => 
        `<i class="fas fa-star ${i < review.rating ? 'text-warning' : 'text-gray-300'}"></i>`
      ).join('');
      
      reviewsContainer.innerHTML += `
        <div class="review-item">
          <div class="review-header">
            <span class="review-author">${review.user_name}</span>
            <span class="review-date">${formatDate(review.created_at)}</span>
          </div>
          <div class="review-rating mb-2">
            ${stars}
          </div>
          <p class="text-sm text-secondary m-0">${review.comment}</p>
        </div>
      `;
    });
    
  } catch (error) {
    console.error("Error loading reviews:", error);
    reviewsContainer.innerHTML = '<div class="text-danger text-center py-4">Failed to load reviews.</div>';
  }
}
