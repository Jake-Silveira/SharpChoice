// Display current year
document.getElementById('year').textContent = new Date().getFullYear();

// Handle contact form submission
const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.textContent = 'Sending...';

  const formData = Object.fromEntries(new FormData(form));

  try {
    // Replace URL below with your API endpoint or serverless function
    const res = await fetch('https://example.com/api/contact', {
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
