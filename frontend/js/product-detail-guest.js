/**
 * Product Detail Page (Guest) - LocalSeva
 * Handles marketplace product loading, comments rendering, and guest restrictions
 */

let currentProductId = null;
let currentProduct = null;

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
  // Get product ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  currentProductId = urlParams.get("id");

  if (!currentProductId) {
    showToast("Invalid product ID", "error");
    window.location.href = "mart.html";
    return;
  }

  // Bind guest comment form prompt
  const commentForm = document.getElementById("commentForm");
  if (commentForm) {
    commentForm.innerHTML = `
      <div class="p-4 bg-primary-subtle text-primary rounded text-center text-sm font-medium">
        Please <a href="login.html" class="font-bold" style="text-decoration: underline;">login</a> to ask the seller a question.
      </div>
    `;
  }

  // Load Data
  loadProductDetails();
});

async function loadProductDetails() {
  try {
    document.getElementById("loadingState").style.display = "block";
    document.getElementById("productContent").style.display = "none";

    const product = await api.getProduct(currentProductId);
    currentProduct = product;
    
    // Update UI
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("productContent").style.display = "block";
    
    document.getElementById("productTitle").textContent = product.title;
    document.getElementById("productDate").textContent = formatDate(product.created_at);
    document.getElementById("productViews").textContent = `${product.views || 0} views`;
    
    // Status Badge
    const statusBadge = document.getElementById("productStatus");
    if (product.is_sold) {
      statusBadge.textContent = "Sold";
      statusBadge.className = "badge badge-danger";
    } else {
      statusBadge.textContent = "Available";
      statusBadge.className = "badge badge-success";
    }
    
    // Image (with gallery support)
    const imgEl = document.getElementById("productImage");
    if (product.main_image) {
      imgEl.src = product.main_image;
      imgEl.alt = product.title;
    } else {
      imgEl.src = "https://placehold.co/800x600/e2e8f0/64748b?text=No+Image";
    }
    renderImageGallery(product);
    
    document.getElementById("productDescription").textContent = product.description || "No description provided.";
    document.getElementById("productPrice").textContent = formatCurrency(product.price);
    
    // Details
    const conditionText = product.condition ? product.condition.replace("_", " ") : "Unknown";
    document.getElementById("productCondition").textContent = conditionText;
    document.getElementById("productCategory").textContent = CATEGORY_LABELS[product.category] || product.category || "Other";
    document.getElementById("productLocation").textContent = product.city || "Unknown";
    document.getElementById("productAddress").textContent = product.address || "Not specified";
    
    // Seller Info
    document.getElementById("sellerName").textContent = product.seller_name || "Unknown Seller";
    
    // Seller Rating
    const sellerRatingEl = document.getElementById("sellerRating");
    if (product.seller_rating !== null && product.seller_rating !== undefined) {
      sellerRatingEl.textContent = `${parseFloat(product.seller_rating).toFixed(1)} / 5.0`;
    } else {
      sellerRatingEl.textContent = "No ratings yet";
    }
    
    // Contact Section (Always Login to Contact Seller for Guest)
    const contactSection = document.getElementById("contactSection");
    contactSection.innerHTML = `
      <a href="login.html" class="contact-btn btn-phone mt-2">
        <i class="fas fa-lock"></i> Login to Contact Seller
      </a>
    `;

    // Load Comments
    loadComments();

  } catch (error) {
    console.error("Error loading product:", error);
    showToast("Error loading product details: " + error.message, "error");
    document.getElementById("loadingState").innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle text-danger"></i>
        <h3>Product Not Found</h3>
        <p>The marketplace listing you are looking for does not exist or an error occurred.</p>
        <a href="mart.html" class="btn btn-primary mt-4">Back to Marketplace</a>
      </div>
    `;
  }
}

async function loadComments() {
  const container = document.getElementById("commentsContainer");
  const commentCountEl = document.getElementById("commentCount");
  
  try {
    const comments = await api.getProductComments(currentProductId);
    commentCountEl.textContent = comments.length;
    
    if (comments.length === 0) {
      container.innerHTML = '<div class="text-muted text-center py-4">No questions asked yet.</div>';
      return;
    }
    
    container.innerHTML = "";
    for (const comment of comments) {
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

      // Initials for avatar
      const initials = (comment.user_name || "U")
        .split(/[\s_]+/)
        .map(w => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      container.innerHTML += `
        <div class="comment-box">
          <div class="comment-avatar">
            <span style="font-weight:600;font-size:0.9rem;color:var(--text-secondary);">${initials}</span>
          </div>
          <div class="comment-content" style="flex:1;">
            <div class="comment-header">
              <span class="font-semibold text-sm">${comment.user_name}</span>
              <span class="text-xs text-muted">${formatDate(comment.created_at)}</span>
            </div>
            <p class="text-sm text-secondary m-0 mt-1">${comment.comment}</p>
            ${repliesHtml}
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error("Error loading comments:", error);
    container.innerHTML = '<div class="text-danger text-center py-4">Failed to load comments.</div>';
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
    <div class="thumb-item" onclick="switchMainImage('${url}', this)" style="cursor:pointer; width:70px; height:60px; border-radius:var(--radius); overflow:hidden; border: 2px solid ${i === 0 ? 'var(--primary)' : 'var(--border)'}; flex-shrink:0;">
      <img src="${url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.display='none'">
    </div>
  `).join('');
}

window.switchMainImage = function(url, thumbEl) {
  const mainImg = document.getElementById("productImage");
  if (mainImg) mainImg.src = url;
  document.querySelectorAll(".thumb-item").forEach(t => t.style.borderColor = "var(--border)");
  thumbEl.style.borderColor = "var(--primary)";
};
