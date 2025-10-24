// =============================
// Utility: Safe DOM lookup
// =============================
const $ = (selector) => document.querySelector(selector);

// =============================
// Footer Year
// =============================
const yearEl = $('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// =============================
// Contact Form Submission
// =============================
const form = $('#contact-form');
const status = $('#form-status');

if (form && status) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Sending...';

    const formData = Object.fromEntries(new FormData(form));

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Network error');
      status.textContent = 'Message sent successfully!';
      form.reset();
    } catch (err) {
      console.error(err);
      status.textContent = 'Error sending message. Please try again later.';
    }
  });
}

// =============================
// Smooth-scroll CTA links
// =============================
document.querySelectorAll(".cta").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const contactSection = $("#contact");
    contactSection.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => $("#contactName")?.focus(), 800);
  });
});

// =============================
// Expandable About Section
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const readMoreBtn = $(".read-more-btn");
  const aboutBio = $(".about-bio");

  if (readMoreBtn && aboutBio) {
    readMoreBtn.addEventListener("click", () => {
      aboutBio.classList.toggle("expanded");
      const expanded = aboutBio.classList.contains("expanded");
      readMoreBtn.textContent = expanded ? "See Less" : "See More";
      readMoreBtn.setAttribute("aria-expanded", expanded);
    });
  }
});

// =============================
// Reviews with Preview + Modal Pagination
// =============================

async function loadReviews(page = 1, limit = 3, containerId = "reviews-container") {
  try {
    const res = await fetch("/api/reviews");
    const reviews = await res.json();
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    if (!reviews.length) {
      container.innerHTML = "<p>No reviews yet. Check back soon!</p>";
      return;
    }

    const start = (page - 1) * limit;
    const paginated = reviews.slice(start, start + limit);

    paginated.forEach(({ author_name, comment, rating = 0 }) => {
      const blockquote = document.createElement("blockquote");
      blockquote.classList.add("review");

      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

      // truncate for preview
      const shortComment =
        containerId === "reviews-container" && comment.length > 120
          ? comment.slice(0, 120) + "..."
          : comment;

      blockquote.innerHTML = `
        <p>"${shortComment}"</p>
        <cite>— ${author_name}</cite>
        <div class="review-stars" style="color:#f5a623;">${stars}</div>
      `;
      container.appendChild(blockquote);
    });

async function loadFeaturedListings() {
  const res = await fetch("/api/listings?status=active");
  const listings = await res.json();

  const grid = document.querySelector(".listings-grid");
  grid.innerHTML = "";                 // clear static markup

  listings.forEach(l => {
    const photoUrl = l.photos?.[0]?.url || "assets/placeholder.jpg";
    const price = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(l.price);

    grid.innerHTML += `
      <article class="listing" data-id="${l.id}">
        <img src="${photoUrl}" alt="${l.address}" loading="lazy">
        <h3>${l.address}</h3>
        <p>${l.beds} bed • ${l.baths} bath • ${l.sqft} sqft</p>
        <p class="price">${price}</p>
        ${l.status === "closed" ? '<span class="sold">SOLD</span>' : ""}
      </article>
    `;
  });

  // “View All” button
  const viewAll = document.getElementById("view-all-listings");
  if (viewAll) viewAll.style.display = listings.length ? "block" : "none";
}

// Only show pagination inside modal
if (containerId === "modal-reviews-container") {
  const totalPages = Math.ceil(reviews.length / limit);
  const pagination = document.querySelector("#reviews-modal .review-pagination");
  if (!pagination) return;

  pagination.innerHTML = `
    <button ${page === 1 ? "disabled" : ""} class="review-prev">Prev</button>
    <span>Page ${page} of ${totalPages}</span>
    <button ${page === totalPages ? "disabled" : ""} class="review-next">Next</button>`;

  // re-attach event listeners
  pagination.querySelector(".review-prev")?.replaceWith(
    pagination.querySelector(".review-prev").cloneNode(true)
  );
  pagination.querySelector(".review-next")?.replaceWith(
    pagination.querySelector(".review-next").cloneNode(true)
  );

  pagination.querySelector(".review-prev").addEventListener("click", () =>
    loadReviews(page - 1, limit, containerId)
  );
  pagination.querySelector(".review-next").addEventListener("click", () =>
    loadReviews(page + 1, limit, containerId)
  );
}
  } catch (err) {
    console.error("Error loading reviews:", err);
  }
}

// =============================
// Modal Controls
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("reviews-modal");
  const openBtn = document.getElementById("see-more-reviews");
  const closeBtn = modal.querySelector(".modal-close");

  // Load preview
  loadReviews(1, 3, "reviews-container");

  // Modal open
  function openModal() {
    modal.classList.add("show");
    document.body.style.overflow = "hidden"; // prevent background scroll
    loadReviews(1, 3, "modal-reviews-container");
  }

  // Modal close
  function closeModal() {
    modal.classList.remove("show");
    document.body.style.overflow = "";
  }

  openBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);

  // Header "Reviews" button link
  const headerReviewLink = document.querySelector('a[href="#reviews"]');
  if (headerReviewLink) {
    headerReviewLink.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });
  }

  // Close on background click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
});

// Open modal
document.getElementById("view-all-listings")?.addEventListener("click", () => {
  document.getElementById("all-listings-modal").classList.add("show");
  loadAllListings();
});

// Load everything
async function loadAllListings() {
  const res = await fetch("/api/listings");   // no filter
  const listings = await res.json();
  const container = document.getElementById("all-listings-container");
  container.innerHTML = "";

  listings.forEach(l => {
    const photoUrl = l.photos?.[0]?.url || "assets/placeholder.jpg";
    const price = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(l.price);

    container.innerHTML += `
      <article class="listing" data-id="${l.id}">
        <img src="${photoUrl}" alt="${l.address}" loading="lazy">
        <h3>${l.address}, ${l.city} ${l.zip}</h3>
        <p>${l.beds} bed • ${l.baths} bath • ${l.sqft} sqft • ${price}</p>
        ${l.status === "closed" ? '<span class="sold">SOLD</span>' : ""}
      </article>
    `;
  });
}


// Init Supabase client (add your URL/anon key)
const supabase = supabase.createClient('YOUR_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');

// Show login button (maybe check localStorage for session)
document.addEventListener('DOMContentLoaded', () => {
  // ... existing code ...
  
  const loginBtn = document.getElementById('admin-login-btn');
  loginBtn.style.display = 'block';  // Or condition on dev
  
  loginBtn.addEventListener('click', () => {
    document.getElementById('login-modal').classList.add('show');
  });
});

// Login Form
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Login failed: ' + error.message);
    return;
  }
  
  // Hide login, show dashboard
  document.getElementById('login-modal').classList.remove('show');
  document.getElementById('dashboard-modal').classList.add('show');
  
  // Store session (localStorage for simplicity)
  localStorage.setItem('supabase_session', JSON.stringify(data.session));
});

// Tab Switching
document.getElementById('reviews-tab').addEventListener('click', () => {
  document.getElementById('reviews-section').style.display = 'block';
  document.getElementById('listings-section').style.display = 'none';
});

document.getElementById('listings-tab').addEventListener('click', () => {
  document.getElementById('reviews-section').style.display = 'none';
  document.getElementById('listings-section').style.display = 'block';
});

// Add Review Form
document.getElementById('add-review-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('review-name').value;
  const text = document.getElementById('review-text').value;
  const rating = document.getElementById('review-rating').value;
  
  const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, text, rating })
  });
  
  if (res.ok) {
    alert('Review added!');
    loadReviews();  // Refresh frontend reviews
  } else {
    alert('Error adding review');
  }
});

// Add Listing Form (with image upload)
document.getElementById("add-listing-form").addEventListener("submit", async e => {
  e.preventDefault();

  const photos = [];
  const files = document.getElementById("listing-photos").files;

  // 1. Upload each photo
  for (let file of files) {
    const base64 = await fileToBase64(file);
    const res = await fetch("/api/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, fileData: base64 })
    });
    const { url } = await res.json();
    photos.push({ url, caption: "" });   // caption can be added later
  }

  // 2. Build payload
  const payload = {
    address: document.getElementById("listing-address").value,
    city: document.getElementById("listing-city").value,
    state: document.getElementById("listing-state").value,
    zip: document.getElementById("listing-zip").value,
    price: Number(document.getElementById("listing-price").value),
    beds: Number(document.getElementById("listing-beds").value),
    baths: Number(document.getElementById("listing-baths").value),
    sqft: Number(document.getElementById("listing-sqft").value),
    status: document.getElementById("listing-status").value,
    photos,
    metadata: parseJSONSafe(document.getElementById("listing-metadata").value) || {}
  };

  // 3. Save to DB
  const resp = await fetch("/api/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (resp.ok) {
    alert("Listing added!");
    loadFeaturedListings();   // refresh landing page
  } else {
    alert("Error");
  }
});

// Helper
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseJSONSafe(str) {
  try { return JSON.parse(str); } catch { return {}; }
}

async function postListing(data) {
  const res = await fetch('/api/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (res.ok) {
    alert('Listing added!');
    loadListings();  // Add a function to refresh #listings grid
  } else {
    alert('Error adding listing');
  }
}

document.addEventListener("DOMContentLoaded", () => loadReviews());
