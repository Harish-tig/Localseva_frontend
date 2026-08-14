/**
 * Profile Page - LocalSeva
 * Handles loading and updating user profile and provider settings
 */

document.addEventListener("DOMContentLoaded", function () {
  // Check auth
  if (typeof api !== 'undefined' && !api.isAuthenticated()) {
    window.location.href = "index.html";
    return;
  }

  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    profileForm.addEventListener("submit", handleProfileUpdate);
  }

  const becomeProviderBtn = document.getElementById("becomeProviderBtn");
  if (becomeProviderBtn) {
    becomeProviderBtn.addEventListener("click", handleBecomeProvider);
  }

  // Avatar Upload Logic
  const avatarUploadContainer = document.getElementById("avatarUploadContainer");
  const avatarInput = document.getElementById("avatarInput");
  const avatarPreview = document.getElementById("avatarPreview");

  if (avatarUploadContainer && avatarInput && avatarPreview) {
    avatarUploadContainer.addEventListener("click", () => {
      avatarInput.click();
    });

    avatarInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        showToast("Please select an image file.", "error");
        return;
      }

      const originalContent = avatarPreview.innerHTML;
      // Show loading spinner
      avatarPreview.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>';

      try {
        const formData = new FormData();
        formData.append("avatar", file);

        const updatedProfile = await api.updateProfile(formData);
        
        if (updatedProfile && updatedProfile.avatar) {
          avatarPreview.innerHTML = `<img src="${updatedProfile.avatar}" alt="Profile Photo" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
          showToast("Profile picture updated successfully!", "success");
        } else {
          avatarPreview.innerHTML = originalContent;
          showToast("Uploaded, but failed to load preview. Please refresh.", "warning");
        }
      } catch (error) {
        console.error("Error uploading avatar:", error);
        avatarPreview.innerHTML = originalContent;
        showToast(error.message || "Failed to upload profile picture.", "error");
      }
    });
  }

  loadProfile();
});

async function loadProfile() {
  try {
    const profile = await api.getProfile();
    
    // Hide loading, show content
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("profileContent").style.display = "block";
    
    // Header Info
    document.getElementById("displayUsername").textContent = profile.username || "User";
    document.getElementById("displayEmail").textContent = profile.email || "";
    
    // Set Avatar Preview
    const avatarPreview = document.getElementById("avatarPreview");
    if (avatarPreview) {
      if (profile.avatar) {
        avatarPreview.innerHTML = `<img src="${profile.avatar}" alt="Profile Photo" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
      } else {
        avatarPreview.innerHTML = '<i class="fas fa-user"></i>';
      }
    }
    
    const roleBadge = document.getElementById("displayRole");
    if (profile.is_service_provider || profile.role === 'SERVICE') {
      roleBadge.textContent = "Service Provider";
      roleBadge.className = "badge badge-primary";
      
      // Show provider section
      document.getElementById("providerDetailsSection").style.display = "block";
      document.getElementById("providerUpgradeBox").style.display = "none";
      
      // Fill provider data
      document.getElementById("is_available").checked = profile.is_available;
      document.getElementById("experience_years").value = profile.experience_years || "";
      document.getElementById("pricing_type").value = profile.pricing_type || "FIXED";
      document.getElementById("base_price").value = profile.base_price || "";
      
      // Handle arrays
      const cats = Array.isArray(profile.categories) ? profile.categories.join(", ") : (profile.categories || "");
      document.getElementById("categories").value = cats;
      
      const locs = Array.isArray(profile.service_locations) ? profile.service_locations.join(", ") : (profile.service_locations || "");
      document.getElementById("service_locations").value = locs;
      
    } else {
      roleBadge.textContent = "Standard User";
      roleBadge.className = "badge badge-secondary";
      
      // Show upgrade box
      document.getElementById("providerDetailsSection").style.display = "none";
      document.getElementById("providerUpgradeBox").style.display = "flex";
    }
    
    // Basic Info
    document.getElementById("phone").value = profile.phone || "";
    document.getElementById("location").value = profile.location || "";
    document.getElementById("bio").value = profile.bio || "";
    
  } catch (error) {
    console.error("Error loading profile:", error);
    showToast("Failed to load profile details.", "error");
  }
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById("saveProfileBtn");
  const originalText = submitBtn.innerHTML;
  
  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    // Check if user is a service provider to validate those fields
    const isProvider = document.getElementById("providerDetailsSection").style.display !== "none";
    
    const profileData = {
      phone: document.getElementById("phone").value,
      location: document.getElementById("location").value,
      bio: document.getElementById("bio").value
    };
    
    if (isProvider) {
      profileData.is_available = document.getElementById("is_available").checked;
      profileData.experience_years = document.getElementById("experience_years").value;
      profileData.pricing_type = document.getElementById("pricing_type").value;
      profileData.base_price = document.getElementById("base_price").value;
      
      // Parse comma separated arrays
      const catStr = document.getElementById("categories").value;
      profileData.categories = catStr ? catStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      
      const locStr = document.getElementById("service_locations").value;
      profileData.service_locations = locStr ? locStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      
      // Validation
      if (!profileData.experience_years || !profileData.pricing_type || !profileData.base_price) {
        throw new Error("Please fill all required provider fields (Experience, Pricing Type, Base Price)");
      }
    }
    
    await api.updateProfile(profileData);
    
    showToast("Profile updated successfully!", "success");
    
    // Refresh to ensure everything is synced
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error("Profile update error:", error);
    showToast(error.message || "Failed to update profile.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

async function handleBecomeProvider() {
  if (!confirm("Are you sure you want to become a service provider? You will need to fill out additional details.")) {
    return;
  }
  
  const btn = document.getElementById("becomeProviderBtn");
  const originalText = btn.innerHTML;
  
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    await api.becomeProvider();
    
    showToast("Success! Please fill out your provider details below.", "success");
    
    // Hide upgrade box, show provider details
    document.getElementById("providerUpgradeBox").style.display = "none";
    document.getElementById("providerDetailsSection").style.display = "block";
    
    // Update role badge
    const roleBadge = document.getElementById("displayRole");
    roleBadge.textContent = "Service Provider";
    roleBadge.className = "badge badge-primary";
    
    // Scroll to details
    document.getElementById("providerDetailsSection").scrollIntoView({ behavior: 'smooth' });
    
  } catch (error) {
    console.error("Become provider error:", error);
    showToast(error.message || "Failed to upgrade account.", "error");
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}
