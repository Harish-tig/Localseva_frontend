/**
 * Main JavaScript - Core Application Functionality
 * Handles theme toggle, sidebar, notifications, and common utilities
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebar();
  initTabs();
  initLogout();
  checkAuth();
});

/* ===== Theme Management ===== */
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(themeToggle, savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(themeToggle, newTheme);
  });
}

function updateThemeIcon(btn, theme) {
  btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

/* ===== Sidebar Management ===== */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const closeSidebarBtn = document.getElementById('closeSidebar');
  const bottomNav = document.querySelector('.bottom-nav');

  function syncNavState() {
    if (!sidebar || !bottomNav) return;
    const isDesktop = window.innerWidth > 768;
    if (isDesktop) {
      const isSidebarOpen = !sidebar.classList.contains('closed');
      if (isSidebarOpen) bottomNav.classList.add('hidden');
      else bottomNav.classList.remove('hidden');
    } else {
      const isSidebarOpen = sidebar.classList.contains('open');
      if (isSidebarOpen) bottomNav.classList.add('hidden');
      else bottomNav.classList.remove('hidden');
    }
  }

  // Initial sync and handle resize
  syncNavState();
  window.addEventListener('resize', syncNavState);

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.innerWidth > 768) {
        sidebar.classList.toggle('closed');
      } else {
        sidebar.classList.add('open');
      }
      syncNavState();
    });
  }

  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', () => {
      if (window.innerWidth > 768) sidebar.classList.add('closed');
      else sidebar.classList.remove('open');
      syncNavState();
    });
  }

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && mobileMenuBtn && !mobileMenuBtn.contains(e.target)) {
        sidebar.classList.remove('open');
        syncNavState();
      }
    }
  });

  // Highlight active link in both sidebar and bottom nav
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href && href !== '#' && currentPath.includes(href.replace('.html', ''))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/* ===== Auth Check ===== */
function checkAuth() {
  const token = localStorage.getItem('accessToken');
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const publicPages = ['index.html', 'login.html', 'signup.html', 'services.html', 'mart.html', 'service-detail-guest.html', 'product-detail-guest.html', 'dashboard.html', 'profile.html'];

  if (!publicPages.includes(currentPath) && !token) {
    window.location.href = 'login.html';
    return;
  }

  // Set username in UI
  const userName = token ? (localStorage.getItem('userName') || 'User') : 'Guest';
  document.querySelectorAll('#userName').forEach(el => el.textContent = userName);
}

function initLogout() {
  const token = localStorage.getItem('accessToken');
  const logoutBtns = document.querySelectorAll('.logout-btn');
  logoutBtns.forEach(btn => {
    if (token) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userIsProvider');

        window.location.href = '../index.html';
      });
    } else {
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'login.html';
      });
    }
  });
}

/* ===== Tabs Component ===== */
function initTabs() {
  document.querySelectorAll('.tabs-nav').forEach(nav => {
    const btns = nav.querySelectorAll('.tab-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const container = btn.closest('.tabs-container');

        // Deactivate all
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        container.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        // Activate target
        btn.classList.add('active');
        container.querySelector(targetId).classList.add('active');
      });
    });
  });
}

/* ===== Modals Component ===== */
window.openModal = function (modalId) {
  const token = localStorage.getItem('accessToken');
  const authRequiredModals = ['bookingModal', 'reviewModal', 'addProductModal'];
  if (authRequiredModals.includes(modalId) && !token) {
    window.location.href = 'login.html';
    return;
  }

  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
};

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
};

// Close modals when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', function () {
    this.closest('.modal-overlay').classList.remove('active');
  });
});

/* ===== Toast Notifications ===== */
window.showToast = function (message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'fa-info-circle';
  let title = 'Info';
  if (type === 'success') { icon = 'fa-check-circle'; title = 'Success'; }
  if (type === 'error') { icon = 'fa-exclamation-circle'; title = 'Error'; }
  if (type === 'warning') { icon = 'fa-exclamation-triangle'; title = 'Warning'; }

  toast.innerHTML = `
    <i class="fas ${icon} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close"><i class="fas fa-times"></i></button>
  `;

  container.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);

  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  });

  // Auto remove
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
};

/* ===== Format Utilities ===== */
window.formatCurrency = function (amount) {
  if (amount === null || amount === undefined) return '₹0';
  const num = parseFloat(amount);
  if (isNaN(num)) return '₹0';
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

window.formatDate = function (dateString) {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};
