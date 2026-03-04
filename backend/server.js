// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import validator from "validator";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { google } from "googleapis";

const app = express();
const PORT = process.env.PORT || 3000;

// === Resolve __dirname for ESM ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Middleware ===
// Trust proxy for proper rate limiting behind Render's load balancer
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://www.googletagmanager.com"],
      imgSrc: ["'self'", "data:", "https://*.supabase.co", "https://*.supabase.com", "https://www.google-analytics.com", "https://www.googletagmanager.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://*.supabase.co", "https://*.supabase.com", "https://api.resend.com", "https://cdn.jsdelivr.net", "https://www.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
})); // Add security headers with custom CSP
app.use(express.json({ limit: "10mb" })); // Support base64 image uploads
app.use(express.static(path.join(__dirname, "../frontend")));

// === Serve robots.txt and sitemap.xml ===
app.get("/robots.txt", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.sendFile(path.join(__dirname, "../frontend/robots.txt"));
});

app.get("/sitemap.xml", (req, res) => {
  res.setHeader("Content-Type", "application/xml");
  res.sendFile(path.join(__dirname, "../frontend/sitemap.xml"));
});

// === Clients ===
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// === Rate limiting configurations ===
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 contact requests per windowMs
  message: {
    error: 'Too many contact requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// === Sanitization utility functions ===
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return validator.escape(validator.trim(input));
}

function sanitizeReviewInput(reviewData) {
  return {
    author_name: sanitizeInput(reviewData.author_name) || '',
    comment: sanitizeInput(reviewData.comment) || '',
    rating: Number(reviewData.rating) || 0
  };
}

function sanitizeListingInput(listingData) {
  return {
    address: sanitizeInput(listingData.address) || '',
    city: sanitizeInput(listingData.city) || '',
    state: sanitizeInput(listingData.state) || '',
    zip: sanitizeInput(listingData.zip) || '',
    price: Number(listingData.price) || 0,
    beds: Number(listingData.beds) || 0,
    baths: Number(listingData.baths) || 0,
    sqft: Number(listingData.sqft) || 0,
    status: sanitizeInput(listingData.status) || 'active',
    photos: Array.isArray(listingData.photos) ? listingData.photos : [],
    metadata: typeof listingData.metadata === 'object' ? listingData.metadata : {}
  };
}

// === Health Check ===
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// === JWT Auth Middleware (for admin routes) ===
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = user;
  next();
}

// === Reviews API ===
app.get("/api/reviews", async (req, res) => {
  try {
    // Only return confirmed reviews for public display
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("status", "confirmed")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Fetch reviews error:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Public review submission (goes to pending status)
app.post("/api/reviews/submit", async (req, res) => {
  let { author_name, email, comment, rating } = req.body;

  // Sanitize inputs
  author_name = sanitizeInput(author_name);
  email = validator.isEmail(email) ? validator.normalizeEmail(email) : '';
  comment = sanitizeInput(comment);
  rating = Number(rating);

  if (!author_name || !email || !comment || rating == null || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Missing or invalid fields: author_name, email, comment, rating (1-5)" });
  }

  try {
    // Insert with 'pending' status
    const { error } = await supabase
      .from("reviews")
      .insert([{ 
        author_name, 
        comment, 
        rating,
        email, // Store email for admin reference (not displayed publicly)
        status: 'pending' 
      }]);

    if (error) throw error;

    // Send email notification to admin
    try {
      await resend.emails.send({
        from: "Website Reviews <contact@sharpchoicerealestate.com>",
        to: "sharpchoicerealestate@gmail.com",
        reply_to: email,
        subject: `New Review Submission from ${author_name}`,
        html: `
          <h2>New Review Pending Approval</h2>
          <p><strong>From:</strong> ${author_name} (${email})</p>
          <p><strong>Rating:</strong> ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)</p>
          <p><strong>Comment:</strong></p>
          <blockquote style="background:#f8f9fa; padding:1rem; border-left:4px solid #b8a89f; margin:1rem 0;">
            "${comment}"
          </blockquote>
          <p style="color:#666; font-size:0.9rem;">
            Log in to the admin dashboard to approve or delete this review.
          </p>
        `,
      });

      // Send thank you email to reviewer
      await resend.emails.send({
        from: "Sharp Choice Real Estate <contact@sharpchoicerealestate.com>",
        to: email,
        subject: "Thank You for Your Review!",
        html: `
          <h2>Thank You for Your Review, ${author_name}!</h2>
          <p>We truly appreciate you taking the time to share your experience with Sharp Choice Real Estate.</p>
          <p>Your review helps us serve our clients better and helps others in the community learn about our services.</p>
          
          <h3>Your Review Details:</h3>
          <p><strong>Rating:</strong> ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)</p>
          <blockquote style="background:#f8f9fa; padding:1rem; border-left:4px solid #b8a89f; margin:1rem 0;">
            "${comment}"
          </blockquote>
          
          <p><strong>What happens next?</strong></p>
          <p>Your review will be posted to our website after a brief review process (usually within 24-48 hours).</p>
          
          <p style="color:#666; font-size:0.9rem; margin-top:2rem;">
            <em>This is an automated confirmation. Please do not reply directly to this email.</em><br>
            <strong>Sharp Choice Real Estate</strong><br>
            Stephanie Sharp - Real Estate Broker<br>
            Austin, TX | Phone: <a href="tel:+15125672807">+1-512-567-2807</a><br>
            www.sharpchoicerealestate.com
          </p>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send review emails:", emailErr);
      // Don't fail the request if email fails
    }

    res.json({ success: true, message: "Review submitted for approval" });
  } catch (err) {
    console.error("Submit review error:", err);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

app.post("/api/reviews", requireAuth, async (req, res) => {
  let { author_name, comment, rating } = req.body;

  // Sanitize inputs
  const sanitizedData = sanitizeReviewInput({ author_name, comment, rating });
  author_name = sanitizedData.author_name;
  comment = sanitizedData.comment;
  rating = sanitizedData.rating;

  if (!author_name || !comment || rating == null) {
    return res.status(400).json({ error: "Missing fields: author_name, comment, or rating" });
  }

  try {
    // Admin-added reviews are auto-confirmed
    const { error } = await supabase
      .from("reviews")
      .insert([{ author_name, comment, rating: Number(rating), status: 'confirmed' }]);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Add review error:", err);
    res.status(500).json({ error: "Failed to add review" });
  }
});

// === Pending Reviews (Admin Only) ===
app.get("/api/reviews/pending", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("id, author_name, comment, rating, email, created_at, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Fetch pending reviews error:", err);
    res.status(500).json({ error: "Failed to fetch pending reviews" });
  }
});

// Approve or delete pending review (Admin Only)
app.post("/api/reviews/:id/approve", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from("reviews")
      .update({ status: 'confirmed' })
      .eq("id", id);

    if (error) throw error;
    res.json({ success: true, message: "Review approved" });
  } catch (err) {
    console.error("Approve review error:", err);
    res.status(500).json({ error: "Failed to approve review" });
  }
});

app.post("/api/reviews/:id/delete", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // Soft delete by setting status to 'deleted'
    const { error } = await supabase
      .from("reviews")
      .update({ status: 'deleted' })
      .eq("id", id);

    if (error) throw error;
    res.json({ success: true, message: "Review deleted" });
  } catch (err) {
    console.error("Delete review error:", err);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// === Contact Form API ===
app.post("/api/contact", contactLimiter, async (req, res) => {
  let { name, email, message, opt_in } = req.body;

  // Sanitize inputs
  name = sanitizeInput(name);
  email = validator.isEmail(email) ? validator.normalizeEmail(email) : '';
  message = sanitizeInput(message);
  opt_in = Boolean(opt_in);

  // Validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Missing required fields: name, email, or message" });
  }

  if (!opt_in) {
    return res.status(400).json({ error: "You must agree to the Privacy Policy to submit" });
  }

  try {
    // Save to Supabase contacts table
    const { error: insertError } = await supabase
      .from("contacts")
      .insert([{
        name,
        email,
        message,
        opt_in,
        created_at: new Date().toISOString()
      }]);

    if (insertError) throw insertError;

    // Send email notification to admin
    try {
      await resend.emails.send({
        from: "Website Contact <contact@sharpchoicerealestate.com>",
        to: "sharpchoicerealestate@gmail.com",
        reply_to: email,
        subject: `New Contact Form Submission from ${name}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>From:</strong> ${name} (${email})</p>
          <p><strong>Message:</strong></p>
          <blockquote style="background:#f8f9fa; padding:1rem; border-left:4px solid #b8a89f; margin:1rem 0;">
            "${message}"
          </blockquote>
          <p style="color:#666; font-size:0.9rem;">
            This contact was submitted on ${new Date().toLocaleString('en-US', { 
              dateStyle: 'long', 
              timeStyle: 'short' 
            })}
          </p>
        `,
      });

      // Send auto-reply confirmation to user
      await resend.emails.send({
        from: "Sharp Choice Real Estate <contact@sharpchoicerealestate.com>",
        to: email,
        subject: "Thank you for contacting Sharp Choice Real Estate",
        html: `
          <h2>Thank You for Your Message, ${name}!</h2>
          <p>We've received your inquiry and appreciate you reaching out to Sharp Choice Real Estate.</p>
          <p>Here's a copy of your message for your records:</p>
          <blockquote style="background:#f8f9fa; padding:1rem; border-left:4px solid #b8a89f; margin:1rem 0;">
            "${message}"
          </blockquote>
          <p><strong>What happens next?</strong></p>
          <p>Stephanie or a member of our team will review your message and get back to you within 24-48 business hours.</p>
          <p>For immediate assistance, you can reach us at:</p>
          <ul>
            <li><strong>Phone:</strong> <a href="tel:+15125672807">+1-512-567-2807</a></li>
            <li><strong>Email:</strong> <a href="mailto:stephanie@sharpchoicerealestate.com">stephanie@sharpchoicerealestate.com</a></li>
          </ul>
          <p style="color:#666; font-size:0.9rem; margin-top:2rem;">
            <em>This is an automated confirmation. Please do not reply directly to this email.</em><br>
            <strong>Sharp Choice Real Estate</strong><br>
            Austin, TX | www.sharpchoicerealestate.com
          </p>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send contact form emails:", emailErr);
      // Don't fail the request if email fails
    }

    res.json({ 
      success: true, 
      message: "Thank you for your message. We'll get back to you soon." 
    });
  } catch (err) {
    console.error("Contact form submission error:", err);
    res.status(500).json({ error: "Failed to submit contact form" });
  }
});

// === Listings API ===
app.get("/api/listings", async (req, res) => {
  const { status } = req.query;
  try {
    let query = supabase.from("listings").select("*");
    if (status) query = query.eq("status", status);
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Fetch listings error:", err);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

// GET a single listing by id (admin only)
app.get("/api/listings/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Listing not found" });

    res.json(data);
  } catch (err) {
    console.error("Get listing error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/listings", requireAuth, async (req, res) => {
  let {
    address, city, state, zip, price,
    beds, baths, sqft,
    status = "active",  // default to active
    photos = [], metadata = {}
  } = req.body;

  // Sanitize inputs
  const sanitizedData = sanitizeListingInput({ 
    address, city, state, zip, price,
    beds, baths, sqft,
    status, photos, metadata
  });
  
  address = sanitizedData.address;
  city = sanitizedData.city;
  state = sanitizedData.state;
  zip = sanitizedData.zip;
  price = sanitizedData.price;
  beds = sanitizedData.beds;
  baths = sanitizedData.baths;
  sqft = sanitizedData.sqft;
  status = sanitizedData.status;
  photos = sanitizedData.photos;
  metadata = sanitizedData.metadata;

  if (!address || !city || !state || !zip || price == null || beds == null || baths == null || sqft == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!['active', 'closed'].includes(status)) {
    return res.status(400).json({ error: "Invalid status. Use 'active' or 'closed'" });
  }

  try {
    const { data, error } = await supabase
      .from("listings")
      .insert([{
        address, city, state, zip,
        price: Number(price),
        beds: Number(beds),
        baths: Number(baths),
        sqft: Number(sqft),
        status,
        photos,
        metadata
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, id: data.id });
  } catch (err) {
    console.error("Add listing error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/listings/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  let updates = req.body;

  // Sanitize inputs
  updates = sanitizeListingInput(updates);

  try {
    const { error } = await supabase
      .from("listings")
      .update(updates)
      .eq("id", id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Update listing error:", err);
    res.status(500).json({ error: err.message });
  }
});

// === Image Upload (Supabase Storage) ===
app.post("/api/upload-image", async (req, res) => {
  const { fileName, fileData } = req.body;

  if (!fileName || !fileData) {
    return res.status(400).json({ error: "Missing fileName or fileData" });
  }

  try {
    const ext = fileName.split('.').pop().toLowerCase();
    const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    const { error: uploadError } = await supabase.storage
      .from("listings-images")
      .upload(fileName, Buffer.from(fileData, "base64"), {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // FORCE PUBLIC URL
    const { data } = supabase.storage
      .from("listings-images")
      .getPublicUrl(fileName);

    if (!data?.publicUrl) throw new Error("Failed to get public URL");

    res.json({ url: data.publicUrl });
  } catch (err) {
    console.error("Upload error:", err.message || err);
    res.status(500).json({ error: "Failed to upload image: " + (err.message || "Unknown error") });
  }
});

// === SPA Fallback (must be last) ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});