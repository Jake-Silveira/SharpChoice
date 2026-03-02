# Google Business Profile Integration Guide

This guide walks you through setting up Google Reviews sync for SharpChoice Real Estate.

## Overview

The application can automatically pull reviews from your Google Business Profile and display them on your website. This requires setting up Google Cloud credentials.

## Prerequisites

- A verified Google Business Profile for "Sharp Choice Real Estate"
- A Google Cloud Platform project
- Admin access to your Google Business Profile

## Setup Steps

### Step 1: Get Your Google Business Account ID

1. Go to [Google Business Profile](https://businessprofile.google.com/)
2. Your account ID is visible in the URL when managing your profile
3. Alternatively, use the [Business Profile API Explorer](https://developers.google.com/business-profile/apis/explorer) to list your accounts
4. The ID format is: `accounts/1234567890` (you can use with or without the `accounts/` prefix)

### Step 2: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it (e.g., "SharpChoice Real Estate")
4. Click "Create"

### Step 3: Enable the Business Profile API

1. In your Google Cloud project, go to "APIs & Services" → "Library"
2. Search for "Google Business Profile API"
3. Click on it and press "Enable"

### Step 4: Create a Service Account (Recommended)

**Why Service Account?**
- More secure than API keys
- Better for automated/server-to-server communication
- Supports proper OAuth 2.0 authentication

**Create the Service Account:**

1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "Service account"
3. Fill in:
   - **Service account name**: `sharpchoice-reviews-sync`
   - **Service account ID**: Auto-generated (e.g., `sharpchoice-reviews-sync@your-project.iam.gserviceaccount.com`)
   - **Description**: "Sync Google Reviews to SharpChoice website"
4. Click "Create and continue"
5. Skip role assignment (not needed for this use case)
6. Click "Done"

**Create a Key for the Service Account:**

1. Click on the newly created service account
2. Go to the "Keys" tab
3. Click "+ ADD KEY" → "Create new key"
4. Select **JSON** format
5. Click "Create"
6. A JSON file will download to your computer - **keep this secure!**

**Extract Credentials from JSON:**

Open the downloaded JSON file. You'll see:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n",
  "client_email": "sharpchoice-reviews-sync@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  ...
}
```

You need:
- `client_email` → Use for `GOOGLE_CLIENT_EMAIL`
- `private_key` → Use for `GOOGLE_PRIVATE_KEY`

**Important:** The private key contains actual newlines. When adding to your `.env` file, replace newlines with `\n`.

### Step 5: Grant Access to Your Business Profile

The service account needs permission to access your Google Business Profile:

1. Go to [Google Business Profile](https://businessprofile.google.com/)
2. Select your business location
3. Click "Users" or "Access settings"
4. Click "+ Invite user"
5. Enter the service account email (from `client_email`)
6. Assign **Owner** or **Manager** role
7. Send invitation
8. Accept the invitation (you may need to do this programmatically or via the API)

### Step 6: Configure Environment Variables

In your `backend/.env` file, add:

```env
# Google Business Profile - Service Account (Recommended)
GOOGLE_BUSINESS_ACCOUNT_ID=accounts/your_account_id_here
GOOGLE_CLIENT_EMAIL=sharpchoice-reviews-sync@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

**Important Notes:**
- The private key must be on a single line with `\n` representing newlines
- Wrap the key in quotes in your `.env` file
- Keep your `.env` file secure and never commit it to Git

### Step 7: Test the Integration

1. Start your server: `cd backend && npm start`
2. Log in to the admin dashboard
3. Navigate to the Reviews section
4. Click the "🔄 Pull Google Reviews" button
5. Check the server logs for any errors

**Expected Output:**
```
[Google Sync] Starting review sync at 2026-03-02T...
Successfully fetched X reviews from Google Business Profile
[Google Sync] Processing X reviews from Google
[Google Sync] Complete: X processed, Y updated, Z errors (XXXms)
```

## Alternative: API Key Authentication (Not Recommended)

If you can't use a service account, you can use an API key instead:

1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "API key"
3. Copy the API key
4. Click "Edit API key" → "API restrictions"
5. Select "Restrict key" → Choose "Google Business Profile API"
6. Save
7. In your `.env` file:
   ```env
   GOOGLE_BUSINESS_ACCOUNT_ID=your_account_id
   GOOGLE_API_KEY=your_api_key_here
   ```

**⚠️ Warning:** API keys are less secure and should be properly restricted.

## Troubleshooting

### Error: "Access denied" (403)
- Ensure the service account has access to your Business Profile
- Verify the API is enabled in your Google Cloud project
- Check that the correct scopes are used: `https://www.googleapis.com/auth/business.manage`

### Error: "Business account not found" (404)
- Verify your `GOOGLE_BUSINESS_ACCOUNT_ID` is correct
- Try both formats: `1234567890` and `accounts/1234567890`
- Ensure the service account has accepted the Business Profile invitation

### Error: "Authentication failed" (401)
- Check your service account credentials
- Ensure the private key is formatted correctly (with `\n` for newlines)
- Verify the service account email is correct

### No Reviews Synced
- Ensure your business has reviews on Google
- Check the API response in server logs
- Verify the account ID matches the correct business location

## Security Best Practices

1. **Never commit credentials**: Keep `.env` files out of version control
2. **Use service accounts**: Prefer OAuth 2.0 service accounts over API keys
3. **Restrict access**: Only grant necessary permissions to the service account
4. **Rotate keys**: Periodically regenerate service account keys
5. **Monitor usage**: Check Google Cloud Console for unusual API activity

## Rate Limits

The sync endpoint is rate-limited to:
- **10 requests per hour** per IP address
- This prevents abuse and stays within Google's API quotas

## Manual Sync vs. Automated

Currently, the sync must be triggered manually from the admin dashboard. For automated syncing:

1. Use a cron job to call the `/api/sync-google-reviews` endpoint
2. Use a service like GitHub Actions, AWS Lambda, or a cron server
3. Include the admin auth token in the request header

Example cron (daily sync):
```bash
0 2 * * * curl -X POST http://your-server.com/api/sync-google-reviews \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Support

For issues with the Google Business Profile API:
- [Official Documentation](https://developers.google.com/business-profile/apis)
- [API Reference](https://developers.google.com/business-profile/apis/reference/rest)
- [Support Forum](https://support.google.com/business/)
