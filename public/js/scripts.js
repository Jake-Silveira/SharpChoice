// Utility: Safe DOM lookup
const $ = (selector) => document.querySelector(selector);

// =============================
// Sanitization utilities
// =============================
function sanitizeHTML(input) {
  if (typeof input !== 'string') return input;
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [] 
  });
}

function sanitizeRichHTML(input) {
  if (typeof input !== 'string') return input;
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: []
  });
}

// =============================
// Supabase client – from <meta> tags + CDN
// =============================
const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]')?.content?.trim() || '';
const SUPABASE_ANON_KEY = document.querySelector('meta[name="supabase-anon-key"]')?.content?.trim() || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase env vars missing – add <meta name="supabase-url"> and <meta name="supabase-anon-key"> in <head>');
}

let supabase = null;

// Wait for Supabase to load from CDN
function initSupabase() {
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn('Supabase not ready yet – retrying...');
    setTimeout(initSupabase, 100);
  }
}
initSupabase();

// Global error handler
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  // Optional: Send to error tracking service
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

// =============================
// Footer Year
// =============================
$('#year')?.setAttribute('textContent', new Date().getFullYear());

// =============================
// Contact Form Submission
// =============================
const contactForm = $('#contact-form');
const formStatus  = $('#form-status');

if (contactForm && formStatus) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // ---- 1. Grab checkbox state first ----
    const optInChecked = $('#contact-opt-in')?.checked ?? false;

    // ---- 2. Front-end validation (mirrors server) ----
    if (!optInChecked) {
      formStatus.textContent = 'You must agree to the Privacy Policy to submit.';
      formStatus.style.color = 'red';
      return;                     // stop submission
    }

    formStatus.textContent = 'Sending...';
    formStatus.style.color = '';

    // ---- 3. Build payload (FormData → object) + opt_in ----
    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData);
    payload.opt_in = optInChecked;   // <-- explicit boolean

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // ---- 4. Server-side error handling ----
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Network error');
      }

      // ---- 5. Success ----
      formStatus.textContent = 'Message sent! We’ll be in touch soon.';
      formStatus.style.color = 'green';
      contactForm.reset();
      setTimeout(() => (formStatus.textContent = ''), 5000);
    } catch (err) {
      console.error(err);
      formStatus.textContent = err.message || 'Error – please try again later.';
      formStatus.style.color = 'red';
    }
  });
}
// =============================
// Smooth-scroll CTA links
// =============================
document.querySelectorAll('.cta').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const target = $('#contact');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => $('#contactName')?.focus(), 800);
    }
  });
});

// =============================
// Expandable About Section
// =============================
document.addEventListener('DOMContentLoaded', () => {
  const readMoreBtn = $('.read-more-btn');
  const bio         = $('#about-bio');      // the <p> that truncates
  const moreText    = $('#about-more');     // hidden extra text

  if (readMoreBtn && bio && moreText) {
    readMoreBtn.addEventListener('click', () => {
      const isExpanded = bio.classList.toggle('expanded');

      // Update button text & ARIA
      readMoreBtn.textContent = isExpanded ? 'See Less' : 'See More';
      readMoreBtn.setAttribute('aria-expanded', isExpanded);
    });
  }
});

// =============================
// Reviews – preview + modal pagination
// =============================
async function loadReviews(page = 1, limit = 3, containerId = 'reviews-container', includeGoogleReviews = true) {
  if (!supabase) return console.warn('Supabase not ready');

  try {
    const res = await fetch('/api/reviews');
    if (!res.ok) throw new Error(`Failed to fetch reviews: ${res.status} ${res.statusText}`);
    const reviews = await res.json();

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!Array.isArray(reviews) || reviews.length === 0) {
      container.innerHTML = '<p>No reviews yet. Check back soon!</p>';
      // Add Google Reviews link if container is for main reviews
      if (containerId === 'reviews-container') {
        container.innerHTML += '<p>See our <a href="https://www.google.com/search?q=Sharp+Choice+Real+Estate+Austin" target="_blank" rel="noopener noreferrer">Google Reviews</a></p>';
      }
      return;
    }

    // Add Google Reviews callout if container is for main reviews
    if (containerId === 'reviews-container') {
      const googleReviewCallout = document.createElement('div');
      googleReviewCallout.className = 'google-review-callout';
      googleReviewCallout.innerHTML = `
        <p>See our <a href="https://www.google.com/search?q=Sharp+Choice+Real+Estate+Austin" target="_blank" rel="noopener noreferrer">Google Reviews</a></p>
      `;
      container.appendChild(googleReviewCallout);
    }

    const totalPages = Math.ceil(reviews.length / limit);
    const start = (page - 1) * limit;
    const slice = reviews.slice(start, start + limit);

    slice.forEach((r) => {
      const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
      let comment =
        containerId === 'reviews-container' && r.comment?.length > 120
          ? r.comment.slice(0, 120) + '... <em>(read more)</em>'
          : r.comment || '';

      // Sanitize the comment content
      comment = sanitizeRichHTML(comment);
      const authorName = sanitizeHTML(r.author_name || 'Anonymous');

      const el = document.createElement('blockquote');
      el.className = 'review';
      el.innerHTML = `
        <p>"${comment}"</p>
        <cite>— ${authorName}</cite>
        <div class="review-stars" style="color:#f5a623;">${stars}</div>
      `;
      container.appendChild(el);
    });

    // Pagination – only inside modal
    if (containerId === 'modal-reviews-container') {
      const pagination = $('.review-pagination');
      if (!pagination) return;

      pagination.innerHTML = `
        <button class="review-prev" ${page === 1 ? 'disabled' : ''}>Prev</button>
        <span>Page ${page} of ${totalPages}</span>
        <button class="review-next" ${page === totalPages ? 'disabled' : ''}>Next</button>
      `;

      pagination.querySelector('.review-prev')?.addEventListener('click', () =>
        loadReviews(page - 1, limit, containerId)
      );
      pagination.querySelector('.review-next')?.addEventListener('click', () =>
        loadReviews(page + 1, limit, containerId)
      );
    }
  } catch (err) {
    console.error('loadReviews error:', err.message, err.stack);
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '<p>Error loading reviews. Please try again later.</p>';
  }
}

// =============================
// Featured Listings (DEBUG + FIXED)
// =============================
async function loadFeaturedListings() {
  try {
    const res = await fetch('/api/listings?status=active');
    if (!res.ok) throw new Error(`Failed to fetch listings: ${res.status} ${res.statusText}`);
    const listings = await res.json();

    const grid = $('.listings-grid');
    if (!grid) return;

    // Skeleton
    grid.innerHTML = `
      <div class="skeleton skeleton-listing"></div>
      <div class="skeleton skeleton-listing"></div>
      <div style="display:flex;gap:1rem">
        <div class="skeleton skeleton-text" style="width:60%;height:20px;"></div>
        <div class="skeleton skeleton-text" style="width:30%;height:20px;"></div>
      </div>
    `;

    grid.innerHTML = ''; // Clear skeleton

    if (!Array.isArray(listings) || listings.length === 0) {
      grid.innerHTML = '<p>No active listings at this time.</p>';
      return;
    }

    console.log('Raw listings from API:', listings); // ← DEBUG

    listings.forEach((l) => {
      const price = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(l.price);

      const article = document.createElement('article');
      article.className = 'listing';
      article.dataset.id = l.id;

      // PHOTOS
      renderPhotos(l.photos, article);

      // TEXT
      const text = document.createElement('div');
      text.innerHTML = `
        <h3>${sanitizeHTML(l.address)}</h3>
        <p>${sanitizeHTML(l.beds)} bed • ${sanitizeHTML(l.baths)} bath • ${sanitizeHTML(l.sqft)} sqft</p>
        <p class="price">${price}</p>
        <span class="status-badge status-active">For Sale</span>
      `;
      article.appendChild(text);
      grid.appendChild(article);
    });
  } catch (err) {
    console.error('loadFeaturedListings error:', err);
    const grid = $('.listings-grid');
    if (grid) grid.innerHTML = '<p>Error loading listings. Please try again later.</p>';
  }
}

// =============================
// All Listings Modal
// =============================
async function loadAllListings() {
  try {
    const res = await fetch('/api/listings');
    if (!res.ok) throw new Error(`Failed to fetch listings: ${res.status} ${res.statusText}`);
    const listings = await res.json();
    const container = $('#all-listings-container');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(listings) || listings.length === 0) {
      container.innerHTML = '<p>No listings available.</p>';
      return;
    }

    listings.forEach((l) => {
      const price = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(l.price);

      const article = document.createElement('article');
      article.className = 'listing';
      article.dataset.id = l.id;

      const statusBadge = l.status === 'closed'
        ? '<span class="status-badge status-closed">SOLD</span>'
        : '<span class="status-badge status-active">For Sale</span>';

      // ---- PHOTOS ----
      renderPhotos(l.photos, article);

      // ---- TEXT ----
      const text = document.createElement('div');
      text.innerHTML = `
        <h3>${sanitizeHTML(l.address)}, ${sanitizeHTML(l.city)} ${sanitizeHTML(l.zip)}</h3>
        <p>${sanitizeHTML(l.beds)} bed • ${sanitizeHTML(l.baths)} bath • ${sanitizeHTML(l.sqft)} sqft</p>
        <p class="price">${price}</p>
        ${statusBadge}
      `;
      article.appendChild(text);

      container.appendChild(article);
    });
  } catch (err) {
    console.error('loadAllListings error:', err.message, err.stack);
    const container = $('#all-listings-container');
    if (container) container.innerHTML = '<p>Error loading listings. Please try again later.</p>';
  }
}

// Load listings into admin dashboard
async function loadAdminListings() {
  const container = $('#admin-listings-container');
  if (!container) return;

  try {
    const res = await fetch('/api/listings');
    if (!res.ok) throw new Error('Failed to fetch');
    const listings = await res.json();

    if (!Array.isArray(listings) || listings.length === 0) {
      container.innerHTML = '<p>No listings yet.</p>';
      return;
    }

    let html = `
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f8f9fa; text-align: left;">
            <th style="padding: 0.75rem; border-bottom: 2px solid #eee;">Address</th>
            <th style="padding: 0.75rem; border-bottom: 2px solid #eee;">Price</th>
            <th style="padding: 0.75rem; border-bottom: 2px solid #eee;">Status</th>
            <th style="padding: 0.75rem; border-bottom: 2px solid #eee;">Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    listings.forEach(l => {
      const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(l.price);
      const statusText = l.status === 'closed' ? 'SOLD' : 'Active';
      const statusClass = l.status === 'closed' ? 'status-closed' : 'status-active';
      const address = sanitizeHTML(l.address);
      const city = sanitizeHTML(l.city);

      html += `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 0.75rem;">${address}, ${city}</td>
          <td style="padding: 0.75rem;">${price}</td>
          <td style="padding: 0.75rem;">
            <span class="status-badge ${statusClass}" style="font-size: 0.8rem; padding: 0.25rem 0.5rem; border-radius: 4px;">
              ${statusText}
            </span>
          </td>
          <td style="padding: 0.75rem; display:flex; gap:0.5rem;">
            <button class="btn-accent" style="padding:0.4rem 0.8rem; font-size:0.85rem;"
                    onclick="openEditListing('${l.id}')">
              Edit
            </button>
            <button class="btn-accent" style="padding:0.4rem 0.8rem; font-size:0.85rem; background:${l.status === 'closed' ? '#28a745' : 'var(--color-error)'};"
                  onclick="toggleListingStatus('${l.id}', '${l.status}')">
            ${l.status === 'closed' ? 'Mark Active' : 'Mark SOLD'}
          </button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  } catch (err) {
    console.error('loadAdminListings error:', err);
    container.innerHTML = '<p>Error loading listings.</p>';
  }
}

// Toggle listing status (quick action from table)
async function toggleListingStatus(id, currentStatus) {
  const action = currentStatus === 'closed' ? 'activate' : 'mark as SOLD';
  if (!confirm(`Are you sure you want to mark this listing as ${action}?`)) return;

  const newStatus = currentStatus === 'closed' ? 'active' : 'closed';

  const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
  const token = session.access_token || '';

  try {
    const res = await fetch(`/api/listings/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Update failed');
    }

    // Success feedback
    alert(`Listing ${newStatus === 'closed' ? 'marked SOLD' : 'activated'}!`);
    
    // Refresh UI
    loadAdminListings();
    loadFeaturedListings();
    loadAllListings();
  } catch (err) {
    console.error('Toggle status error:', err);
    alert('Error: ' + err.message);
  }
}

// ---- Open edit modal and fill with current data ----
async function openEditListing(id) {
  const modal = $('#edit-listing-modal');
  if (!modal) return;

  const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
  const token = session.access_token || '';
  if (!token) { alert('You must be logged in.'); return; }

  try {
    const res = await fetch(`/api/listings/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`); }
    const listing = await res.json();

    $('#edit-listing-id').value = listing.id;
    $('#edit-address').value = sanitizeHTML(listing.address) || '';
    $('#edit-city').value = sanitizeHTML(listing.city) || '';
    $('#edit-state').value = sanitizeHTML(listing.state) || '';
    $('#edit-zip').value = sanitizeHTML(listing.zip) || '';
    $('#edit-price').value = sanitizeHTML(listing.price) || '';
    $('#edit-beds').value = sanitizeHTML(listing.beds) || '';
    $('#edit-baths').value = sanitizeHTML(listing.baths) || '';
    $('#edit-sqft').value = sanitizeHTML(listing.sqft) || '';
    $('#edit-status').value = sanitizeHTML(listing.status) || 'active';
    $('#edit-metadata').value = JSON.stringify(listing.metadata || {}, null, 2);

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    console.error('openEditListing error:', err);
    alert('Failed to load listing: ' + err.message);
  }
}

// ---- Close edit modal (cancel or X) ----
function closeEditListing() {
  const modal = $('#edit-listing-modal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// ---- Cancel button (uses same close logic) ----
$('#edit-cancel-btn')?.addEventListener('click', closeEditListing);

// ---- X button & backdrop click (existing) ----
$('#edit-listing-modal .modal-close')?.addEventListener('click', closeEditListing);
$('#edit-listing-modal')?.addEventListener('click', e => {
  if (e.target.id === 'edit-listing-modal') closeEditListing();
});

// ---- Submit edited listing ----
$('#edit-listing-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = $('#edit-listing-id').value;
  const payload = {
    address: $('#edit-address').value.trim(),
    city: $('#edit-city').value.trim(),
    state: $('#edit-state').value.trim(),
    zip: $('#edit-zip').value.trim(),
    price: Number($('#edit-price').value),
    beds: Number($('#edit-beds').value),
    baths: Number($('#edit-baths').value),
    sqft: Number($('#edit-sqft').value),
    status: $('#edit-status').value,
    metadata: (() => {
      try { return JSON.parse($('#edit-metadata').value); }
      catch { return {}; }
    })()
  };

  const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
  const token = session.access_token || '';

  try {
    const res = await fetch(`/api/listings/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Save failed');
    }

    alert('Listing updated!');
    closeEditListing();
    loadAdminListings();
    loadFeaturedListings();
    loadAllListings();
  } catch (err) {
    console.error('Edit listing error:', err);
    alert('Error: ' + err.message);
  }
});

// Close on X button
$('#edit-listing-modal .modal-close')?.addEventListener('click', closeEditListing);

// Close on background click
$('#edit-listing-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'edit-listing-modal') closeEditListing();
});

// =============================
// Modal Controls
// =============================
document.addEventListener('DOMContentLoaded', () => {
  loadReviews(1, 3, 'reviews-container');
  loadFeaturedListings();

  // Reviews Modal
  const reviewsModal = $('#reviews-modal');
  const openReviewsBtn = $('#see-more-reviews');
  const closeReviewsBtn = reviewsModal?.querySelector('.modal-close');

  const openReviewsModal = () => {
    reviewsModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    loadReviews(1, 3, 'modal-reviews-container');
  };
  const closeReviewsModal = () => {
    reviewsModal.classList.remove('show');
    document.body.style.overflow = '';
  };

  openReviewsBtn?.addEventListener('click', openReviewsModal);
  closeReviewsBtn?.addEventListener('click', closeReviewsModal);
  reviewsModal?.addEventListener('click', (e) => e.target === reviewsModal && closeReviewsModal());

  $('#header-reviews-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    openReviewsModal();
  });

  // All-listings modal
  $('#view-all-listings')?.addEventListener('click', () => {
    $('#all-listings-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
    loadAllListings();
  });

  $('#all-listings-modal .modal-close')?.addEventListener('click', () => {
    $('#all-listings-modal').classList.remove('show');
    document.body.style.overflow = '';
  });

  $('#all-listings-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'all-listings-modal') {
      $('#all-listings-modal').classList.remove('show');
      document.body.style.overflow = '';
    }
  });

  // Mobile Nav
  const navToggle = $('.nav-toggle');
  const navMenu = $('#nav-menu');
  navToggle?.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('show');
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  navMenu?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('show');
      navToggle?.setAttribute('aria-expanded', 'false');
    });
  });
});

// =============================
// Admin Dashboard
// =============================
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = $('#admin-login-btn');
  if (loginBtn) loginBtn.style.display = 'block';

  loginBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    $('#login-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
  });

  const session = localStorage.getItem('sb-session');
  if (session && supabase) {
    $('#dashboard-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
    loginBtn.textContent = 'Dashboard';
  }
});

// Close modals
$('#login-modal .modal-close')?.addEventListener('click', () => {
  $('#login-modal').classList.remove('show');
  document.body.style.overflow = '';
});
$('#dashboard-modal .modal-close')?.addEventListener('click', () => {
  $('#dashboard-modal').classList.remove('show');
  document.body.style.overflow = '';
});

// Login
$('#login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!supabase) return alert('Supabase not loaded yet. Try again.');

  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Login failed: ' + error.message);
    return;
  }

  localStorage.setItem('sb-session', JSON.stringify(data.session));
  $('#login-modal').classList.remove('show');
  $('#dashboard-modal').classList.add('show');
  document.body.style.overflow = 'hidden';
  $('#admin-login-btn').textContent = 'Dashboard';
});

// Logout
$('#logout-btn')?.addEventListener('click', () => {
  localStorage.removeItem('sb-session');
  $('#dashboard-modal').classList.remove('show');
  document.body.style.overflow = '';
  $('#admin-login-btn').textContent = 'Admin';
  location.reload();
});

// Tabs
$('#reviews-tab')?.addEventListener('click', () => {
  $('#reviews-section').style.display = 'block';
  $('#listings-section').style.display = 'none';
  $('#reviews-tab').classList.add('tab-active');
  $('#listings-tab').classList.remove('tab-active');
});
$('#listings-tab')?.addEventListener('click', () => {
  $('#reviews-section').style.display = 'none';
  $('#listings-section').style.display = 'block';
  $('#reviews-tab').classList.remove('tab-active');
  $('#listings-tab').classList.add('tab-active');

  // Default to "Add Listing" sub-tab
  $('#add-listing-subsection').style.display = 'block';
  $('#edit-listings-subsection').style.display = 'none';
  $('#add-listing-tab').classList.add('tab-active');
  $('#edit-listings-tab').classList.remove('tab-active');
});

// ---- Sub-tab: Add Listing ----
$('#add-listing-tab')?.addEventListener('click', () => {
  $('#add-listing-subsection').style.display = 'block';
  $('#edit-listings-subsection').style.display = 'none';
  $('#add-listing-tab').classList.add('tab-active');
  $('#edit-listings-tab').classList.remove('tab-active');
});

// ---- Sub-tab: Edit Listings ----
$('#edit-listings-tab')?.addEventListener('click', () => {
  $('#add-listing-subsection').style.display = 'none';
  $('#edit-listings-subsection').style.display = 'block';
  $('#add-listing-tab').classList.remove('tab-active');
  $('#edit-listings-tab').classList.add('tab-active');
  
  // Load table when tab is opened
  loadAdminListings();
});

// Helpers
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function parseJSONSafe(str) {
  try { return JSON.parse(str); } catch { return {}; }
}

// ---------- PHOTO RENDERER (FIXED) ----------
function renderPhotos(photos = [], container) {
  // ---- No photos → placeholder ----
  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    const img = document.createElement('img');
    img.src = 'assets/placeholder.jpg';
    img.alt = 'No photo available';
    img.className = 'main-photo';
    img.loading = 'lazy';
    img.style.cssText = 'width:100%;border-radius:6px;';
    container.appendChild(img);
    return;
  }

  // ---- MAIN PHOTO ----
  const mainContainer = document.createElement('div');
  mainContainer.className = 'main-photo-container';

  const mainImg = document.createElement('img');
  const mainUrl = ensurePublicUrl(photos[0].url);
  mainImg.src = mainUrl;
  mainImg.alt = 'Main listing photo';
  mainImg.className = 'main-photo';
  mainImg.loading = 'lazy';
  mainImg.onerror = () => {
    mainImg.src = 'assets/placeholder.jpg';
    console.warn('Main photo failed to load:', photos[0].url);
  };
  mainContainer.appendChild(mainImg);
  container.appendChild(mainContainer);

  // ---- THUMBNAIL CAROUSEL ----
  const carousel = document.createElement('div');
  carousel.className = 'photo-carousel';

  photos.forEach(p => {
    const thumb = document.createElement('img');
    const thumbUrl = ensurePublicUrl(p.url);
    thumb.src = thumbUrl;
    thumb.alt = 'Listing thumbnail';
    thumb.className = 'photo-thumb';
    thumb.loading = 'lazy';
    thumb.onerror = () => {
      thumb.src = 'assets/placeholder.jpg';
      console.warn('Thumbnail failed to load:', p.url);
    };
    carousel.appendChild(thumb);
  });

  container.appendChild(carousel);

  // Helper: convert any Supabase URL to public version
  function ensurePublicUrl(url) {
    if (!url) return 'assets/placeholder.jpg';
    // If it's already a full public URL, return it
    if (url.includes('supabase.co/storage/v1/object/public')) return url;
    // If it's a token-based URL, strip token
    try {
      const u = new URL(url);
      if (u.searchParams.has('token')) {
        u.search = '';
        return u.toString();
      }
    } catch {}
    return url;
  }
}

// Add Review
$('#add-review-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
  author_name: $('#review-name').value.trim(),
  comment: $('#review-text').value.trim(),
  rating: Number($('#review-rating').value),
};

  const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
  const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token || ''}`,
    },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    alert('Review added!');
    loadReviews();
    e.target.reset();
  } else {
    const err = await res.json();
    alert('Error: ' + (err.error || 'unknown'));
  }
});

// Add Listing
$('#add-listing-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const photos = [];
  const files = $('#listing-photos').files;
  const previewContainer = document.createElement('div');
  previewContainer.className = 'photo-preview';
  $('#add-listing-form').appendChild(previewContainer); // Add previews below input

  try {
    for (let file of files) {
      // Preview (optional but helpful)
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = document.createElement('img');
        img.src = ev.target.result;
        previewContainer.appendChild(img);
      };
      reader.readAsDataURL(file);

      const base64 = await fileToBase64(file);
      const up = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileData: base64 }),
      });

      if (!up.ok) {
        const err = await up.json();
        throw new Error(err.error || 'Upload failed');
      }

      const { url } = await up.json();
      photos.push({ url, caption: '' });
    }

    const payload = {
      address: $('#listing-address').value.trim(),
      city: $('#listing-city').value.trim(),
      state: $('#listing-state').value.trim(),
      zip: $('#listing-zip').value.trim(),
      price: Number($('#listing-price').value),
      beds: Number($('#listing-beds').value),
      baths: Number($('#listing-baths').value),
      sqft: Number($('#listing-sqft').value),
      status: $('#listing-status').value,
      photos,
      metadata: parseJSONSafe($('#listing-metadata').value) || {},
    };

    const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
    const token = session.access_token || '';
    if (!token) throw new Error('Not authenticated');

    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Add failed');
    }

    alert('Listing added successfully!');
    e.target.reset();
    previewContainer.innerHTML = ''; // Clear previews
    loadFeaturedListings();
    loadAllListings(); // Refresh modals too
    loadAdminListings();
  } catch (err) {
    console.error('Add listing error:', err);
    alert('Error adding listing: ' + err.message);
  }
});

// ---------- LIGHTBOX ----------
document.addEventListener('click', e => {
  if (e.target.matches('.photo-thumb')) {
    const lightbox = document.createElement('div');
    lightbox.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,.85);
      display:flex; align-items:center; justify-content:center;
      z-index:2000; cursor:pointer;
    `;
    const img = document.createElement('img');
    img.src = e.target.src;
    img.style.maxWidth = '90%';
    img.style.maxHeight = '90%';
    img.style.borderRadius = '8px';
    lightbox.appendChild(img);
    lightbox.onclick = () => lightbox.remove();
    document.body.appendChild(lightbox);
  }
});

// =============================
// Fade-in on Scroll
// =============================
document.addEventListener('DOMContentLoaded', () => {
  const fadeElements = document.querySelectorAll('.fade-on-scroll');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // Stop observing once visible (one-time effect)
        }
      });
    }, {
      threshold: 0.1, // Trigger when 10% of element is in view
      rootMargin: '0px 0px -50px 0px' // Slight offset for smoother reveal
    });

    fadeElements.forEach(el => observer.observe(el));
  } else {
    // Fallback for older browsers: show immediately
    fadeElements.forEach(el => el.classList.add('visible'));
  }
});

// Back to top
const backToTop = $('#back-to-top');
window.addEventListener('scroll', () => {
  backToTop.classList.toggle('show', window.scrollY > 500);
});
backToTop?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Lazy Image Loader
document.addEventListener('DOMContentLoaded', () => {
  const images = document.querySelectorAll('img[loading="lazy"]');
  images.forEach(img => {
    if (img.complete) {
      img.classList.add('loaded');
    } else {
      img.addEventListener('load', () => img.classList.add('loaded'));
    }
  });
});

// Sticky CTA
$('#sticky-cta')?.addEventListener('click', () => {
  $('#contact').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => $('#contactName')?.focus(), 800);
});