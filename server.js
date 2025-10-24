// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser middleware
app.use(express.json());

// Resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static files
app.use(express.static(path.join(__dirname, "public")));

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Supabase & Resend clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

// Contact form endpoint
app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body;

  try {
    // 1. Insert into Supabase
    const { error } = await supabase
      .from("contacts")
      .insert([{ name, email, message }]);

    if (error) throw error;

    // 2. Send notification email to business inbox
    await resend.emails.send({
      from: "Website Contact <contact@sharpchoicerealestate.com>",
      to: "sharpchoicerealestate@gmail.com",
      reply_to: email,
      subject: `New Contact from ${name}`,
      html: `
        <h2>New Message from ${name}</h2>
        <p><strong>Email:</strong> ${email}</p>
        <p>${message}</p>
      `,
    });

    // 3. Auto-reply to sender
    await resend.emails.send({
      from: "no-reply@sharpchoicerealestate.com",
      to: email,
      subject: "Thanks for reaching out!",
      html: `<p>Hi ${name},</p><p>We’ve received your message and will get back to you shortly.</p><p>– Stephanie Sharp</p>`,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// API route to get reviews
app.get("/api/reviews", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Error fetching reviews:", err.message);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// GET listings
app.get("/api/listings", async (req, res) => {
  const { status } = req.query;               // ?status=active
  try {
    let query = supabase.from("listings").select("*");
    if (status) query = query.eq("status", status);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

// POST new review (auth required - we'll handle in frontend)
app.post("/api/reviews", async (req, res) => {
  const { name, text, rating } = req.body;
  try {
    const { data, error } = await supabase.from("reviews").insert([{ name, text, rating }]);
    if (error) throw error;
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to add review" });
  }
});

// POST new listing (auth required)
app.post("/api/listings", async (req, res) => {
  const {
    address, city, state, zip, price,
    beds, baths, sqft, status = "active",
    photos = [], metadata = {}
  } = req.body;

  try {
    const { data, error } = await supabase
      .from("listings")
      .insert([{ address, city, state, zip, price, beds, baths, sqft, status, photos, metadata }])
      .single();

    if (error) throw error;
    res.json({ success: true, id: data.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST image upload (to Supabase Storage)
app.post("/api/upload-image", async (req, res) => {
  const { fileName, fileData } = req.body;  // Expect base64 data
  try {
    const { data, error } = await supabase.storage
      .from("listings-images")
      .upload(fileName, Buffer.from(fileData, "base64"), { contentType: "image/jpeg" });  // Adjust type as needed

    if (error) throw error;
    const publicUrl = supabase.storage.from("listings-images").getPublicUrl(fileName).data.publicUrl;
    res.status(200).json({ url: publicUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// PATCH – update existing listing (admin)
app.patch("/api/listings/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;   // any fields you want to change
  try {
    const { error } = await supabase
      .from("listings")
      .update(updates)
      .eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback route
app.get("*", (req, res) => {
  res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "public", "index.html"));
});