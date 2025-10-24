// =============================
// Utility: Safe DOM lookup
// =============================
const $ = (selector) => document.querySelector(selector);

// =============================
// Render-aware Supabase client
// =============================
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase env vars missing – add SUPABASE_URL & SUPABASE_ANON_KEY in Render');
}
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================
// Footer Year
// =============================
$('#year')?.setAttribute('textContent', new Date().getFullYear());

// =============================
// Contact Form Submission
// =============================
const contactForm = $('#contact-form');
const formStatus = $('#form-status');

if (contactForm && formStatus) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formStatus.textContent = 'Sending...';

    const payload = Object.fromEntries(new FormData(contactForm));

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Network error');
      formStatus.textContent = 'Message sent!';
      contactForm.reset();
    } catch (err) {
      console.error(err);
      formStatus.textContent = 'Error – try again later.';
    }
  });
}

// =============================
// Smooth-scroll CTA links
// =============================
document.querySelectorAll('.cta').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    $('#contact')?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => $('#contactName')?.focus(), 800);
  });
});

// =============================
// Expandable About Section
// =============================
document.addEventListener('DOMContentLoaded', () => {
  const readMoreBtn = $('.read-more-btn');
  const aboutBio = $('.about-bio');

  if (readMoreBtn && aboutBio) {
    readMoreBtn.addEventListener('click', () => {
      aboutBio.classList.toggle('expanded');
      const expanded = aboutBio.classList.contains('expanded');
      readMoreBtn.textContent = expanded ? 'See Less' : 'See More';
      readMoreBtn.setAttribute('aria-expanded', expanded);
    });
  }
});

// =============================
// Reviews – preview + modal pagination
// =============================
async function loadReviews(page = 1, limit = 3, containerId = 'reviews-container') {
  try {
    const res = await fetch('/api/reviews');
    const reviews = await res.json();
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!reviews.length) {
      container.innerHTML = '<p>No reviews yet.</p>';
      return;
    }

    const totalPages = Math.ceil(reviews.length / limit);
    const start = (page - 1) * limit;
    const slice = reviews.slice(start, start + limit);

    slice.forEach((r) => {
      const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
      const comment =
        containerId === 'reviews-container' && r.text.length > 120
          ? r.text.slice(0, 120) + '...'
          : r.text;

      const el = document.createElement('blockquote');
      el.className = 'review';
      el.innerHTML = `
        <p>"${comment}"</p>
        <cite>— ${r.name}</cite>
        <div class="review-stars" style="color:#f5a623;">${stars}</div>
      `;
      container.appendChild(el);
    });

    // Pagination – only inside modal
    if (containerId === 'modal-reviews-container') {
      const pagination = $('#reviews-modal .review-pagination');
      if (!pagination) return;

      pagination.innerHTML = `
        <button class="review-prev" ${page === 1 ? 'disabled' : ''}>Prev</button>
        <span>Page ${page} of ${totalPages}</span>
        <button class="review-next" ${page === totalPages ? 'disabled' : ''}>Next</button>
      `;

      // Re-attach listeners (clone to avoid duplicates)
      const prev = pagination.querySelector('.review-prev');
      const next = pagination.querySelector('.review-next');

      prev?.replaceWith(prev.cloneNode(true));
      next?.replaceWith(next.cloneNode(true));

      pagination.querySelector('.review-prev').addEventListener('click', () =>
        loadReviews(page - 1, limit, containerId)
      );
      pagination.querySelector('.review-next').addEventListener('click', () =>
        loadReviews(page + 1, limit, containerId)
      );
    }
  } catch (err) {
    console.error('loadReviews error:', err);
  }
}

// =============================
// Featured Listings (active only)
// =============================
async function loadFeaturedListings() {
  try {
    const res = await fetch('/api/listings?status=active');
    const listings = await res.json();

    const grid = $('.listings-grid');
    grid.innerHTML = '';

    listings.forEach((l) => {
      const photo = l.photos?.[0]?.url || 'assets/placeholder.jpg';
      const price = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(l.price);

      grid.innerHTML += `
        <article class="listing" data-id="${l.id}">
          <img src="${photo}" alt="${l.address}" loading="lazy">
          <h3>${l.address}</h3>
          <p>${l.beds} bed • ${l.baths} bath • ${l.sqft} sqft</p>
          <p class="price">${price}</p>
          ${l.status === 'closed' ? '<span class="sold">SOLD</span>' : ''}
        </article>
      `;
    });

    const viewAll = $('#view-all-listings');
    if (viewAll) viewAll.style.display = listings.length ? 'block' : 'none';
  } catch (err) {
    console.error('loadFeaturedListings error:', err);
  }
}

// =============================
// All Listings Modal
// =============================
async function loadAllListings() {
  try {
    const res = await fetch('/api/listings');
    const listings = await res.json();
    const container = $('#all-listings-container');
    container.innerHTML = '';

    listings.forEach((l) => {
      const photo = l.photos?.[0]?.url || 'assets/placeholder.jpg';
      const price = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(l.price);

      container.innerHTML += `
        <article class="listing" data-id="${l.id}">
          <img src="${photo}" alt="${l.address}" loading="lazy">
          <h3>${l.address}, ${l.city} ${l.zip}</h3>
          <p>${l.beds} bed • ${l.baths} bath • ${l.sqft} sqft • ${price}</p>
          ${l.status === 'closed' ? '<span class="sold">SOLD</span>' : ''}
        </article>
      `;
    });
  } catch (err) {
    console.error('loadAllListings error:', err);
  }
}

// =============================
// Modal Controls (Reviews + All Listings)
// =============================
document.addEventListener('DOMContentLoaded', () => {
  // Reviews modal
  const reviewsModal = $('#reviews-modal');
  const openReviewsBtn = $('#see-more-reviews');
  const closeReviewsBtn = reviewsModal?.querySelector('.modal-close');

  // Load preview on page load
  loadReviews(1, 3, 'reviews-container');
  loadFeaturedListings();

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

  // Header link to reviews modal
  $('a[href="#reviews"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    openReviewsModal();
  });

  // All-listings modal
  $('#view-all-listings')?.addEventListener('click', () => {
    $('#all-listings-modal').classList.add('show');
    loadAllListings();
  });
  $('#all-listings-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'all-listings-modal') $('#all-listings-modal').classList.remove('show');
  });
});

// =============================
// Admin Dashboard
// =============================
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = $('#admin-login-btn');
  if (loginBtn) loginBtn.style.display = 'block';

  // Show login modal
  loginBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    $('#login-modal').classList.add('show');
  });

  // Auto-login if session exists
  const session = localStorage.getItem('sb-session');
  if (session) {
    $('#dashboard-modal').classList.add('show');
    loginBtn.textContent = 'Dashboard';
  }
});

// Login form
$('#login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
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
  $('#admin-login-btn').textContent = 'Dashboard';
});

// Logout
$('#logout-btn')?.addEventListener('click', () => {
  localStorage.removeItem('sb-session');
  $('#dashboard-modal').classList.remove('show');
  $('#admin-login-btn').textContent = 'Admin';
  location.reload();
});

// Tab switching
$('#reviews-tab')?.addEventListener('click', () => {
  $('#reviews-section').style.display = 'block';
  $('#listings-section').style.display = 'none';
});
$('#listings-tab')?.addEventListener('click', () => {
  $('#reviews-section').style.display = 'none';
  $('#listings-section').style.display = 'block';
});

// ---------- Helpers ----------
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

// ---------- Add Review ----------
$('#add-review-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: $('#review-name').value,
    text: $('#review-text').value,
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

// ---------- Add Listing (multi-photo) ----------
$('#add-listing-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const photos = [];
  const files = $('#listing-photos').files;

  for (let file of files) {
    const base64 = await fileToBase64(file);
    const up = await fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, fileData: base64 }),
    });
    const { url } = await up.json();
    photos.push({ url, caption: '' });
  }

  const payload = {
    address: $('#listing-address').value,
    city: $('#listing-city').value,
    state: $('#listing-state').value,
    zip: $('#listing-zip').value,
    price: Number($('#listing-price').value),
    beds: Number($('#listing-beds').value),
    baths: Number($('#listing-baths').value),
    sqft: Number($('#listing-sqft').value),
    status: $('#listing-status').value,
    photos,
    metadata: parseJSONSafe($('#listing-metadata').value) || {},
  };

  const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
  const res = await fetch('/api/listings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token || ''}`,
    },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    alert('Listing added!');
    loadFeaturedListings();
    e.target.reset();
  } else {
    const err = await res.json();
    alert('Error: ' + (err.error || 'unknown'));
  }
});