/**
 * Dashboard JS - Consolidated activity manager
 */

let currentUser = null;

document.addEventListener("DOMContentLoaded", async function () {
  if (typeof api !== 'undefined' && !api.isAuthenticated()) {
    const pageBody = document.querySelector(".page-body");
    if (pageBody) {
      pageBody.innerHTML = `
        <div class="empty-state" style="margin-top: 4rem;">
          <i class="fas fa-lock" style="font-size: 4rem; color: var(--primary); opacity: 0.8; margin-bottom: var(--space-4);"></i>
          <h3>Login Required</h3>
          <p>Please log in to view your dashboard, bookings, and active listings.</p>
          <a href="login.html" class="btn btn-primary mt-4" style="padding: var(--space-3) var(--space-6);">
            <i class="fas fa-sign-in-alt"></i> Login
          </a>
        </div>
      `;
    }
    return;
  }

  // Bind close buttons for modals
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      this.closest('.modal-overlay').classList.remove('active');
    });
  });

  // Bind filters
  const bookingFilter = document.getElementById("bookingStatusFilter");
  if (bookingFilter) bookingFilter.addEventListener("change", loadMyBookings);
  
  const requestFilter = document.getElementById("requestStatusFilter");
  if (requestFilter) requestFilter.addEventListener("change", loadServiceRequests);

  // Forms
  document.getElementById("notesForm")?.addEventListener("submit", handleNotesSubmit);
  document.getElementById("completeJobForm")?.addEventListener("submit", handleCompleteJobSubmit);
  document.getElementById("editProductForm")?.addEventListener("submit", handleEditProductSubmit);
  document.getElementById("replyCommentForm")?.addEventListener("submit", handleDashboardReplySubmit);

  try {
    currentUser = await api.getCurrentUser();
    
    // If user is a service provider, show the "Service Requests" tab
    if (currentUser.is_service_provider) {
      document.getElementById("tab-requests-btn").style.display = "inline-block";
    }
    
    // Initial load
    loadMyBookings();
    if (currentUser.is_service_provider) {
      loadServiceRequests();
    }
    loadMyListings();
    loadMyProductComments();
    loadMyReports();
    
  } catch (error) {
    console.error("Failed to load user profile:", error);
  }
});

// Helper for status badge class
function getStatusClass(status) {
  switch(status) {
    case 'PENDING': return 'status-pending';
    case 'ACCEPTED': return 'status-accepted';
    case 'IN_PROGRESS': return 'status-in-progress';
    case 'COMPLETED': return 'status-completed';
    case 'CANCELLED': return 'status-cancelled';
    case 'REJECTED': return 'status-rejected';
    default: return 'status-pending';
  }
}

// Helper for status formatting
function formatStatus(status) {
  return status ? status.replace('_', ' ') : 'UNKNOWN';
}

/* ========================================================
   TAB 1: My Bookings (Services I requested)
   ======================================================== */
async function loadMyBookings() {
  const container = document.getElementById("bookingsList");
  const filter = document.getElementById("bookingStatusFilter")?.value;
  
  try {
    const bookings = await api.getBookings('user');
    
    // Filter locally if dropdown selected
    const filtered = filter ? bookings.filter(b => b.status === filter) : bookings;
    
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-calendar-times"></i>
          <h3>No bookings found</h3>
          <p>You haven't requested any services yet.</p>
          <a href="services.html" class="btn btn-primary mt-3">Find Services</a>
        </div>
      `;
      return;
    }
    
    container.innerHTML = filtered.map(booking => `
      <div class="list-item">
        <div class="list-item-main">
          <div class="list-item-title">
            ${booking.service_category} 
            <span class="status-badge ${getStatusClass(booking.status)}">${formatStatus(booking.status)}</span>
          </div>
          <div class="list-item-meta">
            <span><i class="fas fa-user-tie"></i> Provider: ${booking.provider_name}</span>
            <span><i class="fas fa-calendar-alt"></i> Scheduled: ${formatDate(booking.scheduled_date)}</span>
            <span><i class="fas fa-rupee-sign"></i> ${booking.final_price || booking.agreed_price || 'TBD'}</span>
          </div>
          ${booking.user_notes ? `<div class="mt-2 text-sm text-secondary"><strong>My Notes:</strong> ${booking.user_notes}</div>` : ''}
          ${booking.provider_notes ? `<div class="mt-1 text-sm text-primary"><strong>Provider Notes:</strong> ${booking.provider_notes}</div>` : ''}
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary btn-sm" onclick="openNotesModal(${booking.id}, 'user', '${(booking.user_notes || '').replace(/'/g, "\\'")}')">
            <i class="fas fa-edit"></i> Notes
          </button>
          ${['PENDING', 'ACCEPTED'].includes(booking.status) ? `
            <button class="btn btn-danger btn-sm" onclick="cancelBooking(${booking.id})">
              <i class="fas fa-times"></i> Cancel
            </button>
          ` : ''}
          ${booking.status === 'COMPLETED' ? `
            <a href="service-detail.html?id=${booking.provider_id}" class="btn btn-outline btn-sm">
              <i class="fas fa-star"></i> Review
            </a>
          ` : ''}
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    container.innerHTML = '<div class="text-danger p-4">Failed to load bookings.</div>';
    console.error(error);
  }
}

async function cancelBooking(id) {
  if (!confirm("Are you sure you want to cancel this booking?")) return;
  try {
    await api.cancelBooking(id);
    showToast("Booking cancelled", "success");
    loadMyBookings();
  } catch (error) {
    showToast(error.message, "error");
  }
}

/* ========================================================
   TAB 2: Service Requests (Jobs I provide)
   ======================================================== */
async function loadServiceRequests() {
  const container = document.getElementById("requestsList");
  if (!container) return; // Means tab isn't active/rendered

  const filter = document.getElementById("requestStatusFilter")?.value;
  
  try {
    const requests = await api.getBookings('provider');
    
    const filtered = filter ? requests.filter(r => r.status === filter) : requests;
    
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <h3>No requests found</h3>
          <p>You don't have any job requests matching the criteria.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = filtered.map(req => `
      <div class="list-item">
        <div class="list-item-main">
          <div class="list-item-title">
            ${req.service_category}
            <span class="status-badge ${getStatusClass(req.status)}">${formatStatus(req.status)}</span>
          </div>
          <div class="list-item-meta">
            <span><i class="fas fa-user"></i> Client: ${req.user_name}</span>
            <span><i class="fas fa-calendar-alt"></i> ${formatDate(req.scheduled_date)}</span>
            <span><i class="fas fa-map-marker-alt"></i> ${req.address}</span>
          </div>
          <div class="mt-2 text-sm text-secondary">
            <strong>Job Description:</strong> ${req.description}
          </div>
          ${req.user_notes ? `<div class="mt-1 text-sm text-secondary"><strong>Client Notes:</strong> ${req.user_notes}</div>` : ''}
          ${req.provider_notes ? `<div class="mt-1 text-sm text-primary"><strong>My Notes:</strong> ${req.provider_notes}</div>` : ''}
        </div>
        
        <div class="list-item-actions flex-col gap-2" style="min-width: 130px;">
          ${req.status === 'PENDING' ? `
            <button class="btn btn-success btn-sm btn-block" onclick="updateBookingStatus(${req.id}, 'ACCEPTED')">Accept</button>
            <button class="btn btn-danger btn-sm btn-block" onclick="updateBookingStatus(${req.id}, 'REJECTED')">Reject</button>
          ` : ''}
          
          ${req.status === 'ACCEPTED' ? `
            <button class="btn btn-primary btn-sm btn-block" onclick="updateBookingStatus(${req.id}, 'IN_PROGRESS')">Start Job</button>
          ` : ''}
          
          ${req.status === 'IN_PROGRESS' ? `
            <button class="btn btn-success btn-sm btn-block" onclick="openCompleteJobModal(${req.id}, ${req.agreed_price || 0})">Complete Job</button>
          ` : ''}
          
          <button class="btn btn-secondary btn-sm btn-block" onclick="openNotesModal(${req.id}, 'provider', '${(req.provider_notes || '').replace(/'/g, "\\'")}')">
            <i class="fas fa-edit"></i> Notes
          </button>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    container.innerHTML = '<div class="text-danger p-4">Failed to load requests.</div>';
    console.error(error);
  }
}

async function updateBookingStatus(id, newStatus) {
  try {
    await api.updateBooking(id, { status: newStatus });
    showToast(`Job marked as ${newStatus}`, "success");
    loadServiceRequests();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function openCompleteJobModal(id, currentPrice) {
  document.getElementById("completeBookingId").value = id;
  document.getElementById("finalPrice").value = currentPrice || 0;
  openModal("completeJobModal");
}

async function handleCompleteJobSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("completeBookingId").value;
  const finalPrice = document.getElementById("finalPrice").value;
  
  try {
    await api.updateBooking(id, {
      status: 'COMPLETED',
      final_price: finalPrice
    });
    closeModal("completeJobModal");
    showToast("Job completed successfully!", "success");
    loadServiceRequests();
  } catch (error) {
    showToast(error.message, "error");
  }
}


/* ========================================================
   TAB 3: Marketplace Listings
   ======================================================== */
async function loadMyListings() {
  const container = document.getElementById("listingsList");
  
  try {
    const products = await api.getMyProducts();
    
    if (products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-box-open"></i>
          <h3>No items listed</h3>
          <p>You aren't selling anything right now.</p>
          <a href="mart.html" class="btn btn-primary mt-3">Start Selling</a>
        </div>
      `;
      return;
    }
    
    container.innerHTML = products.map(product => `
      <div class="list-item ${!product.is_active ? 'opacity-50' : ''}">
        <div style="width: 60px; height: 60px; border-radius: var(--radius); overflow: hidden; flex-shrink: 0; background: var(--bg-alt);">
          <img src="${product.main_image || 'https://placehold.co/60x60'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://placehold.co/60x60'">
        </div>
        <div class="list-item-main">
          <div class="list-item-title">
            ${product.title}
            ${product.is_sold ? '<span class="status-badge status-cancelled">Sold</span>' : '<span class="status-badge status-accepted">Active</span>'}
          </div>
          <div class="list-item-meta">
            <span><i class="fas fa-rupee-sign"></i> ${product.price}</span>
            <span><i class="fas fa-eye"></i> ${product.views} views</span>
            <span><i class="fas fa-comment"></i> ${product.comment_count || 0} comments</span>
          </div>
        </div>
        <div class="list-item-actions">
          <a href="product-detail.html?id=${product.id}" class="btn btn-secondary btn-sm"><i class="fas fa-external-link-alt"></i> View</a>
          ${product.is_active ? `
            <button class="btn btn-outline btn-sm" onclick='openEditProductModal(${JSON.stringify(product)})'><i class="fas fa-edit"></i> Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deactivateProduct(${product.id})"><i class="fas fa-trash"></i> Delete</button>
          ` : '<span class="text-xs text-muted">Deleted</span>'}
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    container.innerHTML = '<div class="text-danger p-4">Failed to load listings.</div>';
    console.error(error);
  }
}

async function deactivateProduct(id) {
  if (!confirm("Are you sure you want to delete this listing?")) return;
  try {
    await api.deleteProduct(id);
    showToast("Listing deleted", "success");
    loadMyListings();
  } catch (error) {
    showToast(error.message, "error");
  }
}

/* ========================================================
   Edit Product
   ======================================================== */
function openEditProductModal(product) {
  document.getElementById("editProductId").value = product.id;
  document.getElementById("editTitle").value = product.title || '';
  document.getElementById("editPrice").value = product.price || '';
  document.getElementById("editCondition").value = product.condition || 'GOOD';
  document.getElementById("editDescription").value = product.description || '';
  document.getElementById("editCity").value = product.city || '';
  document.getElementById("editAddress").value = product.address || '';
  openModal("editProductModal");
}

async function handleEditProductSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("saveEditProductBtn");
  const originalHTML = btn.innerHTML;
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    const id = document.getElementById("editProductId").value;
    const formData = new FormData();
    formData.append("title", document.getElementById("editTitle").value);
    formData.append("price", document.getElementById("editPrice").value);
    formData.append("condition", document.getElementById("editCondition").value);
    formData.append("description", document.getElementById("editDescription").value);
    formData.append("city", document.getElementById("editCity").value);
    formData.append("address", document.getElementById("editAddress").value);
    await api.updateProduct(id, formData);
    closeModal("editProductModal");
    showToast("Listing updated successfully!", "success");
    loadMyListings();
  } catch (error) {
    showToast(error.message || "Failed to update listing.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

/* ========================================================
   Common Modals
   ======================================================== */
function openNotesModal(bookingId, type, currentNotes) {
  document.getElementById("notesBookingId").value = bookingId;
  document.getElementById("notesUserType").value = type;
  document.getElementById("notesText").value = currentNotes === 'null' ? '' : currentNotes;
  openModal("notesModal");
}

async function handleNotesSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("notesBookingId").value;
  const type = document.getElementById("notesUserType").value;
  const notes = document.getElementById("notesText").value;
  
  try {
    const payload = {};
    if (type === 'user') {
      payload.user_notes = notes;
    } else {
      payload.provider_notes = notes;
    }
    
    await api.updateBooking(id, payload);
    closeModal("notesModal");
    showToast("Notes updated", "success");
    
    if (type === 'user') loadMyBookings();
    else loadServiceRequests();
    
  } catch (error) {
    showToast(error.message, "error");
  }
}

/* ========================================================
   TAB: Comments Inbox (questions on my products)
   ======================================================== */
async function loadMyProductComments() {
  const container = document.getElementById("commentsList");
  if (!container) return;

  try {
    const comments = await api.getMyProductComments();

    if (!comments || comments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-comment-slash"></i>
          <h3>No questions yet</h3>
          <p>Buyers haven't asked any questions on your listings.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = comments.map(comment => `
      <div class="list-item">
        <div class="list-item-main">
          <div class="list-item-title">
            <i class="fas fa-question-circle text-primary"></i>
            <a href="product-detail.html?id=${comment.product}" class="text-primary" style="text-decoration:none;">Product #${comment.product}</a>
          </div>
          <div class="list-item-meta">
            <span><i class="fas fa-user"></i> ${comment.user_name}</span>
            <span><i class="fas fa-clock"></i> ${formatDate(comment.created_at)}</span>
          </div>
          <div class="mt-2 text-sm text-secondary" style="font-style:italic;">
            "${comment.comment}"
          </div>
        </div>
        <div class="list-item-actions">
          <a href="product-detail.html?id=${comment.product}" class="btn btn-secondary btn-sm">
            <i class="fas fa-external-link-alt"></i> View
          </a>
          <button class="btn btn-primary btn-sm" onclick="openDashboardReplyModal(${comment.id}, '${(comment.comment || '').replace(/'/g, "\\'")}')">
            <i class="fas fa-reply"></i> Reply
          </button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    container.innerHTML = '<div class="text-danger p-4">Failed to load comments.</div>';
    console.error(error);
  }
}

function openDashboardReplyModal(commentId, questionText) {
  document.getElementById("replyCommentId").value = commentId;
  document.getElementById("replyQuestionText").textContent = questionText;
  document.getElementById("replyText").value = '';
  openModal("replyCommentModal");
}

async function handleDashboardReplySubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("submitReplyBtn");
  const originalHTML = btn.innerHTML;
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    const commentId = document.getElementById("replyCommentId").value;
    const replyText = document.getElementById("replyText").value.trim();
    if (!replyText) throw new Error("Reply cannot be empty.");
    await api.createCommentReply(commentId, replyText);
    closeModal("replyCommentModal");
    showToast("Reply sent!", "success");
    loadMyProductComments();
  } catch (error) {
    showToast(error.message || "Failed to send reply.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

/* ========================================================
   TAB: My Reports
   ======================================================== */
async function loadMyReports() {
  const container = document.getElementById("reportsList");
  if (!container) return;

  const REPORT_TYPE_LABELS = {
    FRAUD: 'Fraud / Scam',
    BAD_SERVICE: 'Poor Service',
    UNPROFESSIONAL: 'Unprofessional',
    HARASSMENT: 'Harassment',
    SAFETY: 'Safety Concern',
    OTHER: 'Other'
  };

  const STATUS_CLASSES = {
    PENDING: 'status-pending',
    REVIEWED: 'status-accepted',
    RESOLVED: 'status-completed',
    DISMISSED: 'status-rejected'
  };

  try {
    const reports = await api.getMyReports();

    if (!reports || reports.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-flag"></i>
          <h3>No reports submitted</h3>
          <p>You haven't submitted any reports yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = reports.map(report => `
      <div class="list-item">
        <div class="list-item-main">
          <div class="list-item-title">
            <i class="fas fa-flag text-danger"></i>
            ${REPORT_TYPE_LABELS[report.report_type] || report.report_type}
            <span class="status-badge ${STATUS_CLASSES[report.status] || 'status-pending'}">${report.status || 'PENDING'}</span>
          </div>
          <div class="list-item-meta">
            <span><i class="fas fa-user"></i> Reported: ${report.reported_user_name || 'Unknown'}</span>
            <span><i class="fas fa-clock"></i> ${formatDate(report.created_at)}</span>
          </div>
          <div class="mt-2 text-sm text-secondary">${report.description}</div>
        </div>
      </div>
    `).join('');

  } catch (error) {
    container.innerHTML = '<div class="text-danger p-4">Failed to load reports.</div>';
    console.error(error);
  }
}
