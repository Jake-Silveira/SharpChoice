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
// Production configuration for Google Business Profile API integration
// Required environment variables:
// - GOOGLE_BUSINESS_ACCOUNT_ID: Your verified business account ID (format: "accounts/1234567890")
// - GOOGLE_CLIENT_EMAIL: Service account email from Google Cloud Console
// - GOOGLE_PRIVATE_KEY: Service account private key (with newlines replaced by \n)
// Optional:
// - GOOGLE_API_KEY: API key for fallback (if using API key auth instead of OAuth)
const GOOGLE_BUSINESS_ACCOUNT_ID = process.env.GOOGLE_BUSINESS_ACCOUNT_ID || '';
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || '';
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
      connectSrc: ["'self'", "https://*.supabase.co", "https://*.supabase.com", "https://api.resend.com", "https://cdn.jsdelivr.net"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
})); // Add security headers with custom CSP
app.use(express.json({ limit: "10mb" })); // Support base64 image uploads
app.use(express.static(path.join(__dirname, "../frontend")));

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

// Rate limiter for Google Reviews sync (more restrictive - admin operation)
const syncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 sync requests per hour
  message: {
    error: 'Too many sync requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
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

// === Test Google Access (Development/Debug Only) ===
// Remove this endpoint in production or protect it properly
app.get("/api/test-google-access", requireAuth, async (req, res) => {
  console.log('[Test] Testing Google Business Profile access...');
  
  const accountId = GOOGLE_BUSINESS_ACCOUNT_ID?.replace('accounts/', '') || '';
  
  if (!accountId || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    return res.status(400).json({
      error: 'Missing Google credentials',
      configured: {
        account_id: !!accountId,
        client_email: !!GOOGLE_CLIENT_EMAIL,
        private_key: !!GOOGLE_PRIVATE_KEY,
      }
    });
  }
  
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_CLIENT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/business.manage'],
    });

    const client = await auth.getClient();
    const businessprofile = google.mybusinessbusinessinformation('v1');
    
    // Test account access
    const accountResponse = await businessprofile.accounts.get({
      name: `accounts/${accountId}`,
      auth: client,
    });
    
    // Test reviews access
    const response = await businessprofile.accounts.locations.reviews.list({
      name: `accounts/${accountId}/locations/${accountId}`,
      auth: client,
    });

    const reviews = response.data.reviews || [];
    
    res.json({
      success: true,
      message: 'Google Business Profile access verified',
      account_name: accountResponse.data.accountName,
      reviews_count: reviews.length,
      sample_review: reviews.length > 0 ? {
        author: reviews[0].author?.displayName,
        rating: reviews[0].starRating,
      } : null,
    });
    
  } catch (err) {
    console.error('[Test] Google access test failed:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      help: getGoogleAccessHelp(err.message),
    });
  }
});

// Helper function to provide specific help based on error
function getGoogleAccessHelp(errorMessage) {
  if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED')) {
    return {
      issue: 'Service account lacks permission to access Business Profile',
      fix: 'Grant access via API Explorer: https://developers.google.com/my-business/content/api-explorer#v1/accounts/{name}/members/create',
      steps: [
        'Click "Try this API" and sign in',
        `Set name to: accounts/${GOOGLE_BUSINESS_ACCOUNT_ID.replace('accounts/', '')}`,
        'Set request body: {"role": "OWNER", "account": {"type": "SERVICE_ACCOUNT", "email": "' + GOOGLE_CLIENT_EMAIL + '"}}',
        'Click "Execute"'
      ]
    };
  }
  if (errorMessage.includes('401') || errorMessage.includes('UNAUTHENTICATED')) {
    return {
      issue: 'Authentication failed - invalid credentials',
      fix: 'Regenerate service account key in Google Cloud Console',
      steps: [
        'Go to https://console.cloud.google.com/apis/credentials',
        'Find your service account',
        'Delete old key and create new one',
        'Update GOOGLE_PRIVATE_KEY in Render environment variables'
      ]
    };
  }
  if (errorMessage.includes('404') || errorMessage.includes('NOT_FOUND')) {
    return {
      issue: 'Business account not found',
      fix: 'Verify your GOOGLE_BUSINESS_ACCOUNT_ID',
      steps: [
        'Go to https://businessprofile.google.com/',
        'Select your business',
        'Copy the account ID from the URL',
        'Update GOOGLE_BUSINESS_ACCOUNT_ID in Render'
      ]
    };
  }
  return {
    issue: 'Unknown error',
    fix: 'Check server logs for details'
  };
}

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
    } catch (emailErr) {
      console.error("Failed to send admin notification email:", emailErr);
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

// === Google Reviews Sync ===

/**
 * Get authenticated Google client using OAuth 2.0 service account
 * @returns {Promise<google.auth.GoogleAuth>} Authenticated Google auth client
 */
function getGoogleAuthClient() {
  if (!GOOGLE_BUSINESS_ACCOUNT_ID) {
    throw new Error("GOOGLE_BUSINESS_ACCOUNT_ID is not configured");
  }

  // Prefer service account authentication (production-ready)
  if (GOOGLE_CLIENT_EMAIL && GOOGLE_PRIVATE_KEY) {
    try {
      // Format private key - replace escaped newlines with actual newlines
      const formattedKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: GOOGLE_CLIENT_EMAIL,
          private_key: formattedKey,
        },
        scopes: ['https://www.googleapis.com/auth/business.manage'],
      });

      return auth;
    } catch (err) {
      console.error("Failed to initialize Google OAuth client:", err.message);
      throw new Error("Failed to initialize Google OAuth client. Check your service account credentials.");
    }
  }

  // Fallback to API key (not recommended for production)
  if (GOOGLE_API_KEY) {
    console.warn("WARNING: Using API key authentication is less secure. Consider using service account credentials.");
    return null; // Will use API key directly in API calls
  }

  throw new Error(
    "Google API credentials not configured. Please set either:\n" +
    "1. Service account: GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY (recommended)\n" +
    "2. API key: GOOGLE_API_KEY (fallback, less secure)\n" +
    "Also ensure GOOGLE_BUSINESS_ACCOUNT_ID is set."
  );
}

/**
 * Fetch reviews from Google Business Profile API
 * @returns {Promise<Array>} Array of Google review objects
 */
async function fetchGoogleReviews() {
  try {
    const auth = getGoogleAuthClient();
    
    // Initialize Google Business Profile API client
    const businessprofile = google.mybusinessbusinessinformation('v1');

    // Extract account ID from the full resource name if needed
    // Format can be "accounts/1234567890" or just "1234567890"
    const accountId = GOOGLE_BUSINESS_ACCOUNT_ID.replace('accounts/', '');
    const locationId = accountId; // Typically location ID matches account ID for single-location businesses

    let response;
    
    if (auth) {
      // Use OAuth 2.0 service account authentication
      const authClient = await auth.getClient();
      response = await businessprofile.accounts.locations.reviews.list({
        name: `accounts/${accountId}/locations/${locationId}`,
        auth: authClient,
      });
    } else {
      // Fallback to API key authentication
      response = await businessprofile.accounts.locations.reviews.list({
        name: `accounts/${accountId}/locations/${locationId}`,
        key: GOOGLE_API_KEY,
      });
    }

    const reviews = response.data.reviews || [];
    console.log(`Successfully fetched ${reviews.length} reviews from Google Business Profile`);
    return reviews;
  } catch (err) {
    console.error("Google Business Profile API error:", err.message);
    
    // Provide more specific error messages
    if (err.message.includes('403')) {
      throw new Error("Access denied. Ensure your Google service account has the 'business.manage' scope and proper permissions.");
    }
    if (err.message.includes('404')) {
      throw new Error("Business account not found. Verify your GOOGLE_BUSINESS_ACCOUNT_ID is correct.");
    }
    if (err.message.includes('401')) {
      throw new Error("Authentication failed. Check your Google service account credentials.");
    }
    
    throw new Error(`Failed to fetch Google reviews: ${err.message}`);
  }
}

/**
 * Parse a Google review object into our database schema
 * @param {Object} googleReview - Raw Google review object
 * @returns {Object} Parsed review data
 */
function parseGoogleReview(googleReview) {
  return {
    author_name: googleReview.author?.displayName || 'Anonymous',
    comment: googleReview.comment?.text || '',
    rating: googleReview.starRating || 5,
    google_review_id: googleReview.name || null, // Store Google's review ID for deduplication
    review_time: googleReview.createTime ? new Date(googleReview.createTime).toISOString() : new Date().toISOString(),
    language_code: googleReview.languageCode || 'en',
  };
}

/**
 * POST endpoint to sync Google reviews to Supabase
 * Requires authentication and rate limiting
 */
app.post("/api/sync-google-reviews", syncLimiter, requireAuth, async (req, res) => {
  const syncStartTime = Date.now();
  console.log(`[Google Sync] Starting review sync at ${new Date().toISOString()}`);

  try {
    // Fetch reviews from Google
    const googleReviews = await fetchGoogleReviews();

    if (!googleReviews || googleReviews.length === 0) {
      console.log("[Google Sync] No reviews found on Google");
      return res.json({
        success: true,
        message: "No reviews found on Google",
        synced: 0,
        updated: 0,
        total: 0,
        duration_ms: Date.now() - syncStartTime,
      });
    }

    console.log(`[Google Sync] Processing ${googleReviews.length} reviews from Google`);

    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Process each Google review
    for (const googleReview of googleReviews) {
      try {
        const reviewData = parseGoogleReview(googleReview);

        // Check if review already exists by Google review ID
        const { data: existingReviews, error: fetchError } = await supabase
          .from("reviews")
          .select("id")
          .eq("google_review_id", reviewData.google_review_id)
          .limit(1);

        if (fetchError) {
          console.error(`[Google Sync] Error checking existing review:`, fetchError.message);
          errorCount++;
          continue;
        }

        if (existingReviews && existingReviews.length > 0) {
          // Update existing review
          const { error: updateError } = await supabase
            .from("reviews")
            .update({
              rating: reviewData.rating,
              comment: reviewData.comment,
              author_name: reviewData.author_name,
              status: 'confirmed', // Ensure Google reviews are always confirmed
            })
            .eq("id", existingReviews[0].id);

          if (updateError) {
            console.error(`[Google Sync] Error updating review ${existingReviews[0].id}:`, updateError.message);
            errorCount++;
          } else {
            updatedCount++;
            syncedCount++;
          }
        } else {
          // Insert new review
          const { error: insertError } = await supabase
            .from("reviews")
            .insert([{
              author_name: reviewData.author_name,
              comment: reviewData.comment,
              rating: reviewData.rating,
              google_review_id: reviewData.google_review_id,
              created_at: reviewData.review_time,
              status: 'confirmed', // Google reviews are auto-confirmed
            }]);

          if (insertError) {
            console.error(`[Google Sync] Error inserting review:`, insertError.message);
            errorCount++;
          } else {
            syncedCount++;
          }
        }
      } catch (reviewErr) {
        console.error(`[Google Sync] Error processing individual review:`, reviewErr.message);
        errorCount++;
      }
    }

    const syncDuration = Date.now() - syncStartTime;
    console.log(`[Google Sync] Complete: ${syncedCount} processed, ${updatedCount} updated, ${errorCount} errors (${syncDuration}ms)`);

    res.json({
      success: true,
      message: `Successfully synced ${syncedCount} reviews from Google`,
      synced: syncedCount,
      updated: updatedCount,
      errors: errorCount,
      total: googleReviews.length,
      duration_ms: syncDuration,
    });

  } catch (err) {
    const syncDuration = Date.now() - syncStartTime;
    console.error(`[Google Sync] Failed after ${syncDuration}ms:`, err.message);
    
    res.status(500).json({
      error: "Failed to sync Google reviews",
      details: err.message,
      duration_ms: syncDuration,
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
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});