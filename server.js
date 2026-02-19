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

// === Google Business Profile Configuration ===
// TODO: After Google Business account verification:
// 1. Get your Business Account ID from Google Business Profile API
// 2. Set up OAuth 2.0 credentials or API key in Google Cloud Console
// 3. Add these environment variables:
//    - GOOGLE_BUSINESS_ACCOUNT_ID: Your verified business account ID
//    - GOOGLE_API_KEY: Your Google API key with Business Profile API enabled
const GOOGLE_BUSINESS_ACCOUNT_ID = process.env.GOOGLE_BUSINESS_ACCOUNT_ID || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

// === Middleware ===
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https://*.supabase.co", "https://*.supabase.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://*.supabase.co", "https://*.supabase.com", "https://api.resend.com"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
})); // Add security headers with custom CSP
app.use(express.json({ limit: "10mb" })); // Support base64 image uploads
app.use(express.static(path.join(__dirname, "public")));

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

// === Contact Form ===
app.post("/api/contact", contactLimiter, async (req, res) => {
  let { name, email, message } = req.body;
  const opt_in = req.body.opt_in === true;  // Must be true

  // Sanitize inputs
  name = sanitizeInput(name);
  email = validator.isEmail(email) ? validator.normalizeEmail(email) : '';
  message = sanitizeInput(message);

  if (!name || !email || !message || opt_in !== true) {
    return res.status(400).json({ error: "All fields are required, including privacy consent." });
  }

  try {
    // 1. Save to Supabase
    const { error: dbError } = await supabase
      .from("contacts")
      .insert([{ name, email, message, opt_in }]);

    if (dbError) throw dbError;

    // 2. Notify business
    await resend.emails.send({
      from: "Website Contact <contact@sharpchoicerealestate.com>",
      to: "sharpchoicerealestate@gmail.com",
      reply_to: email,
      subject: `New Contact from ${name}`,
      html: `
        <h2>New Message from ${name}</h2>
        <p><strong>Email:</strong> ${email}</p>
        <p>${message}</p>
        <hr>
        <p><strong>Privacy Consent:</strong> ${opt_in ? '✅ Yes' : '❌ No'}</p>
      `,
    });

    // 3. Auto-reply to sender
    await resend.emails.send({
      from: "Sharp Choice Real Estate <no-reply@sharpchoicerealestate.com>",
      to: email,
      subject: "Thanks for reaching out!",
      html: `
        <p>Hi ${name},</p>
        <p>We’ve received your message and will get back to you shortly.</p>
        <p>– Sharp Choice Real Estate</p>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Contact error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// === Reviews API ===
app.get("/api/reviews", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Fetch reviews error:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
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
    const { error } = await supabase
      .from("reviews")
      .insert([{ author_name, comment, rating: Number(rating) }]);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Add review error:", err);
    res.status(500).json({ error: "Failed to add review" });
  }
});

// === Google Reviews Sync ===
// Helper function to fetch reviews from Google Business Profile API
async function fetchGoogleReviews() {
  if (!GOOGLE_BUSINESS_ACCOUNT_ID || !GOOGLE_API_KEY) {
    throw new Error("Google API credentials not configured. Please set GOOGLE_BUSINESS_ACCOUNT_ID and GOOGLE_API_KEY environment variables.");
  }

  try {
    // Initialize Google Business Profile API
    const businessprofile = google.mybusinessbusinessinformation('v1');
    
    // Fetch reviews for the business account
    // Note: This requires OAuth 2.0 setup with proper scopes
    // Scope needed: https://www.googleapis.com/auth/business.manage
    const response = await businessprofile.accounts.locations.reviews.list({
      name: `accounts/${GOOGLE_BUSINESS_ACCOUNT_ID}/locations/${GOOGLE_BUSINESS_ACCOUNT_ID}`,
      key: GOOGLE_API_KEY,
    });

    return response.data.reviews || [];
  } catch (err) {
    console.error("Google API error:", err.message);
    throw new Error(`Failed to fetch Google reviews: ${err.message}`);
  }
}

// Helper function to convert Google review data to our schema
function parseGoogleReview(googleReview) {
  return {
    author_name: googleReview.author?.displayName || 'Anonymous',
    comment: googleReview.comment?.text || '',
    rating: googleReview.starRating || 5,
    google_review_id: googleReview.name || null, // Store Google's review ID for deduplication
    review_time: googleReview.createTime ? new Date(googleReview.createTime).toISOString() : new Date().toISOString(),
  };
}

// POST endpoint to sync Google reviews to Supabase
app.post("/api/sync-google-reviews", requireAuth, async (req, res) => {
  console.log("Starting Google Reviews sync...");
  
  try {
    // Fetch reviews from Google
    const googleReviews = await fetchGoogleReviews();
    
    if (!googleReviews || googleReviews.length === 0) {
      return res.json({ 
        success: true, 
        message: "No reviews found on Google",
        synced: 0 
      });
    }

    console.log(`Fetched ${googleReviews.length} reviews from Google`);

    let syncedCount = 0;
    let updatedCount = 0;

    // Process each Google review
    for (const googleReview of googleReviews) {
      const reviewData = parseGoogleReview(googleReview);
      
      // Check if review already exists (by Google review ID or matching comment)
      const { data: existingReviews } = await supabase
        .from("reviews")
        .select("id")
        .eq("google_review_id", reviewData.google_review_id)
        .limit(1);

      if (existingReviews && existingReviews.length > 0) {
        // Update existing review
        const { error } = await supabase
          .from("reviews")
          .update({
            rating: reviewData.rating,
            comment: reviewData.comment,
            author_name: reviewData.author_name,
          })
          .eq("id", existingReviews[0].id);

        if (!error) {
          updatedCount++;
          syncedCount++;
        }
      } else {
        // Insert new review
        const { error } = await supabase
          .from("reviews")
          .insert([{
            author_name: reviewData.author_name,
            comment: reviewData.comment,
            rating: reviewData.rating,
            google_review_id: reviewData.google_review_id,
            created_at: reviewData.review_time,
          }]);

        if (!error) {
          syncedCount++;
        }
      }
    }

    console.log(`Sync complete: ${syncedCount} reviews processed (${updatedCount} updated)`);
    
    res.json({
      success: true,
      message: `Successfully synced ${syncedCount} reviews from Google`,
      synced: syncedCount,
      updated: updatedCount,
      total: googleReviews.length,
    });

  } catch (err) {
    console.error("Google Reviews sync error:", err.message);
    res.status(500).json({ 
      error: "Failed to sync Google reviews",
      details: err.message 
    });
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

    console.log('Uploaded image public URL:', data.publicUrl); // ← DEBUG

    res.json({ url: data.publicUrl });
  } catch (err) {
    console.error("Upload error:", err.message || err);
    res.status(500).json({ error: "Failed to upload image: " + (err.message || "Unknown error") });
  }
});

// === SPA Fallback (must be last) ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});