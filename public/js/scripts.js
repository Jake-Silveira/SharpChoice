// Utility: Safe DOM lookup
const $ = (selector) => document.querySelector(selector);

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
    formStatus.style.color = '';

    const payload = Object.fromEntries(new FormData(contactForm));

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Network error');
      formStatus.textContent = 'Message sent! We’ll be in touch soon.';
      formStatus.style.color = 'green';
      contactForm.reset();
      setTimeout(() => formStatus.textContent = '', 5000);
    } catch (err) {
      console.error(err);
      formStatus.textContent = 'Error – please try again later.';
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
async function loadReviews(page = 1, limit = 3, containerId = 'reviews-container') {
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
      return;
    }

    const totalPages = Math.ceil(reviews.length / limit);
    const start = (page - 1) * limit;
    const slice = reviews.slice(start, start + limit);

    slice.forEach((r) => {
      const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
      const comment =
        containerId === 'reviews-container' && r.comment?.length > 120
          ? r.comment.slice(0, 120) + '... <em>(read more)</em>'
          : r.comment || '';

      const el = document.createElement('blockquote');
      el.className = 'review';
      el.innerHTML = `
        <p>"${comment}"</p>
        <cite>— ${r.author_name || 'Anonymous'}</cite>
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
// Featured Listings
// =============================
async function loadFeaturedListings() {
  try {
    const res = await fetch('/api/listings?status=active');
    if (!res.ok) throw new Error(`Failed to fetch listings: ${res.status} ${res.statusText}`);
    const listings = await res.json();

    const grid = $('.listings-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!Array.isArray(listings) || listings.length === 0) {
      grid.innerHTML = '<p>No active listings at this time.</p>';
      return;
    }

    listings.forEach((l) => {
      const photo = l.photos?.[0]?.url || 'assets/placeholder.jpg';
      const price = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(l.price);

      const article = document.createElement('article');
      article.className = 'listing';
      article.dataset.id = l.id;
      article.innerHTML = `
        <img src="${photo}" alt="${l.address}" loading="lazy">
        <h3>${l.address}</h3>
        <p>${l.beds} bed • ${l.baths} bath • ${l.sqft} sqft</p>
        <p class="price">${price}</p>
        ${l.status === 'closed' ? '<span class="sold">SOLD</span>' : ''}
      `;
      grid.appendChild(article);
    });

    const viewAll = $('#view-all-listings');
    if (viewAll) viewAll.style.display = listings.length ? 'block' : 'none';
  } catch (err) {
    console.error('loadFeaturedListings error:', err.message, err.stack);
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
      const photo = l.photos?.[0]?.url || 'assets/placeholder.jpg';
      const price = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(l.price);

      const article = document.createElement('article');
      article.className = 'listing';
      article.dataset.id = l.id;
      article.innerHTML = `
        <img src="${photo}" alt="${l.address}" loading="lazy">
        <h3>${l.address}, ${l.city} ${l.zip}</h3>
        <p>${l.beds} bed • ${l.baths} bath • ${l.sqft} sqft • ${price}</p>
        ${l.status === 'closed' ? '<span class="sold">SOLD</span>' : ''}
      `;
      container.appendChild(article);
    });
  } catch (err) {
    console.error('loadAllListings error:', err.message, err.stack);
    const container = $('#all-listings-container');
    if (container) container.innerHTML = '<p>Error loading listings. Please try again later.</p>';
  }
}

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