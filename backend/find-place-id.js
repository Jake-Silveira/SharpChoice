// find-place-id.js
// Run this to find your Google Place ID using the Places API
// Usage: node find-place-id.js "Sharp Choice Real Estate Austin TX"

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY;
const searchQuery = process.argv[2] || 'Sharp Choice Real Estate Austin TX';

console.log('===========================================');
console.log('  Google Place ID Finder');
console.log('===========================================\n');

if (!GOOGLE_API_KEY) {
  console.log('❌ ERROR: No API key found!');
  console.log('\nYou need to:');
  console.log('1. Go to Google Cloud Console');
  console.log('2. Enable "Places API"');
  console.log('3. Create an API key');
  console.log('4. Add to your .env file:');
  console.log('   GOOGLE_PLACES_API_KEY=your_api_key_here\n');
  process.exit(1);
}

console.log('🔍 Searching for:', searchQuery);
console.log('Using API key:', GOOGLE_API_KEY.substring(0, 10) + '...\n');

async function findPlaceId() {
  try {
    // Use Places API Text Search
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', searchQuery);
    url.searchParams.set('key', GOOGLE_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      console.log('❌ No results found for this search query.');
      console.log('\nTry a different search term, such as:');
      console.log('  - Business name only');
      console.log('  - Business name + city');
      console.log('  - Full address');
      process.exit(1);
    }

    if (data.status === 'REQUEST_DENIED') {
      console.log('❌ Request denied:', data.error_message);
      console.log('\nMake sure:');
      console.log('1. Places API is enabled in Google Cloud Console');
      console.log('2. Your API key is valid');
      console.log('3. API key has no IP restrictions blocking this request');
      process.exit(1);
    }

    if (!data.results || data.results.length === 0) {
      console.log('❌ No results found');
      process.exit(1);
    }

    console.log('✅ Found', data.results.length, 'result(s):\n');

    data.results.forEach((result, index) => {
      console.log(`--- Result ${index + 1} ---`);
      console.log('Name:', result.name);
      console.log('Address:', result.formatted_address);
      console.log('Place ID:', result.place_id);
      console.log('Rating:', result.rating || 'N/A');
      console.log('Types:', result.types?.join(', ') || 'N/A');
      console.log('');
    });

    const topResult = data.results[0];
    
    console.log('===========================================');
    console.log('  RECOMMENDED PLACE ID:');
    console.log('===========================================');
    console.log('');
    console.log(topResult.place_id);
    console.log('');
    console.log('Add this to your Render environment variables:');
    console.log('GOOGLE_PLACE_ID=' + topResult.place_id);
    console.log('');
    console.log('===========================================\n');

    // Now test fetching reviews with this Place ID
    console.log('📝 Testing Places API review fetch...\n');
    
    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsUrl.searchParams.set('place_id', topResult.place_id);
    detailsUrl.searchParams.set('fields', 'reviews');
    detailsUrl.searchParams.set('key', GOOGLE_API_KEY);

    const detailsResponse = await fetch(detailsUrl.toString());
    const detailsData = await detailsResponse.json();

    if (detailsData.result && detailsData.result.reviews) {
      console.log('✅ SUCCESS! Found', detailsData.result.reviews.length, 'reviews\n');
      
      detailsData.result.reviews.slice(0, 3).forEach((review, i) => {
        console.log(`Review ${i + 1}:`);
        console.log('  Author:', review.author_name);
        console.log('  Rating:', review.rating, 'stars');
        console.log('  Text:', review.text.substring(0, 100) + (review.text.length > 100 ? '...' : ''));
        console.log('');
      });

      console.log('===========================================');
      console.log('  Places API is working!');
      console.log('===========================================\n');
      console.log('Next steps:');
      console.log('1. Add to Render environment variables:');
      console.log('   GOOGLE_PLACES_API_KEY=' + GOOGLE_API_KEY);
      console.log('   GOOGLE_PLACE_ID=' + topResult.place_id);
      console.log('');
      console.log('2. Redeploy to Render');
      console.log('3. The sync button should now work via Places API fallback\n');
    } else {
      console.log('⚠️ Could not fetch reviews');
      if (detailsData.error_message) {
        console.log('Error:', detailsData.error_message);
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

findPlaceId();
