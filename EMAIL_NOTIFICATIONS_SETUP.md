# Email Notifications Setup Guide

## Overview
The SharpChoice Real Estate website uses **Resend** for all email notifications. This guide covers setup, configuration, and troubleshooting.

## Current Email Notifications

### 1. Contact Form Emails

#### Admin Notification
- **Trigger:** User submits contact form
- **To:** `sharpchoicerealestate@gmail.com`
- **From:** `Website Contact <contact@sharpchoicerealestate.com>`
- **Reply-To:** User's email
- **Subject:** "New Contact Form Submission from {name}"
- **Content:** User's name, email, and message

#### User Auto-Reply
- **Trigger:** User submits contact form
- **To:** User's email
- **From:** `Sharp Choice Real Estate <contact@sharpchoicerealestate.com>`
- **Subject:** "Thank you for contacting Sharp Choice Real Estate"
- **Content:** Confirmation message, copy of their message, expected response time, contact info

### 2. Review Submission Emails

#### Admin Notification
- **Trigger:** User submits a review
- **To:** `sharpchoicerealestate@gmail.com`
- **From:** `Website Reviews <contact@sharpchoicerealestate.com>`
- **Reply-To:** User's email
- **Subject:** "New Review Submission from {author_name}"
- **Content:** Reviewer's name, email, rating, comment, link to admin dashboard

#### User Auto-Reply
- **Trigger:** User submits a review
- **To:** User's email
- **From:** `Sharp Choice Real Estate <contact@sharpchoicerealestate.com>`
- **Subject:** "Thank You for Your Review!"
- **Content:** Thank you message, review details, next steps (approval process)

## Resend Setup Requirements

### Step 1: Create Resend Account
1. Go to https://resend.com
2. Sign up for an account
3. Get your API key from the dashboard

### Step 2: Add Domain to Resend (REQUIRED)

**Important:** You must add and verify your domain (`sharpchoicerealestate.com`) in Resend to send emails from `contact@sharpchoicerealestate.com`.

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter: `sharpchoicerealestate.com`
4. Add the DNS records to your domain's DNS settings:
   - **SPF Record** (TXT): `v=spf1 include:resend.com ~all`
   - **DKIM Records** (2 CNAME records provided by Resend)
5. Wait for DNS propagation (can take up to 48 hours, usually faster)
6. Once verified, the domain status will show as "Verified" in Resend

### Step 3: Update Environment Variable

In your Render dashboard (or `.env` file for local development):

```
RESEND_API_KEY=re_your_actual_api_key_here
```

### Step 4: Test Email Sending

After domain verification:
1. Deploy the updated code to Render
2. Submit a test contact form on your website
3. Check that both admin and user receive emails
4. Check spam folders if emails don't appear in inbox

## Email Customization

### Change Admin Email Recipient
Edit `backend/server.js`:
- Line ~343: Contact form admin notification
- Line ~173: Review submission admin notification

Change `"sharpchoicerealestate@gmail.com"` to your preferred email.

### Change From Address
Once your domain is verified in Resend, you can use any email @sharpchoicerealestate.com:
- `contact@sharpchoicerealestate.com` (current)
- `stephanie@sharpchoicerealestate.com`
- `info@sharpchoicerealestate.com`

Update the `from:` field in the email send calls.

### Customize Email Templates
Email HTML templates are in `backend/server.js`:
- Contact form admin notification: ~line 347
- Contact form user auto-reply: ~line 358
- Review admin notification: ~line 177
- Review user auto-reply: ~line 195

## Rate Limits

### Resend Rate Limits
- **Free Tier:** 100 emails/day, 3,000 emails/month
- **Pro Tier:** Higher limits, custom domain branding

### Contact Form Rate Limiting
The contact form endpoint has built-in rate limiting:
- **Limit:** 5 submissions per 15 minutes per IP
- **Purpose:** Prevent spam and abuse
- **Error Message:** "Too many contact requests from this IP, please try again later."

## Troubleshooting

### Emails Not Sending

1. **Check Resend Dashboard**
   - Go to https://resend.com/dashboard
   - Check for failed emails and error messages

2. **Verify Domain Status**
   - Domain must show "Verified" in Resend
   - DNS records may take time to propagate

3. **Check Server Logs**
   - In Render dashboard, check application logs
   - Look for "Failed to send emails" errors

4. **Verify API Key**
   - Ensure `RESEND_API_KEY` is set correctly in Render environment variables
   - API key should start with `re_`

### Emails Going to Spam

1. **Ensure Domain Verification**
   - SPF and DKIM records must be properly configured
   - Use a tool like https://mail-tester.com to check email deliverability

2. **Check Email Content**
   - Avoid spam trigger words
   - Include plain text alternative (optional improvement)

3. **Monitor Sender Reputation**
   - Resend handles most reputation management
   - Avoid sending to invalid emails

### Domain Verification Issues

1. **Double-check DNS Records**
   - Use a DNS lookup tool to verify records are published
   - Ensure no typos in the records

2. **Wait for Propagation**
   - DNS changes can take 24-48 hours
   - Check periodically in Resend dashboard

3. **Contact Domain Registrar**
   - Some registrars have specific DNS record requirements
   - Ensure you're adding records to the correct domain

## Database Schema

### Contacts Table
Ensure your Supabase `contacts` table has these columns:
```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  opt_in BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Cost Estimates

### Resend Pricing (as of 2024)
- **Free:** 100 emails/day, 3,000/month
- **Pro:** $20/month for 50,000 emails/month

### Estimated Usage
Based on typical real estate website traffic:
- Contact forms: ~20-50/month
- Review submissions: ~10-30/month
- Total emails (including auto-replies): ~60-160/month

**Conclusion:** Free tier should be sufficient for most use cases.

## Security Notes

- Email addresses are validated before sending
- Input is sanitized to prevent injection attacks
- Rate limiting prevents abuse
- Failed email sends don't block user submissions (graceful degradation)

## Future Enhancements

Consider these improvements:
1. **Email Templates:** Use Resend's React Email templates for better maintainability
2. **Email Analytics:** Track open rates and click-through rates
3. **Scheduled Digests:** Weekly summary emails to admin of all submissions
4. **SMS Notifications:** Integrate Twilio for urgent inquiries
