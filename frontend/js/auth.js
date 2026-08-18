/**
 * Authentication page functionality
 * Handles login and signup pages
 */

document.addEventListener("DOMContentLoaded", function () {
  // Check if we're on login page
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    initLoginForm();
  }

  // Check if we're on signup page
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    initSignupForm();
  }

  // Initialize forgot password modal (on login page)
  const fpModal = document.getElementById("forgotPasswordModal");
  if (fpModal) {
    initForgotPasswordModal();
  }

  // Auto-fill demo accounts if URL has demo parameter
  const urlParams = new URLSearchParams(window.location.search);
  const demo = urlParams.get("demo");

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  if (demo === "provider") {
    if (usernameInput) usernameInput.value = "provider";
    if (passwordInput) passwordInput.value = "password123";
  } else if (demo === "client") {
    if (usernameInput) usernameInput.value = "client";
    if (passwordInput) passwordInput.value = "password123";
  }
});

/**
 * Initialize login form
 */
function initLoginForm() {
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    // Basic validation
    if (!username || !password) {
      showToast("Please fill in all fields", "error");
      return;
    }

    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Logging in...';

    try {
      // Call API login
      const result = await api.login(username, password);

      showToast("Login successful! Redirecting...", "success");

      // Redirect to services page after delay
      setTimeout(() => {
        window.location.href = "services.html";
      }, 1500);
    } catch (error) {
      console.error("Login error:", error);
      showToast(
        error.message || "Login failed. Please check your credentials.",
        "error"
      );

      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

/**
 * Initialize signup form
 */
function initSignupForm() {
  const form = document.getElementById("signupForm");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const terms = document.getElementById("terms").checked;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    if (password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    if (password.length < 6) {
      showToast(
        "Password must be at least 6 characters",
        "error"
      );
      return;
    }

    if (!terms) {
      showToast(
        "Please accept the terms and conditions",
        "error"
      );
      return;
    }

    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Creating Account...';

    try {
      // Call API signup with only required fields
      const result = await api.signup(username, email, password);

      showToast("Account created successfully!", "success");

      // Redirect to services page after delay
      setTimeout(() => {
        window.location.href = "services.html";
      }, 1500);
    } catch (error) {
      console.error("Signup error:", error);

      // Handle specific error messages
      let errorMessage = error.message || "Signup failed. Please try again.";

      if (error.message.includes("username")) {
        errorMessage = "Username already exists. Please choose another.";
      } else if (error.message.includes("email")) {
        errorMessage =
          "Email already registered. Please use another email or login.";
      } else if (error.message.includes("password")) {
        errorMessage =
          "Password requirements not met. Please use a stronger password.";
      }

      showToast(errorMessage, "error");

      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

/**
 * Initialize forgot password modal
 * Two-step flow: Step 1 = enter email (request OTP), Step 2 = enter OTP + new password
 */
function initForgotPasswordModal() {
  const modal = document.getElementById("forgotPasswordModal");
  const closeBtn = document.getElementById("fpCloseBtn");
  const step1 = document.getElementById("fpStep1");
  const step2 = document.getElementById("fpStep2");
  const emailForm = document.getElementById("fpEmailForm");
  const resetForm = document.getElementById("fpResetForm");
  const backBtn = document.getElementById("fpBackToStep1");
  const modalTitle = document.getElementById("fpModalTitle");
  const modalSubtitle = document.getElementById("fpModalSubtitle");

  // Track the email used in Step 1 so Step 2 can reuse it
  let forgotEmail = "";

  // --- Helper: show message in a step ---
  function showMsg(stepId, message, type) {
    const msgEl = document.getElementById(stepId);
    if (!msgEl) return;
    msgEl.textContent = message;
    msgEl.className = "fp-msg " + type; // 'success' or 'error'
  }

  function clearMsg(stepId) {
    const msgEl = document.getElementById(stepId);
    if (!msgEl) return;
    msgEl.textContent = "";
    msgEl.className = "fp-msg";
  }

  // --- Helper: reset modal to initial state ---
  function resetModal() {
    step1.classList.add("active");
    step2.classList.remove("active");
    modalTitle.textContent = "Reset Password";
    modalSubtitle.textContent = "Enter your email to receive a reset OTP";
    clearMsg("fpStep1Msg");
    clearMsg("fpStep2Msg");
    emailForm.reset();
    resetForm.reset();
    forgotEmail = "";
    // Re-enable buttons
    const emailBtn = document.getElementById("fpEmailBtn");
    const resetBtn = document.getElementById("fpResetBtn");
    if (emailBtn) {
      emailBtn.disabled = false;
      emailBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP';
    }
    if (resetBtn) {
      resetBtn.disabled = false;
      resetBtn.innerHTML = '<i class="fas fa-lock"></i> Reset Password';
    }
  }

  // --- Close modal ---
  function closeModal() {
    modal.classList.remove("active");
    resetModal();
  }

  closeBtn.addEventListener("click", closeModal);

  // Close on overlay click
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeModal();
  });

  // Close on Escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      closeModal();
    }
  });

  // --- Step 1: Email submission ---
  emailForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearMsg("fpStep1Msg");

    const email = document.getElementById("fpEmail").value.trim();
    if (!email) {
      showMsg("fpStep1Msg", "Please enter your email address.", "error");
      return;
    }

    const btn = document.getElementById("fpEmailBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
      await api.forgotPassword(email);
      forgotEmail = email;

      showMsg("fpStep1Msg", "OTP sent to your email! Check your inbox.", "success");

      // Move to Step 2 after a short delay
      setTimeout(() => {
        step1.classList.remove("active");
        step2.classList.add("active");
        modalTitle.textContent = "Enter OTP";
        modalSubtitle.textContent = "Enter the code sent to " + email;
        clearMsg("fpStep2Msg");
      }, 1200);
    } catch (error) {
      showMsg("fpStep1Msg", error.message || "Failed to send OTP.", "error");
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP';
    }
  });

  // --- Step 2: OTP + Password reset ---
  resetForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearMsg("fpStep2Msg");

    const otp = document.getElementById("fpOtp").value.trim();
    const newPassword = document.getElementById("fpNewPassword").value;
    const confirmPassword = document.getElementById("fpConfirmPassword").value;

    // Validation
    if (!otp) {
      showMsg("fpStep2Msg", "Please enter the OTP.", "error");
      return;
    }

    if (!newPassword || !confirmPassword) {
      showMsg("fpStep2Msg", "Please fill in both password fields.", "error");
      return;
    }

    if (newPassword.length < 8) {
      showMsg("fpStep2Msg", "Password must be at least 8 characters.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showMsg("fpStep2Msg", "Passwords do not match.", "error");
      return;
    }

    const btn = document.getElementById("fpResetBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';

    try {
      await api.resetPassword(forgotEmail, otp, newPassword, confirmPassword);

      showMsg("fpStep2Msg", "Password reset successful! You can now log in.", "success");

      // Close modal and show login notification after a delay
      setTimeout(() => {
        closeModal();
        if (typeof showToast !== "undefined") {
          showToast("Password reset successful! Please log in with your new password.", "success");
        }
      }, 2000);
    } catch (error) {
      showMsg("fpStep2Msg", error.message || "Password reset failed.", "error");
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-lock"></i> Reset Password';
    }
  });

  // --- Back to Step 1 ---
  backBtn.addEventListener("click", function () {
    step2.classList.remove("active");
    step1.classList.add("active");
    modalTitle.textContent = "Reset Password";
    modalSubtitle.textContent = "Enter your email to receive a reset OTP";
    clearMsg("fpStep2Msg");

    // Re-enable the email button
    const emailBtn = document.getElementById("fpEmailBtn");
    if (emailBtn) {
      emailBtn.disabled = false;
      emailBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP';
    }
  });
}
