/**
 * Product Detail Page - LocalSeva Marketplace
 * Handles loading product details and comments
 */

let currentProductId = null;
let currentProduct = null;
let currentUser = null;

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

document.addEventListener("DOMContentLoaded", async function () {
  // Check auth
  if (typeof api !== 'undefined' && !api.isAuthenticated()) {
    window.location.href = "index.html";
    return;
  }

  // Get product ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  currentProductId = urlParams.get("id");

  if (!currentProductId) {
    showToast("Invalid product ID", "error");
    window.location.href = "mart.html";
    return;
  }
  
  // Get current user to check ownership
  try {
    currentUser = await api.getCurrentUser();
  } catch (e) {
    console.error("Could not fetch current user", e);
  }

  // Bind comment form
  const commentForm = document.getElementById("commentForm");
  if (commentForm) {
    commentForm.addEventListener("submit", handleCommentSubmit);
  }

  // Load Data
  loadProductDetails();
});

async function loadProductDetails() {
  try {
    const product = await api.getProduct(currentProductId);
    currentProduct = product;
    
    // Update UI
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("productContent").style.display = "block";
    
    // Header
    document.getElementById("productTitle").textContent = product.title;
    document.getElementById("productDate").textContent = formatDate(product.created_at);
    document.getElementById("productViews").textContent = `${product.views || 0} views`;
    
    const statusContainer = document.getElementById("statusBadgeContainer");
    if (product.is_sold) {
      statusContainer.innerHTML = '<span class="badge badge-danger">Sold</span>';
    } else {
      statusContainer.innerHTML = '<span class="badge badge-success">Available</span>';
    }
    
    // Image (with gallery support)
    const mainImg = document.getElementById("productImage");
    if (product.main_image) {
      mainImg.src = product.main_image;
    } else {
      mainImg.src = "https://placehold.co/800x600/e2e8f0/64748b?text=No+Image";
    }
    renderImageGallery(product);
    
    // Details
    document.getElementById("productDescription").textContent = product.description || "No description provided.";
    document.getElementById("productPrice").textContent = formatCurrency(product.price);
    
    const conditionText = product.condition ? product.condition.replace("_", " ") : "Unknown";
    document.getElementById("productCondition").textContent = conditionText;
    document.getElementById("productCategory").textContent = CATEGORY_LABELS[product.category] || product.category || "Other";
    document.getElementById("productLocation").textContent = product.city || "Unknown";
    
    // Address
    const addressEl = document.getElementById("productAddress");
    if (addressEl) {
      addressEl.textContent = product.address || "Not specified";
    }
    
    // Seller Info
    document.getElementById("sellerName").textContent = product.seller_name;
    const rating = product.seller_rating;
    document.getElementById("sellerRating").textContent = rating ? `${parseFloat(rating).toFixed(1)} rating` : "No ratings yet";
    
    // Explicitly display seller email as text
    // The backend provides contact_email as a boolean, so we use product.email
    const sellerEmail = product.email;
    const emailDisplayEl = document.getElementById("sellerEmailDisplay");
    if (emailDisplayEl) {
      if (product.is_sold) {
        emailDisplayEl.textContent = "Contact info hidden (Item Sold)";
      } else {
        emailDisplayEl.textContent = sellerEmail || "No email provided";
      }
    }
    
    // Contact Section (FIXED BUG: Using product payload email instead of fetching authenticated user's profile)
    const contactSection = document.getElementById("contactSection");
    contactSection.innerHTML = ''; // clear
    
    const isOwner = currentUser && currentUser.id === product.seller;
    
    if (isOwner) {
      contactSection.innerHTML = `
        <div class="p-3 bg-primary-subtle text-primary-dark rounded mt-2 text-center text-sm">
          <strong>This is your listing</strong><br>
          You cannot contact yourself.
        </div>
      `;
    } else if (product.is_sold) {
      contactSection.innerHTML = `
        <div class="p-3 bg-gray-100 text-gray-500 rounded mt-2 text-center text-sm">
          <strong>Item Sold</strong><br>
          Contact information is no longer available.
        </div>
      `;
    } else {
      // Build contact buttons
      let contactHtml = '';
      
      if (product.contact_phone) {
        contactHtml += `
          <a href="tel:${product.contact_phone}" class="contact-btn btn-phone">
            <i class="fas fa-phone"></i> ${product.contact_phone}
          </a>
        `;
      }
      
      if (product.contact_whatsapp) {
        // Strip non-numeric
        const waNum = product.contact_whatsapp.replace(/\D/g, '');
        contactHtml += `
          <a href="https://wa.me/${waNum}?text=Hi, I'm interested in your LocalSeva listing: ${encodeURIComponent(product.title)}" target="_blank" class="contact-btn btn-whatsapp">
            <i class="fab fa-whatsapp"></i> WhatsApp
          </a>
        `;
      }
      
      // Fallback/Direct email provided by backend
      const sellerEmailBtn = product.email;
      if (sellerEmailBtn && product.contact_email !== false) {
        contactHtml += `
          <a href="mailto:${sellerEmailBtn}?subject=LocalSeva: ${encodeURIComponent(product.title)}" class="contact-btn btn-email">
            <i class="fas fa-envelope"></i> Email Seller
          </a>
        `;
      }
      
      if (!contactHtml) {
        contactHtml = `
          <div class="p-3 bg-gray-100 text-gray-500 rounded mt-2 text-center text-sm">
            Seller has not provided direct contact details. Please ask a question below.
          </div>
        `;
      }
      
      contactSection.innerHTML = contactHtml;
    }

    // Load Comments
    loadComments();

  } catch (error) {
    console.error("Error loading product:", error);
    showToast("Error loading item details: " + error.message, "error");
    document.getElementById("loadingState").innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle text-danger"></i>
        <h3>Item Not Found</h3>
        <p>The item you are looking for does not exist or has been removed.</p>
        <a href="mart.html" class="btn btn-primary mt-4">Back to Marketplace</a>
      </div>
    `;
  }
}

/**
 * Render a thumbnail gallery if image_2 or image_3 are present
 */
function renderImageGallery(product) {
  const thumbnailContainer = document.getElementById("imageThumbnails");
  if (!thumbnailContainer) return;

  const images = [product.main_image, product.image_2, product.image_3].filter(Boolean);
  if (images.length <= 1) {
    thumbnailContainer.style.display = "none";
    return;
  }

  thumbnailContainer.style.display = "flex";
  thumbnailContainer.innerHTML = images.map((url, i) => `
    <div class="thumb-item ${i === 0 ? 'active' : ''}" onclick="switchMainImage('${url}', this)" style="cursor:pointer; width:70px; height:60px; border-radius:var(--radius); overflow:hidden; border: 2px solid ${i === 0 ? 'var(--primary)' : 'var(--border)'}; flex-shrink:0;">
      <img src="${url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.display='none'">
    </div>
  `).join('');
}

window.switchMainImage = function(url, thumbEl) {
  const mainImg = document.getElementById("productImage");
  if (mainImg) mainImg.src = url;
  // Update active border
  document.querySelectorAll(".thumb-item").forEach(t => t.style.borderColor = "var(--border)");
  thumbEl.style.borderColor = "var(--primary)";
};

async function loadComments() {
  const container = document.getElementById("commentsContainer");
  const countSpan = document.getElementById("commentCount");
  
  try {
    const comments = await api.getProductComments(currentProductId);
    
    countSpan.textContent = comments.length;
    
    if (comments.length === 0) {
      container.innerHTML = '<div class="text-muted text-center py-4">No questions yet. Be the first to ask!</div>';
      return;
    }
    
    const isOwner = currentUser && currentProduct && currentUser.id === currentProduct.seller;
    container.innerHTML = '';

    for (const comment of comments) {
      // Fetch replies for this comment
      const replies = await api.getCommentReplies(comment.id);

      const repliesHtml = replies.length > 0 ? replies.map(r => `
        <div class="comment-reply" style="margin-left:var(--space-10);margin-top:var(--space-2);padding:var(--space-3);background:var(--bg-alt);border-radius:var(--radius);border-left:3px solid var(--primary);">
          <div class="flex justify-between">
            <span class="font-semibold text-xs text-primary"><i class="fas fa-store"></i> Seller Reply</span>
            <span class="text-xs text-muted">${formatDate(r.created_at)}</span>
          </div>
          <p class="text-sm m-0 mt-1">${r.reply}</p>
        </div>
      `).join('') : '';

      // Action buttons: delete (comment author) or hide (product seller)
      let actionBtns = '';
      if (currentUser) {
        if (currentUser.id === comment.user) {
          actionBtns = `<button class="btn btn-outline btn-sm" style="font-size:0.7rem;padding:2px 8px;color:var(--danger);border-color:var(--danger);" onclick="handleDeleteComment(${comment.id})"><i class="fas fa-trash"></i> Delete</button>`;
        } else if (isOwner) {
          actionBtns = `<button class="btn btn-outline btn-sm" style="font-size:0.7rem;padding:2px 8px;" onclick="handleHideComment(${comment.id})"><i class="fas fa-eye-slash"></i> Hide</button>`;
        }
      }

      // Reply input: only visible to product owner, and only if no reply yet
      const canReply = isOwner && replies.length === 0;
      const replyFormHtml = canReply ? `
        <div id="replyForm-${comment.id}" style="display:none; margin-left:var(--space-10); margin-top:var(--space-2);">
          <div class="flex gap-2">
            <input type="text" class="form-control" id="replyInput-${comment.id}" placeholder="Type your reply..." style="font-size:0.85rem;">
            <button class="btn btn-primary btn-sm" onclick="handleReplySubmit(${comment.id})" id="replyBtn-${comment.id}"><i class="fas fa-paper-plane"></i></button>
          </div>
        </div>
        <button class="btn btn-outline btn-sm" style="font-size:0.7rem;padding:2px 8px;margin-left:var(--space-10);margin-top:var(--space-2);" onclick="toggleReplyForm(${comment.id})" id="toggleReplyBtn-${comment.id}">
          <i class="fas fa-reply"></i> Reply
        </button>
      ` : (isOwner && replies.length > 0 ? '<span class="text-xs text-muted" style="margin-left:var(--space-10);"><i class="fas fa-check-circle text-success"></i> Replied</span>' : '');

      const commentEl = document.createElement('div');
      commentEl.className = 'comment-box';
      commentEl.innerHTML = `
        <div class="comment-avatar">
          <i class="fas fa-user"></i>
        </div>
        <div class="comment-content" style="flex:1;">
          <div class="comment-header">
            <span class="font-semibold text-sm">
              ${comment.user_name} 
              ${currentProduct && comment.user === currentProduct.seller ? '<span class="badge badge-primary ml-1" style="font-size: 0.6rem;">Seller</span>' : ''}
            </span>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted">${formatDate(comment.created_at)}</span>
              ${actionBtns}
            </div>
          </div>
          <p class="text-sm text-secondary m-0 mt-1">${comment.comment}</p>
          ${repliesHtml}
          ${replyFormHtml}
        </div>
      `;
      container.appendChild(commentEl);
    }
    
  } catch (error) {
    console.error("Error loading comments:", error);
    container.innerHTML = '<div class="text-danger text-center py-4">Failed to load Q&A.</div>';
  }
}

async function handleCommentSubmit(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById("submitCommentBtn");
  const commentInput = document.getElementById("commentText");
  const originalText = submitBtn.textContent;
  
  const commentText = commentInput.value.trim();
  if (!commentText) return;
  
  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    
    await api.createComment({
      product: currentProductId,
      comment: commentText
    });
    
    showToast("Question posted successfully!", "success");
    commentInput.value = "";
    
    // Reload comments
    loadComments();
    
  } catch (error) {
    console.error("Comment error:", error);
    showToast(error.message || "Failed to post question.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ===== COMMENT MODERATION / REPLIES =====

window.handleDeleteComment = async function(commentId) {
  if (!confirm("Delete this question permanently?")) return;
  try {
    await api.deleteComment(commentId);
    showToast("Comment deleted.", "success");
    loadComments();
  } catch (error) {
    showToast(error.message || "Failed to delete comment.", "error");
  }
};

window.handleHideComment = async function(commentId) {
  if (!confirm("Hide this comment? It will no longer be visible to other users.")) return;
  try {
    await api.deleteComment(commentId); // Seller delete = soft hide
    showToast("Comment hidden.", "success");
    loadComments();
  } catch (error) {
    showToast(error.message || "Failed to hide comment.", "error");
  }
};

window.toggleReplyForm = function(commentId) {
  const replyForm = document.getElementById(`replyForm-${commentId}`);
  const toggleBtn = document.getElementById(`toggleReplyBtn-${commentId}`);
  if (!replyForm) return;
  const isVisible = replyForm.style.display !== 'none';
  replyForm.style.display = isVisible ? 'none' : 'block';
  if (toggleBtn) toggleBtn.innerHTML = isVisible ? '<i class="fas fa-reply"></i> Reply' : '<i class="fas fa-times"></i> Cancel';
  if (!isVisible) {
    const input = document.getElementById(`replyInput-${commentId}`);
    if (input) input.focus();
  }
};

window.handleReplySubmit = async function(commentId) {
  const input = document.getElementById(`replyInput-${commentId}`);
  const btn = document.getElementById(`replyBtn-${commentId}`);
  const replyText = input ? input.value.trim() : '';
  if (!replyText) {
    showToast("Reply cannot be empty.", "warning");
    return;
  }
  try {
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    await api.createCommentReply(commentId, replyText);
    showToast("Reply posted!", "success");
    loadComments(); // Reload to reflect reply
  } catch (error) {
    showToast(error.message || "Failed to post reply.", "error");
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
  }
};
