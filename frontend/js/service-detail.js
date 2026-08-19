/**
 * Service Detail Page - LocalSeva
 * Handles provider profile loading, booking, and reviews
 */

let currentProviderId = null;
let currentProvider = null;

document.addEventListener("DOMContentLoaded", function () {
  // Check auth
  if (typeof api !== 'undefined' && !api.isAuthenticated()) {
    window.location.href = "../index.html";
    return;
  }

  // Get provider ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  currentProviderId = urlParams.get("id");

  if (!currentProviderId) {
    showToast("Invalid provider ID", "error");
    window.location.href = "services.html";
    return;
  }

  // Setup modal close buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      this.closest('.modal-overlay').classList.remove('active');
    });
  });

  // Setup min date for booking
  const dateInput = document.getElementById("scheduled_date");
  if (dateInput) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dateInput.min = now.toISOString().slice(0, 16);
  }

  // Bind forms
  const bookingForm = document.getElementById("bookingForm");
  if (bookingForm) {
    bookingForm.addEventListener("submit", handleBookingSubmit);
  }

  const reviewForm = document.getElementById("reviewForm");
  if (reviewForm) {
    reviewForm.addEventListener("submit", handleReviewSubmit);
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
      // Append cache-buster so updated profile pictures always show
      const bust = `t=${Date.now()}`;
      const separator = provider.avatar.includes('?') ? '&' : '?';
      avatarEl.innerHTML = `<img src="${provider.avatar}${separator}${bust}" alt="${provider.username}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-user\\'></i>';">`;
    } else {
      // Generate initials from username
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

    // Populate Booking Modal Category Select
    const categorySelect = document.getElementById("service_category");
    if (categorySelect && Array.isArray(provider.categories)) {
      categorySelect.innerHTML = '<option value="">Select a category</option>';
      provider.categories.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
      });
    }

    // Bind Action Buttons
    const bookBtn = document.getElementById("bookServiceBtn");
    if (bookBtn) {
      bookBtn.addEventListener("click", () => {
        if (!provider.is_available) {
          showToast("This provider is currently not available.", "warning");
          return;
        }
        openModal("bookingModal");
      });
    }

    const contactBtn = document.getElementById("contactProviderBtn");
    if (contactBtn) {
      contactBtn.addEventListener("click", () => {
        showToast("Contact feature coming soon!", "info");
      });
    }

    // Report Provider button
    const reportBtn = document.getElementById("reportProviderBtn");
    if (reportBtn) {
      reportBtn.addEventListener("click", () => {
        openModal("reportModal");
      });
    }

    // Bind report form
    const reportForm = document.getElementById("reportForm");
    if (reportForm) {
      // Store provider's user data for report
      document.getElementById("reportedUserId").value = provider.user ? provider.user : '';
      reportForm.addEventListener("submit", handleReportSubmit);
    }

    // Load Reviews
    loadProviderReviews();
    
    // Load User Bookings for Reviews
    loadUserBookingsForReview();

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

async function handleBookingSubmit(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById("submitBookingBtn");
  const originalText = submitBtn.textContent;
  
  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...';
    
    const bookingData = {
      provider_id: currentProviderId,
      service_category: document.getElementById("service_category").value,
      scheduled_date: new Date(document.getElementById("scheduled_date").value).toISOString(),
      address: document.getElementById("address").value,
      description: document.getElementById("description").value
    };
    
    await api.createBooking(bookingData);
    
    showToast("Service booked successfully! Check your dashboard for updates.", "success");
    closeModal("bookingModal");
    document.getElementById("bookingForm").reset();
    
    // Redirect to dashboard after a delay
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 2000);
    
  } catch (error) {
    console.error("Booking error:", error);
    showToast(error.message || "Failed to book service.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function loadProviderReviews() {
  const reviewsContainer = document.getElementById("reviewsList");
  const reviewCountHeader = document.getElementById("reviewCountHeader");
  
  try {
    const reviews = await api.getProviderReviews(currentProviderId);
    
    reviewCountHeader.textContent = reviews.length;
    
    if (reviews.length === 0) {
      reviewsContainer.innerHTML = '<div class="text-muted text-center py-4">No reviews yet. Be the first to review!</div>';
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

async function loadUserBookingsForReview() {
  try {
    // Requires an endpoint that fetches completed bookings for this specific user + provider
    // In current api.js, we have getUserBookingsForProvider
    const bookings = await api.getUserBookingsForProvider(currentProviderId);
    
    const writeReviewBtn = document.getElementById("writeReviewBtn");
    const bookingSelect = document.getElementById("review_booking");
    
    if (bookings && bookings.length > 0) {
      writeReviewBtn.style.display = "inline-flex";
      writeReviewBtn.addEventListener("click", () => openModal("reviewModal"));
      
      bookingSelect.innerHTML = '<option value="">Select a completed booking</option>';
      bookings.forEach(booking => {
        bookingSelect.innerHTML += `
          <option value="${booking.id}">
            ${booking.service_category} - ${formatDate(booking.completed_at)}
          </option>
        `;
      });
    }
  } catch (error) {
    console.log("Could not load user bookings for review or no completed bookings found.");
  }
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById("submitReviewBtn");
  const originalText = submitBtn.textContent;
  
  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    const reviewData = {
      booking: document.getElementById("review_booking").value,
      provider_id: currentProviderId,
      rating: parseInt(document.getElementById("review_rating").value),
      comment: document.getElementById("review_comment").value
    };
    
    await api.createReview(reviewData);
    
    showToast("Review submitted successfully!", "success");
    closeModal("reviewModal");
    document.getElementById("reviewForm").reset();
    
    // Reload reviews
    loadProviderReviews();
    
  } catch (error) {
    console.error("Review error:", error);
    showToast(error.message || "Failed to submit review.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function handleReportSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById("submitReportBtn");
  const originalHTML = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    // reported_profile_id = Profile PK (from URL param, already an integer)
    // reported_user = UserModel PK, stored from provider data at load time.
    // ServiceProviderSerializer doesn't expose UserModel PK directly, so we
    // show a graceful message if it's not available.
    const reportedUserId = document.getElementById("reportedUserId").value;

    if (!reportedUserId) {
      showToast("Unable to identify the provider's account ID. Please contact support to report this provider.", "warning");
      closeModal("reportModal");
      return;
    }

    const reportData = {
      reported_user: parseInt(reportedUserId),
      report_type: document.getElementById("report_type").value,
      description: document.getElementById("report_description").value,
      reported_profile_id: parseInt(currentProviderId),
    };

    await api.createReport(reportData);

    showToast("Report submitted. Our team will review it shortly.", "success");
    closeModal("reportModal");
    document.getElementById("reportForm").reset();

  } catch (error) {
    console.error("Report error:", error);
    showToast(error.message || "Failed to submit report.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHTML;
  }
}
