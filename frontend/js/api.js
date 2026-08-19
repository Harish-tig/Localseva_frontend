/**
 * API Configuration for Django DRF with JWT Authentication
 */
const API_BASE_URL = "http://127.0.0.1:8000/api/user/";
//const API_BASE_URL = "https://localseva-kuak.onrender.com/api/user/";

// JWT Token management
let accessToken = localStorage.getItem("accessToken");
let refreshToken = localStorage.getItem("refreshToken");

// ===== TOKEN MANAGEMENT =====

function saveTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem("accessToken", access);
  localStorage.setItem("refreshToken", refresh);
}

function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userName");
  localStorage.removeItem("userIsProvider");
}

function isAuthenticated() {
  return !!accessToken;
}

function normalizeImageUrl(url) {
  if (!url) return null;
  if (typeof url !== "string") return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  try {
    const apiOrigin = new URL(API_BASE_URL).origin;
    const separator = url.startsWith("/") ? "" : "/";
    return `${apiOrigin}${separator}${url}`;
  } catch (e) {
    console.error("Error normalizing image URL:", e);
    return url;
  }
}

function normalizeImagesInResponse(obj) {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeImagesInResponse(item));
  }

  if (typeof obj === "object") {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      if (
        [
          "avatar",
          "main_image",
          "image_2",
          "image_3",
          "seller_avatar",
          "user_avatar",
        ].includes(key)
      ) {
        newObj[key] = normalizeImageUrl(value);
      } else {
        newObj[key] = normalizeImagesInResponse(value);
      }
    }
    return newObj;
  }

  return obj;
}

function getAuthHeaders() {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  return headers;
}

async function apiRequest(endpoint, method = "GET", data = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: getAuthHeaders(),
  };

  if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);

    // Handle 401 Unauthorized - token expired
    if (
      response.status === 401 &&
      !endpoint.includes("login") &&
      !endpoint.includes("refresh")
    ) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry the original request with new token
        options.headers["Authorization"] = `Bearer ${accessToken}`;
        const retryResponse = await fetch(url, options);
        if (retryResponse.ok) {
          return normalizeImagesInResponse(await retryResponse.json());
        }
      }
      // Refresh failed, redirect to login
      clearTokens();
      window.location.href = "index.html";
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.detail || errorData.message || JSON.stringify(errorData);
      } catch (e) {
        // Not JSON response
      }
      throw new Error(errorMessage);
    }

    return normalizeImagesInResponse(await response.json());
  } catch (error) {
    console.error("API Request failed:", error);
    throw error;
  }
}

async function refreshAccessToken() {
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      saveTokens(data.access, refreshToken);
      return true;
    }
  } catch (error) {
    console.error("Token refresh failed:", error);
  }

  return false;
}

async function verifyToken() {
  if (!accessToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}token/verify/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: accessToken }),
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

// ===== AUTHENTICATION =====

async function login(username, password) {
  try {
    console.log(`Attempting login for username: ${username}`);

    const response = await fetch(`${API_BASE_URL}login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      let errorMessage = "Login failed";
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.detail || errorData.message || "Invalid credentials";
      } catch (parseError) {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("Login successful, tokens received");

    saveTokens(data.access, data.refresh);

    // Save user info from login response
    if (data.user) {
      localStorage.setItem("userName", data.user.name || data.user.username);
      localStorage.setItem("userIsProvider", data.user.is_provider || false);
    } else {
      localStorage.setItem("userName", data.username || "User");
      localStorage.setItem("userIsProvider", data.is_service_provider || false);
    }

    return { success: true, user: data.user || { username: data.username, is_provider: data.is_service_provider } };
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

async function signup(username, email, password) {
  try {
    console.log("Signing up user:", { username, email });

    const response = await fetch(`${API_BASE_URL}register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        email: email,
        password: password,
        password2: password,
      }),
    });

    console.log(`Signup response status: ${response.status}`);

    if (!response.ok) {
      let errorMessage = "Registration failed";
      try {
        const errorData = await response.json();
        console.log("Signup error data:", errorData);

        if (errorData.username) {
          errorMessage = `Username: ${errorData.username[0]}`;
        } else if (errorData.email) {
          errorMessage = `Email: ${errorData.email[0]}`;
        } else if (errorData.password) {
          errorMessage = `Password: ${errorData.password[0]}`;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.non_field_errors) {
          errorMessage = errorData.non_field_errors[0];
        }
      } catch (parseError) {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("Signup successful, data received:", data);

    // Save tokens if provided
    if (data.access && data.refresh) {
      saveTokens(data.access, data.refresh);
      localStorage.setItem("userName", username);
      localStorage.setItem("userIsProvider", false);
    }

    return { success: true, user: data.user || data };
  } catch (error) {
    console.error("Signup error:", error);
    throw error;
  }
}

function logout() {
  // No server-side logout endpoint — just clear tokens locally.
  // JWT access tokens expire naturally (60 min); refresh tokens in 1 day.
  clearTokens();
}

// ===== PROFILE FUNCTIONS =====

async function getProfile() {
  try {
    console.log("Fetching profile from API...");

    const response = await fetch(`${API_BASE_URL}profile/`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    console.log("Profile response status:", response.status);

    if (!response.ok) {
      if (response.status === 401) {
        // Token might be expired, try to refresh
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry the request with new token
          return await getProfile();
        } else {
          clearTokens();
          window.location.href = "index.html";
          throw new Error("Session expired. Please login again.");
        }
      }

      if (response.status === 404) {
        console.log("Profile not found - returning empty profile");
        return {
          username: localStorage.getItem("userName") || "User",
          email: "",
          avatar: null,
          bio: "",
          phone: "",
          location: "Kandivali",
          is_service_provider: false,
        };
      }

      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.detail || errorData.message || JSON.stringify(errorData);
      } catch (e) {
        // Not JSON response
      }
      throw new Error(`Failed to fetch profile: ${errorMessage}`);
    }

    const profileData = await response.json();
    console.log("Profile data received:", profileData);

    // Update localStorage with profile data
    if (profileData.username) {
      localStorage.setItem("userName", profileData.username);
    }
    if (profileData.is_service_provider !== undefined) {
      localStorage.setItem("userIsProvider", profileData.is_service_provider);
    }

    return normalizeImagesInResponse(profileData);
  } catch (error) {
    console.error("Error in getProfile:", error);
    throw error;
  }
}

async function updateProfile(profileData) {
  try {
    console.log("Updating profile with data:", profileData);

    let headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    let body;

    // Check if it's FormData (for file upload) or JSON
    if (profileData instanceof FormData) {
      // For FormData, let browser set Content-Type with boundary
      body = profileData;
    } else {
      // For JSON data
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(profileData);
    }

    const response = await fetch(`${API_BASE_URL}profile/`, {
      method: "PUT",
      headers: headers,
      body: body,
    });

    console.log("Update profile response status:", response.status);

    if (!response.ok) {
      let errorMessage = "Failed to update profile";
      try {
        const errorData = await response.json();
        console.log("Update profile error details:", errorData);

        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (typeof errorData === "object") {
          // Try to get first error
          const firstError = Object.values(errorData)[0];
          if (Array.isArray(firstError)) {
            errorMessage = firstError[0];
          } else if (typeof firstError === "string") {
            errorMessage = firstError;
          }
        }
      } catch (parseError) {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    const updatedProfile = await response.json();
    console.log("Profile updated successfully:", updatedProfile);

    // Update localStorage with new data if available
    if (updatedProfile.username) {
      localStorage.setItem("userName", updatedProfile.username);
    }
    if (updatedProfile.is_service_provider !== undefined) {
      localStorage.setItem(
        "userIsProvider",
        updatedProfile.is_service_provider,
      );
    }

    return normalizeImagesInResponse(updatedProfile);
  } catch (error) {
    console.error("Error in updateProfile:", error);
    throw error;
  }
}

async function becomeProvider() {
  try {
    console.log("Converting to service provider...");

    const response = await fetch(`${API_BASE_URL}profile/become-provider/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("Become provider response status:", response.status);

    if (!response.ok) {
      let errorMessage = "Failed to become service provider";
      try {
        const errorData = await response.json();
        console.log("Become provider error details:", errorData);

        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (parseError) {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("Successfully became provider:", result);

    // Update localStorage
    localStorage.setItem("userIsProvider", "true");

    return result;
  } catch (error) {
    console.error("Error in becomeProvider:", error);
    throw error;
  }
}

// ===== SERVICES FUNCTIONS =====

async function getProviders(filters = {}) {
  try {
    // Build query parameters
    const params = new URLSearchParams();

    if (filters.category) {
      params.append("category", filters.category);
    }

    if (filters.location) {
      params.append("location", filters.location);
    }

    if (filters.search) {
      params.append("search", filters.search);
    }

    const queryString = params.toString();
    const url = `providers/${queryString ? `?${queryString}` : ""}`;

    const providers = await apiRequest(url);
    return providers;
  } catch (error) {
    console.error("Error fetching providers:", error);
    throw error;
  }
}

async function getProviderById(id) {
  try {
    const providers = await getProviders();
    const provider = providers.find(p => p.id == id);
    if (!provider) throw new Error("Provider not found");
    console.log("Fetched provider by ID:", provider);
    return provider;
  } catch (error) {
    console.error("Error fetching provider by ID:", error);
    throw error;
  }
}

async function getServices(filters = {}) {
  try {
    // For compatibility with existing code, we'll use getProviders
    return await getProviders(filters);
  } catch (error) {
    console.error("Error fetching services:", error);
    throw error;
  }
}

// Get current user info
async function getCurrentUser() {
  try {
    // Since we have the profile endpoint, we can use that
    const profile = await getProfile();
    return profile;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

/**
 * Create a new booking
 */
async function createBooking(bookingData) {
  console.log("=== CREATE BOOKING API CALL ===");
  console.log("Input data (raw):", bookingData);

  // Using global API_BASE_URL
  const endpoint = `${API_BASE_URL}bookings/create/`;

  console.log("API Endpoint:", endpoint);

  try {
    // Get the accessToken from localStorage
    const token = localStorage.getItem("accessToken");

    console.log(
      "Access Token found:",
      token ? "Yes (length: " + token.length + ")" : "No",
    );

    if (!token) {
      console.error("No access token found in localStorage!");
      throw new Error("Authentication required. Please login first.");
    }

    // Handle provider_id - ensure it's a single value
    let providerIdValue = bookingData.provider_id;

    // If it's an array, take the first value
    if (Array.isArray(providerIdValue)) {
      console.warn("⚠️ WARNING: provider_id is an array. Taking first value.");
      providerIdValue = providerIdValue[0];
    }

    // Convert to number if it's a string
    if (providerIdValue && typeof providerIdValue === "string") {
      const num = parseInt(providerIdValue, 10);
      if (!isNaN(num)) {
        providerIdValue = num;
      }
    }

    // Check if providerIdValue is valid
    if (!providerIdValue || providerIdValue === "") {
      console.error(
        "❌ ERROR: provider_id is empty or invalid:",
        providerIdValue,
      );
      throw new Error("Provider ID is required and must be valid");
    }

    // Format the booking data according to API requirements
    const formattedData = {
      provider_id: providerIdValue,
      service_category: bookingData.service_category || "", // Still send it
      description: bookingData.description || "",
      address: bookingData.address || "",
      scheduled_date: bookingData.scheduled_date,
    };

    console.log("Formatted data being sent:", formattedData);

    // Make sure scheduled_date is in ISO format
    if (formattedData.scheduled_date) {
      const date = new Date(formattedData.scheduled_date);
      if (!isNaN(date.getTime())) {
        formattedData.scheduled_date = date.toISOString();
        console.log("Formatted scheduled_date:", formattedData.scheduled_date);
      } else {
        console.error("Invalid date format:", formattedData.scheduled_date);
        throw new Error("Invalid date format");
      }
    }

    // Validate all required fields are present and not empty
    const requiredFields = [
      "provider_id",
      "service_category",
      "description",
      "address",
      "scheduled_date",
    ];
    const missingFields = [];

    for (const field of requiredFields) {
      if (
        !formattedData[field] ||
        formattedData[field].toString().trim() === ""
      ) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      console.error("❌ Missing required fields:", missingFields);
      throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formattedData),
    });

    console.log("Response status:", response.status);
    console.log("Response status text:", response.statusText);

    let responseData;
    let responseText;

    // Read the response body only ONCE
    try {
      // First try to read as text
      responseText = await response.text();
      console.log(
        "Response text (raw):",
        responseText.substring(0, 200) + "...",
      ); // Log first 200 chars

      // Try to parse as JSON if there's content
      if (
        responseText &&
        responseText.trim() !== "" &&
        !responseText.startsWith("<!DOCTYPE")
      ) {
        responseData = JSON.parse(responseText);
        console.log("Response data (parsed JSON):", responseData);
      } else if (responseText.startsWith("<!DOCTYPE")) {
        // It's an HTML error page
        console.log("Received HTML error page instead of JSON");
        // Try to extract error message from HTML
        const match = responseText.match(
          /<pre class="exception_value">([^<]+)<\/pre>/,
        );
        if (match) {
          responseData = { error: match[1], html: true };
        } else {
          responseData = {
            error: "Server returned HTML error page",
            html: true,
          };
        }
      } else {
        responseData = {};
        console.log("Response body is empty");
      }
    } catch (parseError) {
      console.error("Failed to parse response as JSON:", parseError);
      console.log(
        "Response text (could not parse as JSON):",
        responseText.substring(0, 200) + "...",
      );
      responseData = { text: responseText };
    }

    if (!response.ok) {
      console.error("❌ API Error - Response not OK");
      console.error("Response data:", responseData);

      let errorMessage = "Booking failed";

      // Check for specific database error
      if (response.status === 500) {
        if (
          responseData.error &&
          responseData.error.includes("has no column named service_category")
        ) {
          errorMessage =
            "Backend database error: The service_category field is not yet available in the database. Please contact the administrator to run migrations.";
        } else if (responseData.html) {
          errorMessage =
            "Server error (500). The backend returned an HTML error page.";
        } else {
          errorMessage = "Server error (500). Please try again later.";
        }
      } else if (responseData) {
        let fieldErrors = [];

        // Check for field-specific errors
        if (responseData.provider_id) {
          fieldErrors.push(
            `provider_id: ${Array.isArray(responseData.provider_id)
              ? responseData.provider_id.join(", ")
              : responseData.provider_id
            }`,
          );
        }
        if (responseData.service_category) {
          fieldErrors.push(
            `service_category: ${Array.isArray(responseData.service_category)
              ? responseData.service_category.join(", ")
              : responseData.service_category
            }`,
          );
        }
        if (responseData.description) {
          fieldErrors.push(
            `description: ${Array.isArray(responseData.description)
              ? responseData.description.join(", ")
              : responseData.description
            }`,
          );
        }
        if (responseData.address) {
          fieldErrors.push(
            `address: ${Array.isArray(responseData.address)
              ? responseData.address.join(", ")
              : responseData.address
            }`,
          );
        }
        if (responseData.scheduled_date) {
          fieldErrors.push(
            `scheduled_date: ${Array.isArray(responseData.scheduled_date)
              ? responseData.scheduled_date.join(", ")
              : responseData.scheduled_date
            }`,
          );
        }
        if (responseData.non_field_errors) {
          fieldErrors.push(...responseData.non_field_errors);
        }
        if (responseData.detail) {
          errorMessage = responseData.detail;
        }

        if (fieldErrors.length > 0) {
          errorMessage = fieldErrors.join("; ");
        }
      }

      console.error("API Error details:", errorMessage);

      // Handle specific status codes
      if (response.status === 401 || response.status === 403) {
        // Token expired or invalid
        if (typeof clearTokens === "function") {
          clearTokens();
        } else {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
        }
        alert("Session expired. Please login again.");
        window.location.href = "index.html";
      }

      throw new Error(errorMessage);
    }

    console.log("✅ Booking created successfully:", responseData);
    return responseData;
  } catch (error) {
    console.error("Fetch error in createBooking:", error);
    console.error("Error stack:", error.stack);

    // Handle network errors
    if (
      error.message.includes("NetworkError") ||
      error.message.includes("Failed to fetch")
    ) {
      throw new Error("Network error. Please check your internet connection.");
    }

    throw error;
  }
}

// Make sure the api object includes createBooking
if (typeof window.api === "object") {
  window.api.createBooking = createBooking;
} else {
  window.api = {
    createBooking: createBooking,
    // Add other API functions if they don't exist
    getProviders:
      getProviders ||
      function () {
        console.error("getProviders not implemented");
        return Promise.resolve([]);
      },
    getProviderById:
      getProviderById ||
      function () {
        console.error("getProviderById not implemented");
        return Promise.resolve(null);
      },
    // Add other methods as needed
  };
}

/**
 * Get bookings for the current user
 */
async function getBookings(type = 'user') {
  console.log(`📋 Getting ${type} bookings...`);

  // Using global API_BASE_URL
  const endpoint = `${API_BASE_URL}bookings/?type=${type}`;

  console.log("API Endpoint:", endpoint);

  try {
    // Get the accessToken from localStorage
    const token = localStorage.getItem("accessToken");

    if (!token) {
      console.error("No access token found!");
      throw new Error("Authentication required.");
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("Response status:", response.status);

    let responseData;
    try {
      responseData = await response.json();
      console.log("Response data (JSON):", responseData);
    } catch (e) {
      const text = await response.text();
      console.log("Response text:", text);
      responseData = { text: text };
    }

    if (!response.ok) {
      let errorMessage = "Failed to fetch bookings";

      if (responseData) {
        if (responseData.detail) {
          errorMessage = responseData.detail;
        } else if (responseData.message) {
          errorMessage = responseData.message;
        }
      }

      console.error("API Error details:", errorMessage);
      throw new Error(errorMessage);
    }

    console.log("✅ Bookings fetched successfully");
    return responseData;
  } catch (error) {
    console.error("Fetch error in getBookings:", error);
    throw error;
  }
}

/**
 * Update a booking
 */
async function updateBooking(id, data) {
  console.log(`🔄 Updating booking ${id}...`);
  try {
    return await apiRequest(`bookings/${id}/`, "PATCH", data);
  } catch (error) {
    console.error("Error updating booking:", error);
    throw error;
  }
}

/**
 * Cancel a booking
 */
async function cancelBooking(id) {
  console.log(`❌ Cancelling booking ${id}...`);
  try {
    return await apiRequest(`bookings/${id}/cancel/`, "POST");
  } catch (error) {
    console.error("Error cancelling booking:", error);
    throw error;
  }
}

/**
 * Get reviews for a provider
 * NOTE: This endpoint is AllowAny on the backend — no auth token required.
 */
async function getProviderReviews(providerId) {
  console.log("📊 Getting reviews for provider:", providerId);
  try {
    // Use apiRequest which handles auth header optionally (no token = no header)
    const data = await apiRequest(`providers/${providerId}/reviews/`, "GET");
    console.log("✅ Reviews fetched successfully:", data);
    return data;
  } catch (error) {
    console.error("Fetch error in getProviderReviews:", error);
    throw error;
  }
}

/**
 * Create a new review
 */
async function createReview(reviewData) {
  console.log("✍️ Creating new review:", reviewData);

  // Using global API_BASE_URL
  const endpoint = `${API_BASE_URL}reviews/create/`;

  console.log("API Endpoint:", endpoint);

  try {
    // Get the accessToken from localStorage
    const token = localStorage.getItem("accessToken");

    if (!token) {
      console.error("No access token found!");
      throw new Error("Authentication required.");
    }

    // Validate required fields
    const requiredFields = ["booking", "provider_id", "rating", "comment"];
    const missingFields = [];

    for (const field of requiredFields) {
      if (!reviewData[field] || reviewData[field].toString().trim() === "") {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      console.error("❌ Missing required fields:", missingFields);
      throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
    }

    // Ensure rating is between 1-5
    const rating = parseInt(reviewData.rating);
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(reviewData),
    });

    console.log("Response status:", response.status);
    console.log("Response status text:", response.statusText);

    let responseData;
    let responseText;

    // Read the response body only ONCE - FIX FOR "body stream already read"
    try {
      // First try to read as text
      responseText = await response.text();
      console.log(
        "Response text (first 500 chars):",
        responseText.substring(0, 500),
      );

      // Try to parse as JSON if there's content and doesn't look like HTML
      if (responseText && responseText.trim() !== "") {
        if (
          !responseText.startsWith("<!DOCTYPE") &&
          !responseText.startsWith("<html")
        ) {
          try {
            responseData = JSON.parse(responseText);
            console.log("Response data (parsed JSON):", responseData);
          } catch (parseError) {
            console.error("Failed to parse as JSON:", parseError);
            responseData = { text: responseText };
          }
        } else {
          // It's an HTML error page
          console.log("Received HTML error page instead of JSON");
          // Try to extract error message from HTML
          const match = responseText.match(
            /<pre class="exception_value">([^<]+)<\/pre>/,
          );
          if (match) {
            responseData = { error: match[1], html: true };
          } else {
            responseData = {
              error: "Server returned HTML error page",
              html: true,
            };
          }
        }
      } else {
        responseData = {};
        console.log("Response body is empty");
      }
    } catch (readError) {
      console.error("Failed to read response:", readError);
      throw new Error("Failed to read server response");
    }

    if (!response.ok) {
      console.error("❌ API Error - Response not OK");
      console.error("Response data:", responseData);

      let errorMessage = "Failed to create review";

      // Handle 500 errors specifically
      if (response.status === 500) {
        if (responseData.error) {
          if (responseData.error.includes("has no column")) {
            errorMessage = "Backend database error: " + responseData.error;
          } else {
            errorMessage = "Server error: " + responseData.error;
          }
        } else {
          errorMessage = "Internal server error (500). Please try again later.";
        }
      } else if (responseData) {
        let fieldErrors = [];

        // Check for field-specific errors
        if (responseData.booking) {
          fieldErrors.push(
            `booking: ${Array.isArray(responseData.booking)
              ? responseData.booking.join(", ")
              : responseData.booking
            }`,
          );
        }
        if (responseData.provider_id) {
          fieldErrors.push(
            `provider_id: ${Array.isArray(responseData.provider_id)
              ? responseData.provider_id.join(", ")
              : responseData.provider_id
            }`,
          );
        }
        if (responseData.rating) {
          fieldErrors.push(
            `rating: ${Array.isArray(responseData.rating)
              ? responseData.rating.join(", ")
              : responseData.rating
            }`,
          );
        }
        if (responseData.comment) {
          fieldErrors.push(
            `comment: ${Array.isArray(responseData.comment)
              ? responseData.comment.join(", ")
              : responseData.comment
            }`,
          );
        }
        if (responseData.non_field_errors) {
          fieldErrors.push(...responseData.non_field_errors);
        }
        if (responseData.detail) {
          errorMessage = responseData.detail;
        }

        if (fieldErrors.length > 0) {
          errorMessage = fieldErrors.join("; ");
        }
      }

      console.error("API Error details:", errorMessage);

      // Handle specific status codes
      if (response.status === 401 || response.status === 403) {
        // Token expired or invalid
        if (typeof clearTokens === "function") {
          clearTokens();
        } else {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
        }
        alert("Session expired. Please login again.");
        window.location.href = "index.html";
      }

      throw new Error(errorMessage);
    }

    console.log("✅ Review created successfully:", responseData);
    return responseData;
  } catch (error) {
    console.error("Fetch error in createReview:", error);
    console.error("Error stack:", error.stack);

    // Handle network errors
    if (
      error.message.includes("NetworkError") ||
      error.message.includes("Failed to fetch")
    ) {
      throw new Error("Network error. Please check your internet connection.");
    }

    throw error;
  }
}

/**
 * Get user's bookings for a specific provider
 */
async function getUserBookingsForProvider(providerId) {
  console.log("📋 Getting user bookings for provider:", providerId);

  try {
    // Get all user bookings
    const bookings = await getBookings();

    // Filter bookings for this provider and completed status
    const providerBookings = bookings.filter(
      (booking) =>
        booking.service_provider &&
        (booking.service_provider.id == providerId ||
          booking.service_provider == providerId) &&
        booking.status === "COMPLETED",
    );

    console.log("📦 Filtered bookings for provider:", providerBookings);
    return providerBookings;
  } catch (error) {
    console.error("Error getting user bookings for provider:", error);
    return [];
  }
}

// ===== MARKETPLACE FUNCTIONS =====

/**
 * Get products with filters
 */
async function getProducts(filters = {}) {
  try {
    console.log("Getting products with filters:", filters);

    // Build query parameters
    const params = new URLSearchParams();

    // Add filter parameters based on API documentation
    if (filters.category) params.append("category", filters.category);
    if (filters.condition) params.append("condition", filters.condition);
    if (filters.city) params.append("city", filters.city);
    if (filters.is_sold !== undefined)
      params.append("is_sold", filters.is_sold);
    if (filters.min_price !== undefined)
      params.append("min_price", filters.min_price);
    if (filters.max_price !== undefined)
      params.append("max_price", filters.max_price);
    if (filters.search) params.append("search", filters.search);
    if (filters.ordering) params.append("ordering", filters.ordering);

    const queryString = params.toString();
    const url = `marketplace/${queryString ? `?${queryString}` : ""}`;

    console.log("API URL for getProducts:", url);

    const data = await apiRequest(url, "GET");
    console.log("Products received:", data);
    return data;
  } catch (error) {
    console.error("Error fetching products:", error);
    // Return empty array for UI to handle gracefully
    return [];
  }
}

/**
 * Get a single product by ID
 */
async function getProduct(id) {
  try {
    console.log("Getting product with ID:", id);
    const product = await apiRequest(`marketplace/${id}/`, "GET");
    console.log("Product received:", product);
    return product;
  } catch (error) {
    console.error("Error fetching product:", error);
    throw error;
  }
}

async function createProduct(formData) {
  try {
    console.log("Creating product");

    // Using global API_BASE_URL
    const endpoint = `${API_BASE_URL}marketplace/create/`;

    // Get the accessToken
    const token = localStorage.getItem("accessToken");

    if (!token) {
      throw new Error("Authentication required. Please login first.");
    }

    let finalBody = formData;
    let headers = {
      Authorization: `Bearer ${token}`,
    };

    if (formData instanceof FormData) {
      finalBody = formData;
      // Log FormData for debugging
      console.log("FormData entries:");
      for (let pair of formData.entries()) {
        console.log(pair[0] + ": ", pair[1]);
      }
    } else {
      // JSON body
      headers["Content-Type"] = "application/json";
      finalBody = JSON.stringify(formData);
      console.log("JSON Body:", finalBody);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: finalBody,
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error("API error response:", errorData);
      } catch (e) {
        const text = await response.text();
        errorData = { text: text };
      }

      let errorMessage = "Failed to create product";
      if (errorData) {
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (typeof errorData === "object") {
          // Get all error messages
          const errors = [];
          for (const [field, messages] of Object.entries(errorData)) {
            if (Array.isArray(messages)) {
              errors.push(`${field}: ${messages.join(", ")}`);
            } else if (typeof messages === "string") {
              errors.push(`${field}: ${messages}`);
            }
          }
          if (errors.length > 0) {
            errorMessage = errors.join("; ");
          }
        }
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("Product created successfully:", result);
    return normalizeImagesInResponse(result);
  } catch (error) {
    console.error("Error creating product:", error);
    throw error;
  }
}

/**
 * Update a product
 */
async function updateProduct(id, formData) {
  try {
    console.log("Updating product", id);

    // Using global API_BASE_URL
    const endpoint = `${API_BASE_URL}marketplace/${id}/`;

    // Get the accessToken
    const token = localStorage.getItem("accessToken");

    if (!token) {
      throw new Error("Authentication required. Please login first.");
    }

    let finalBody = formData;
    let headers = {
      Authorization: `Bearer ${token}`,
    };

    if (formData instanceof FormData) {
      finalBody = formData;
      // Log FormData for debugging
      console.log("FormData entries for update:");
      for (let pair of formData.entries()) {
        console.log(pair[0] + ": ", pair[1]);
      }
    } else {
      // JSON body
      headers["Content-Type"] = "application/json";
      finalBody = JSON.stringify(formData);
      console.log("JSON Body:", finalBody);
    }

    const response = await fetch(endpoint, {
      method: "PUT",
      headers: headers,
      body: finalBody,
    });

    console.log("Update response status:", response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error("API error response:", errorData);
      } catch (e) {
        const text = await response.text();
        errorData = { text: text };
      }

      throw new Error(errorData.detail || "Failed to update product");
    }

    const result = await response.json();
    console.log("Product updated successfully:", result);
    return normalizeImagesInResponse(result);
  } catch (error) {
    console.error("Error updating product:", error);
    throw error;
  }
}

/**
 * Delete (deactivate) a product
 */
async function deleteProduct(id) {
  try {
    console.log("Deleting product", id);
    return await apiRequest(`marketplace/${id}/`, "DELETE");
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
}

/**
 * Get product comments
 */
async function getProductComments(productId) {
  try {
    console.log("Getting comments for product:", productId);
    const comments = await apiRequest(
      `marketplace/${productId}/comments/`,
      "GET",
    );
    console.log("Comments received:", comments);
    return comments;
  } catch (error) {
    console.error("Error fetching product comments:", error);
    return [];
  }
}

/**
 * Create a comment
 */
async function createComment(commentData) {
  try {
    console.log("Creating comment:", commentData);
    const comment = await apiRequest(
      `marketplace/comments/create/`,
      "POST",
      commentData,
    );
    console.log("Comment created:", comment);
    return comment;
  } catch (error) {
    console.error("Error creating comment:", error);
    throw error;
  }
}

/**
 * Delete a comment
 */
async function deleteComment(commentId) {
  try {
    console.log("Deleting comment:", commentId);
    return await apiRequest(
      `marketplace/comments/${commentId}/delete/`,
      "DELETE",
    );
  } catch (error) {
    console.error("Error deleting comment:", error);
    throw error;
  }
}

/**
 * Get current user's products
 */
async function getMyProducts() {
  try {
    console.log("Getting user products");
    const products = await apiRequest(`marketplace/my-products/`, "GET");
    console.log("User products received:", products);
    return products;
  } catch (error) {
    console.error("Error fetching user products:", error);
    return [];
  }
}

/**
 * Get comments on user's products
 */
async function getMyProductComments() {
  try {
    console.log("Getting user product comments");
    const comments = await apiRequest(
      `marketplace/my-product-comments/`,
      "GET",
    );
    console.log("User product comments received:", comments);
    return comments;
  } catch (error) {
    console.error("Error fetching user product comments:", error);
    return [];
  }
}

// ===== COMMENT REPLIES =====

/**
 * Get replies for a product comment
 * Backend: GET /marketplace/comment-replies/?comment_id=<id> (AllowAny)
 */
async function getCommentReplies(commentId) {
  try {
    console.log("Getting replies for comment:", commentId);
    const data = await apiRequest(`marketplace/comment-replies/?comment_id=${commentId}`, "GET");
    console.log("Comment replies received:", data);
    return data;
  } catch (error) {
    console.error("Error fetching comment replies:", error);
    return [];
  }
}

/**
 * Create a reply to a product comment (only product seller can reply)
 * Backend: POST /marketplace/comment-replies/ { comment_id, reply }
 */
async function createCommentReply(commentId, replyText) {
  try {
    console.log("Creating reply for comment:", commentId);
    const data = await apiRequest(`marketplace/comment-replies/`, "POST", {
      comment_id: commentId,
      reply: replyText,
    });
    console.log("Comment reply created:", data);
    return data;
  } catch (error) {
    console.error("Error creating comment reply:", error);
    throw error;
  }
}

// ===== REPORT SYSTEM =====

/**
 * Create a report against a user or service provider
 * Backend: POST /reports/create/ (auth required)
 * Required fields: reported_user (ID), report_type, description
 * Optional: booking (ID), reported_profile_id (profile ID), evidence_image
 */
async function createReport(reportData) {
  try {
    console.log("Creating report:", reportData);
    const data = await apiRequest("reports/create/", "POST", reportData);
    console.log("Report created:", data);
    return data;
  } catch (error) {
    console.error("Error creating report:", error);
    throw error;
  }
}

/**
 * Get reports submitted by the current user
 * Backend: GET /reports/my/ (auth required)
 */
async function getMyReports() {
  try {
    console.log("Getting user reports");
    const data = await apiRequest("reports/my/", "GET");
    console.log("User reports received:", data);
    return data;
  } catch (error) {
    console.error("Error fetching user reports:", error);
    return [];
  }
}

// ===== PASSWORD RESET =====

/**
 * Request a password reset OTP via email
 * @param {string} email - The user's registered email address
 * @returns {Promise<Object>} API response with success message
 */
async function forgotPassword(email) {
  try {
    const response = await fetch(`${API_BASE_URL}forgotpassword/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data.error ||
        data.email?.[0] ||
        data.detail ||
        "Failed to send OTP. Please try again.";
      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    console.error("Forgot password error:", error);
    throw error;
  }
}

/**
 * Reset password using OTP
 * @param {string} email - The user's registered email address
 * @param {string} otp - The OTP received via email
 * @param {string} newPassword - The new password
 * @param {string} confirmNewPassword - Confirm the new password
 * @returns {Promise<Object>} API response with success message
 */
async function resetPassword(email, otp, newPassword, confirmNewPassword) {
  try {
    const response = await fetch(`${API_BASE_URL}reset/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        otp,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data.error ||
        data.otp?.[0] ||
        data.new_password?.[0] ||
        data.detail ||
        "Password reset failed. Please try again.";
      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    console.error("Reset password error:", error);
    throw error;
  }
}

// ===== EXPORT API FUNCTIONS =====

window.api = {
  // Authentication
  login,
  signup,
  logout,
  isAuthenticated,
  verifyToken,
  forgotPassword,
  resetPassword,

  // Token management
  saveTokens,
  clearTokens,
  getAuthHeaders,

  // Profile
  getProfile,
  updateProfile,
  becomeProvider,

  // Services/Providers
  getServices,
  getProviders,
  getProviderById,
  getCurrentUser,

  // Bookings
  createBooking,
  getBookings,
  updateBooking,
  cancelBooking,

  // Reviews
  getProviderReviews,
  createReview,
  getUserBookingsForProvider,

  // Marketplace functions
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductComments,
  createComment,
  deleteComment,
  getMyProducts,
  getMyProductComments,

  // Comment replies
  getCommentReplies,
  createCommentReply,

  // Reports
  createReport,
  getMyReports,

  // Core API function
  apiRequest,
};
