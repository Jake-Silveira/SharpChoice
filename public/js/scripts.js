// =============================
// UTILS & HELPERS
// =============================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Generic fetch with auth
async function apiFetch(url, options = {}) {
  const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
  const token = session.access_token || '';
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

// Fetch listings (public or filtered)
async function fetchListings(filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await apiFetch(`/api/listings?${params}`);
  if (!res.ok) throw new Error('Failed to fetch listings');
  return res.json();
}

// PATCH any listing
async function patchListing(id, updates) {
  const res = await apiFetch(`/api/listings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Update failed');
  }
  return res.json();
}

// Load featured (active) listings
async function loadFeaturedListings() {
  const container = $('#featured-listings .grid');
  if (!container) return;

  try {
    const listings = await fetchListings({ status: 'active' });
    container.innerHTML = '';
    if (listings.length === 0) {
      container.innerHTML = '<p>No active listings.</p>';
      return;
    }

    listings.forEach(l => {
      const photo = l.photos?.[0]?.url || '/assets/placeholder.jpg';
      const price = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0
      }).format(l.price);

      const article = document.createElement('article');
      article.className = 'listing';
      article.innerHTML = `
        <img src="${photo}" alt="${l.address}" loading="lazy">
        <h3>${l.address}</h3>
        <p>${l.beds} bed • ${l.baths} bath • ${l.sqft} sqft</p>
        <p class="price">${price}</p>
        <span class="status-badge status-active">For Sale</span>
      `;
      container.appendChild(article);
    });
  } catch (err) {
    console.error('loadFeaturedListings error:', err);
    container.innerHTML = '<p>Error loading listings.</p>';
  }
}

// Load all listings (modal)
async function loadAllListings() {
  const container = $('#all-listings-container');
  if (!container) return;

  try {
    const listings = await fetchListings();
    container.innerHTML = '';
    if (listings.length === 0) {
      container.innerHTML = '<p>No listings yet.</p>';
      return;
    }

    listings.forEach(l => {
      const photo = l.photos?.[0]?.url || '/assets/placeholder.jpg';
      const price = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0
      }).format(l.price);

      const article = document.createElement('article');
      article.className = 'listing';
      const statusBadge = l.status === 'closed'
        ? '<span class="status-badge status-closed">SOLD</span>'
        : '<span class="status-badge status-active">For Sale</span>';

      article.innerHTML = `
        <img src="${photo}" alt="${l.address}" loading="lazy">
        <h3>${l.address}, ${l.city} ${l.zip}</h3>
        <p>${l.beds} bed • ${l.baths} bath • ${l.sqft} sqft</p>
        <p class="price">${price}</p>
        ${statusBadge}
      `;
      container.appendChild(article);
    });
  } catch (err) {
    console.error('loadAllListings error:', err);
    container.innerHTML = '<p>Error loading listings.</p>';
  }
}

// Load reviews (homepage)
async function loadReviews(page = 1, limit = 3, containerId = 'reviews-container') {
  if (!supabase) return console.warn('Supabase not ready');

  try {
    const res = await fetch('/api/reviews');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const reviews = await res.json();

    const container = $(`#${containerId}`);
    if (!container) return;

    container.innerHTML = '';
    if (!Array.isArray(reviews) || reviews.length === 0) {
      container.innerHTML = '<p>No reviews yet.</p>';
      return;
    }

    const start = (page - 1) * limit;
    const slice = reviews.slice(start, start + limit);

    slice.forEach(r => {
      const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
      const comment = containerId === 'reviews-container' && r.comment?.length > 120
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

    // Pagination (modal only)
    if (containerId === 'modal-reviews-container') {
      const pagination = $('.review-pagination');
      if (!pagination) return;
      const totalPages = Math.ceil(reviews.length / limit);
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
    console.error('loadReviews error:', err);
    $(`#${containerId}`)?.insertAdjacentHTML('beforeend', '<p>Error loading reviews.</p>');
  }
}

// Load admin listings table
async function loadAdminListings() {
  const container = $('#admin-listings-container');
  if (!container) return;

  try {
    const listings = await fetchListings();
    if (!Array.isArray(listings) || listings.length === 0) {
      container.innerHTML = '<p>No listings yet.</p>';
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>Address</th>
            <th>Price</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    listings.forEach(l => {
      const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(l.price);
      const statusText = l.status === 'closed' ? 'SOLD' : 'Active';
      const statusClass = l.status === 'closed' ? 'status-closed' : 'status-active';
      const toggleColor = l.status === 'closed' ? '#28a745' : 'var(--color-error)';

      html += `
        <tr>
          <td>${l.address}, ${l.city}</td>
          <td>${price}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button class="table-action-btn" onclick="openEditListing('${l.id}')">Edit</button>
            <button class="table-action-btn" style="background:${toggleColor};"
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

// Toggle status (quick action)
async function toggleListingStatus(id, currentStatus) {
  const action = currentStatus === 'closed' ? 'activate' : 'mark as SOLD';
  if (!confirm(`Are you sure you want to ${action} this listing?`)) return;

  const newStatus = currentStatus === 'closed' ? 'active' : 'closed';

  try {
    await patchListing(id, { status: newStatus });
    alert(`Listing ${newStatus === 'closed' ? 'marked SOLD' : 'activated'}!`);
    loadAdminListings();
    loadFeaturedListings();
    loadAllListings();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// Open edit modal
async function openEditListing(id) {
  const modal = $('#edit-listing-modal');
  if (!modal) return;

  try {
    const res = await apiFetch(`/api/listings/${id}`);
    if (!res.ok) throw new Error('Failed to load listing');
    const listing = await res.json();

    $('#edit-listing-id').value = listing.id;
    $('#edit-address').value = listing.address || '';
    $('#edit-city').value = listing.city || '';
    $('#edit-state').value = listing.state || '';
    $('#edit-zip').value = listing.zip || '';
    $('#edit-price').value = listing.price || '';
    $('#edit-beds').value = listing.beds || '';
    $('#edit-baths').value = listing.baths || '';
    $('#edit-sqft').value = listing.sqft || '';
    $('#edit-status').value = listing.status || 'active';
    $('#edit-metadata').value = JSON.stringify(listing.metadata || {}, null, 2);

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    alert('Failed to load listing: ' + err.message);
  }
}

// Close edit modal
function closeEditListing() {
  const modal = $('#edit-listing-modal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// =============================
// EVENT LISTENERS
// =============================

// Contact Form
const contactForm = $('#contact-form');
const formStatus = $('#form-status');

if (contactForm && formStatus) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const optInChecked = $('#contact-opt-in')?.checked ?? false;
    if (!optInChecked) {
      formStatus.textContent = 'You must agree to the Privacy Policy.';
      formStatus.style.color = 'red';
      return;
    }

    formStatus.textContent = 'Sending...';
    formStatus.style.color = '';

    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData);
    payload.opt_in = optInChecked;

    try {
      const res = await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Network error');

      formStatus.textContent = 'Message sent! We’ll be in touch soon.';
      formStatus.style.color = 'green';
      contactForm.reset();
      setTimeout(() => (formStatus.textContent = ''), 5000);
    } catch (err) {
      formStatus.textContent = err.message || 'Error – please try again.';
      formStatus.style.color = 'red';
    }
  });
}

// Edit Listing Form
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

  try {
    await patchListing(id, payload);
    alert('Listing updated!');
    closeEditListing();
    loadAdminListings();
    loadFeaturedListings();
    loadAllListings();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

// Close modal buttons
$('#edit-cancel-btn, #edit-listing-modal .modal-close')?.addEventListener('click', closeEditListing);
$('#edit-listing-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'edit-listing-modal') closeEditListing();
});

// Tab Navigation
$('#listings-tab')?.addEventListener('click', () => {
  $('#reviews-section').style.display = 'none';
  $('#listings-section').style.display = 'block';
  $('#reviews-tab').classList.remove('tab-active');
  $('#listings-tab').classList.add('tab-active');
  $('#add-listing-subsection').style.display = 'block';
  $('#edit-listings-subsection').style.display = 'none';
  $('#add-listing-tab').classList.add('tab-active');
  $('#edit-listings-tab').classList.remove('tab-active');
});

$('#add-listing-tab')?.addEventListener('click', () => {
  $('#add-listing-subsection').style.display = 'block';
  $('#edit-listings-subsection').style.display = 'none';
  $('#add-listing-tab').classList.add('tab-active');
  $('#edit-listings-tab').classList.remove('tab-active');
});

$('#edit-listings-tab')?.addEventListener('click', () => {
  $('#add-listing-subsection').style.display = 'none';
  $('#edit-listings-subsection').style.display = 'block';
  $('#add-listing-tab').classList.remove('tab-active');
  $('#edit-listings-tab').classList.add('tab-active');
  loadAdminListings();
});

$('#reviews-tab')?.addEventListener('click', () => {
  $('#listings-section').style.display = 'none';
  $('#reviews-section').style.display = 'block';
  $('#listings-tab').classList.remove('tab-active');
  $('#reviews-tab').classList.add('tab-active');
});

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  loadFeaturedListings();
  loadReviews();
  loadAllListings();
});