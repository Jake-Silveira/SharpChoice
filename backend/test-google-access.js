// test-google-access.js
// Run this to test your Google Business Profile credentials
// Usage: node test-google-access.js

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_BUSINESS_ACCOUNT_ID = process.env.GOOGLE_BUSINESS_ACCOUNT_ID?.replace('accounts/', '') || '';
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';

console.log('===========================================');
console.log('  Google Business Profile Access Test');
console.log('===========================================\n');

// Check environment variables
console.log('📋 Checking environment variables...');
console.log('   GOOGLE_BUSINESS_ACCOUNT_ID:', GOOGLE_BUSINESS_ACCOUNT_ID ? '✅ Set' : '❌ Missing');
console.log('   GOOGLE_CLIENT_EMAIL:', GOOGLE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing');
console.log('   GOOGLE_PRIVATE_KEY:', GOOGLE_PRIVATE_KEY ? '✅ Set' : '❌ Missing');

if (!GOOGLE_BUSINESS_ACCOUNT_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
  console.log('\n❌ ERROR: Missing environment variables!');
  console.log('   Check your backend/.env file\n');
  process.exit(1);
}

async function testAccess() {
  console.log('\n🔐 Testing authentication...');
  
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_CLIENT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY,
      },
      scopes: ['https://www.googleapis.com/auth/business.manage'],
    });

    console.log('   Creating auth client...');
    const client = await auth.getClient();
    console.log('   ✅ Auth client created successfully');
    
    const businessprofile = google.mybusinessbusinessinformation('v1');
    
    console.log('\n📍 Testing account access...');
    console.log(`   Account ID: ${GOOGLE_BUSINESS_ACCOUNT_ID}`);
    
    // Try to get account info first
    try {
      const accountResponse = await businessprofile.accounts.get({
        name: `accounts/${GOOGLE_BUSINESS_ACCOUNT_ID}`,
        auth: client,
      });
      console.log('   ✅ Account found:', accountResponse.data.accountName || 'Unknown');
    } catch (err) {
      if (err.message.includes('404')) {
        console.log('   ❌ Account not found - check your GOOGLE_BUSINESS_ACCOUNT_ID');
        console.log('\n   💡 Fix: Go to https://businessprofile.google.com/');
        console.log('      Look at the URL to find your account ID');
        console.log('      Format should be: accounts/1234567890');
      } else if (err.message.includes('403')) {
        console.log('   ❌ Access denied - service account lacks permissions');
        console.log('\n   💡 Fix: You need to grant the service account access to your Business Profile');
        console.log('      See: https://developers.google.com/my-business/content/api-explorer#v1/accounts/{name}/members/create');
      } else {
        console.log('   ❌ Error:', err.message);
      }
      process.exit(1);
    }
    
    console.log('\n⭐ Fetching reviews...');
    
    const response = await businessprofile.accounts.locations.reviews.list({
      name: `accounts/${GOOGLE_BUSINESS_ACCOUNT_ID}/locations/${GOOGLE_BUSINESS_ACCOUNT_ID}`,
      auth: client,
    });

    const reviews = response.data.reviews || [];
    console.log(`   ✅ SUCCESS! Found ${reviews.length} reviews\n`);
    
    if (reviews.length > 0) {
      console.log('📊 Sample review:');
      console.log('   ┌─────────────────────────────────────────');
      console.log(`   │ Author: ${reviews[0].author?.displayName || 'Anonymous'}`);
      console.log(`   │ Rating: ${reviews[0].starRating || 'N/A'} stars`);
      const comment = reviews[0].comment?.text || 'No comment';
      const truncated = comment.length > 80 ? comment.substring(0, 80) + '...' : comment;
      console.log(`   │ Comment: ${truncated}`);
      console.log('   └─────────────────────────────────────────');
    }
    
    console.log('\n===========================================');
    console.log('  ✅ ALL TESTS PASSED!');
    console.log('  Your Google Reviews sync is ready to use');
    console.log('===========================================\n');
    
    console.log('Next steps:');
    console.log('1. Start your server: npm start');
    console.log('2. Go to admin dashboard');
    console.log('3. Click "🔄 Pull Google Reviews" button\n');
    
  } catch (err) {
    console.log('\n===========================================');
    console.log('  ❌ TEST FAILED');
    console.log('===========================================\n');
    
    console.error('Error:', err.message);
    
    // Provide specific fixes based on error
    if (err.message.includes('403') || err.message.includes('PERMISSION_DENIED')) {
      console.log('\n📝 FIX REQUIRED: Permission Denied');
      console.log('   The service account does not have access to your Business Profile.');
      console.log('\n   Option A - Use API Explorer:');
      console.log('   1. Go to: https://developers.google.com/my-business/content/api-explorer#v1/accounts/{name}/members/create');
      console.log('   2. Click "Try this API"');
      console.log('   3. Sign in with your Google account (the one that manages the business)');
      console.log('   4. Fill in:');
      console.log(`      - name: accounts/${GOOGLE_BUSINESS_ACCOUNT_ID}`);
      console.log('      - Request body:');
      console.log('        {');
      console.log('          "role": "OWNER",');
      console.log('          "account": {');
      console.log(`            "type": "SERVICE_ACCOUNT",`);
      console.log(`            "email": "${GOOGLE_CLIENT_EMAIL}"`);
      console.log('          }');
      console.log('        }');
      console.log('   5. Click "Execute"');
      console.log('\n   Option B - Try inviting via UI:');
      console.log('   1. Go to: https://businessprofile.google.com/');
      console.log('   2. Select your business');
      console.log('   3. Click "Users" → "+ Invite user"');
      console.log(`   4. Enter: ${GOOGLE_CLIENT_EMAIL}`);
      console.log('   5. Select "Manager" role');
      console.log('   6. Click "SEND" (ignore that no email is received)');
    }
    
    if (err.message.includes('401') || err.message.includes('UNAUTHENTICATED')) {
      console.log('\n📝 FIX REQUIRED: Authentication Failed');
      console.log('   Your service account credentials are invalid.');
      console.log('\n   Steps to fix:');
      console.log('   1. Go to: https://console.cloud.google.com/apis/credentials');
      console.log('   2. Find your service account');
      console.log('   3. Go to "Keys" tab');
      console.log('   4. Delete old key → "Add Key" → "Create new key"');
      console.log('   5. Download JSON and update your .env file');
    }
    
    if (err.message.includes('404') || err.message.includes('NOT_FOUND')) {
      console.log('\n📝 FIX REQUIRED: Account Not Found');
      console.log('   Your GOOGLE_BUSINESS_ACCOUNT_ID may be incorrect.');
      console.log('\n   Steps to find correct Account ID:');
      console.log('   1. Go to: https://businessprofile.google.com/');
      console.log('   2. Select your business');
      console.log('   3. Look at the URL - it will show:');
      console.log('      https://businessprofile.google.com/accounts/1234567890');
      console.log('   4. Use that number (with or without "accounts/" prefix)');
    }
    
    console.log('');
    process.exit(1);
  }
}

testAccess();
