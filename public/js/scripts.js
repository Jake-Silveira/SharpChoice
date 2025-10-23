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
// Reviews with Stars + Pagination
// =============================
async function loadReviews(page = 1, limit = 3) {
  try {
    const res = await fetch("/api/reviews");
    const reviews = await res.json();
    const container = $("#reviews-container");
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

      blockquote.innerHTML = `
        <p>"${comment}"</p>
        <cite>— ${author_name}</cite>
        <div class="review-stars" style="color:#f5a623;">${stars}</div>
      `;
      container.appendChild(blockquote);
    });

    // Pagination controls
    const totalPages = Math.ceil(reviews.length / limit);
    const pagination = document.createElement("div");
    pagination.className = "review-pagination";
    pagination.style.marginTop = "1rem";
    pagination.style.textAlign = "center";

    pagination.innerHTML = `
      <button ${page === 1 ? "disabled" : ""} class="review-prev">Prev</button>
      <span>Page ${page} of ${totalPages}</span>
      <button ${page === totalPages ? "disabled" : ""} class="review-next">Next</button>
    `;

    container.appendChild(pagination);

    pagination.querySelector(".review-prev")?.addEventListener("click", () => loadReviews(page - 1, limit));
    pagination.querySelector(".review-next")?.addEventListener("click", () => loadReviews(page + 1, limit));

  } catch (err) {
    console.error("Error loading reviews:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => loadReviews());
