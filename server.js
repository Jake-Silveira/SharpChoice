const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const resend = require('resend').Resend;
const app = express();

app.use(express.json());
app.use(express.static('public'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resendClient = new resend(process.env.RESEND_API_KEY);

// Auth middleware
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  // In production, validate JWT
  next();
}

// Helper: Get listings
async function getListings(filter = {}) {
  let query = supabase.from('listings').select('*');
  Object.entries(filter).forEach(([k, v]) => query = query.eq(k, v));
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// PUBLIC: Featured listings
app.get('/api/public/listings', async (req, res) => {
  try {
    const data = await getListings({ status: 'active' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: All listings
app.get('/api/listings', requireAuth, async (req, res) => {
  const { status } = req.query;
  try {
    const data = await getListings(status ? { status } : {});
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: Single listing
app.get('/api/listings/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('listings').select('*').eq('id', id).single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: Update listing
app.patch('/api/listings/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const { error } = await supabase.from('listings').update(updates).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reviews', requireAuth, async (req, res) => {
  const { author_name, comment, rating } = req.body;
  if (!author_name || !comment || !rating) return res.status(400).json({ error: 'Missing fields' });
  try {
    const { data, error } = await supabase.from('reviews').insert([{ author_name, comment, rating }]).select().single();
    if (error) throw error;
    res.json({ success: true, id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contact
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message, opt_in } = req.body;
  if (!name || !email || !message || opt_in !== true) {
    return res.status(400).json({ error: 'All fields required including consent.' });
  }

  try {
    await supabase.from('contacts').insert([{ name, email, phone, message, opt_in }]);

    const emailHtml = `
      <h2>New Contact</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || '—'}</p>
      <p><strong>Message:</strong> ${message}</p>
      <p><strong>Consent:</strong> ${opt_in ? 'Yes' : 'No'}</p>
    `;

    await resendClient.emails.send({
      from: 'contact@sharpchoicerealestate.com',
      to: 'admin@sharpchoicerealestate.com',
      subject: 'New Contact Form Submission',
      html: emailHtml,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));