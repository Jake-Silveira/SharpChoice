# SharpChoice Real Estate Website

## Overview
SharpChoice is a real estate website for "Sharp Choice Real Estate", built as a single-page application (SPA) with a Node.js/Express backend and vanilla JavaScript frontend. The application serves as a showcase for Austin, TX real estate listings and provides tools for clients to contact the agent and for the agent to manage properties and reviews.

## Live Demo
Check out the live website: [www.sharpchoicerealestate.com](https://www.sharpchoicerealestate.com)

## Project Features (Tier 2 Package)
- Real estate listings management (add, edit, view)
- Client reviews system with Google Reviews integration
- Contact form with email notifications
- Admin dashboard for content management
- Mobile-responsive design
- Optimized header with appropriately sized branding elements
- Image optimization (logo and profile photo) to improve loading times
- SEO-optimized with structured data (LocalBusiness and Service schemas)
- Privacy policy and terms of service pages
- Enhanced security with input sanitization and rate limiting
- Google Analytics integration
- Up to 3 custom sections (About, Services, Reviews)
- Google Reviews callouts and links (updated to "See my Google Reviews")
- Keller Williams (KW) logo prominently displayed in footer to show affiliation
- CSP-compliant event handling (no inline handlers)
- Stable navigation hover areas (no cursor flicker)

## Architecture
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js/Express
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Supabase Storage for property photos
- **Email Service**: Resend for contact notifications
- **Analytics**: Google Analytics

## Local Development
To run this project locally, you'll need Node.js installed and the following environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `PORT` (defaults to 3000)

Then install dependencies and start the server:
```bash
npm install
npm start
```

## Security Configuration
This application implements Content Security Policy (CSP) headers to enhance security. The CSP allows:
- Loading scripts from `self` and trusted CDNs (`cdn.jsdelivr.net`)
- Loading images from `self` and Supabase storage
- Loading fonts from `fonts.gstatic.com`
- Connecting to Supabase and Resend APIs

## Deployment
The application is currently deployed on Render at: [www.sharpchoicerealestate.com](https://www.sharpchoicerealestate.com)

## Recent Updates
- **Feb 2026**: Added public review submission with admin moderation
  - "Write a Review" modal form with star rating
  - Reviews submitted as "pending" and require admin approval
  - Admin dashboard shows pending reviews with approve/delete actions
  - Email notifications to admin on new review submissions
  - Google Reviews sync auto-confirms imported reviews
- **Feb 2026**: Fixed supabase variable naming conflict with CDN global (renamed to `supabaseClient`)
- **Feb 2026**: Fixed cursor flicker on header navigation hover (added padding to nav links)
- **Dec 2025**: Fixed listing edit functionality by replacing inline event handlers with event listeners (CSP compliance)
- **Nov 2025**: Added KW logo to footer and optimized site header images