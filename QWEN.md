# SharpChoice Real Estate Website

## Project Overview

SharpChoice is a real estate website for "Sharp Choice Real Estate", built as a single-page application (SPA) with a Node.js/Express backend and vanilla JavaScript frontend. The application serves as a showcase for Austin, TX real estate listings and provides tools for clients to contact the agent and for the agent to manage properties and reviews.

### Key Features (Tier 2 Package):
- Real estate listings management (add, edit, view)
- Client reviews system with Google Reviews integration
- **Public review submission with admin moderation**
  - "Write a Review" modal form with star rating
  - Reviews submitted as "pending" status
  - Admin dashboard screens pending reviews (approve/delete)
  - Email notifications to admin on new submissions
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

### Backend (Node.js/Express)
- **Framework**: Express.js server
- **Database**: Supabase (PostgreSQL) for storing listings, reviews, and contacts
- **Authentication**: Supabase authentication for admin functions
- **Email**: Resend service for contact form notifications and auto-replies
- **File Storage**: Supabase Storage for property photos
- **API Endpoints**: RESTful API for CRUD operations on listings and reviews

### Frontend (Vanilla JavaScript)
- **Framework**: Pure JavaScript (no framework)
- **Styling**: Custom CSS with CSS variables for theming
- **Responsive Design**: Mobile-first approach with responsive breakpoints
- **Asynchronous Loading**: Dynamic content loading via API calls

## Core Dependencies

### Backend Dependencies
- `express`: Web framework for Node.js
- `@supabase/supabase-js`: Client library for Supabase database integration
- `resend`: Email service client for notifications
- `googleapis`: Google APIs integration (possibly for analytics)
- `node-fetch`: HTTP client for server-side requests

### Frontend Dependencies
- Supabase CDN library loaded via script tag in HTML

### Build/Processing Dependencies
- `sharp`: Image processing library for optimizing images (resizing, cropping)

## Key Files and Structure

### Backend Files
- `backend/server.js`: Main Express server with API routes and middleware
- `backend/package.json`: Project dependencies and start script

### Frontend Files
- `frontend/index.html`: Main SPA template with structured data and SEO tags
- `frontend/js/scripts.js`: Client-side JavaScript logic for API calls and UI interactions
- `frontend/css/styles.css`: Custom CSS with responsive design and animations
- `frontend/privacy.html`: Privacy policy page
- `frontend/terms.html`: Terms of service page
- `frontend/assets/`: Static assets (images, SVGs)
- `frontend/manifest.json`: Web app manifest

### Configuration
- Environment variables for Supabase and email service configuration (`.env` in backend/)

## API Endpoints

### Public Endpoints
- `GET /api/reviews`: Fetch all confirmed client reviews
- `POST /api/reviews/submit`: Submit a review for moderation (pending status)
- `GET /api/listings[?status=active]`: Fetch property listings (with optional status filter)
- `POST /api/contact`: Submit contact form (name, email, message, privacy consent)
- `POST /api/upload-image`: Upload property photos to Supabase Storage

### Admin Endpoints (require JWT authentication)
- `POST /api/reviews`: Add new review (auto-confirmed)
- `GET /api/reviews/pending`: Fetch pending reviews awaiting moderation
- `POST /api/reviews/:id/approve`: Approve a pending review (set to confirmed)
- `POST /api/reviews/:id/delete`: Delete a pending review (set to deleted)
- `GET /api/listings/:id`: Get single listing
- `POST /api/listings`: Add new listing
- `PATCH /api/listings/:id`: Update listing
- `POST /api/upload-image`: Upload images
- `POST /api/sync-google-reviews`: Sync reviews from Google Business Profile (requires auth)

## Environment Variables

The application requires the following environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for server-side operations)
- `RESEND_API_KEY`: Your Resend API key for email notifications
- `PORT`: Port for the server (defaults to 3000)
- `GOOGLE_BUSINESS_ACCOUNT_ID`: (Optional) Google Business Profile account ID for review sync
- `GOOGLE_API_KEY`: (Optional) Google API key with Business Profile API enabled

These should be set in a `.env` file in the `backend/` directory.

## Security Features

The application implements several security measures:
- Client-side input sanitization using DOMPurify
- Server-side input validation and sanitization using validator.js
- Rate limiting for contact form submissions (5 requests per 15 minutes per IP)
- Security headers using helmet.js
- Authentication required for admin functions (reviews, listings, uploads)

## Building and Running

### Prerequisites
- Node.js (version 14 or higher)
- Supabase account and project
- Resend account for email functionality

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SharpChoice
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the `backend/` directory with the required environment variables:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   RESEND_API_KEY=your_resend_api_key
   PORT=3000
   GOOGLE_BUSINESS_ACCOUNT_ID=your_google_business_account_id (after verification)
   GOOGLE_API_KEY=your_google_api_key (after verification)
   ```

4. **Update frontend Supabase config**
   In `frontend/index.html`, update the Supabase meta tags:
   ```html
   <meta name="supabase-url" content="YOUR_SUPABASE_URL">
   <meta name="supabase-anon-key" content="YOUR_SUPABASE_ANON_KEY">
   ```

5. **Start the server**
   ```bash
   cd backend && npm start
   ```

6. **Access the application**
   Open `http://localhost:3000` in your browser

## Deployment

The application is currently deployed on Render and accessible at: [www.sharpchoicerealestate.com](https://www.sharpchoicerealestate.com)

## Development Guidelines

### Code Style
- Follow consistent indentation (2 spaces for JavaScript, 2 spaces for CSS)
- Use descriptive variable and function names
- Include comments for complex logic
- Maintain responsive design principles

### API Design
- Follow RESTful conventions for endpoint naming
- Return JSON responses with appropriate HTTP status codes
- Implement proper error handling and validation
- Use middleware for authentication where required

### Frontend Best Practices
- Use semantic HTML elements
- Implement accessibility features (ARIA labels, keyboard navigation)
- Optimize images and assets for web performance
- Use CSS variables for consistent theming
- Implement form validation on both frontend and backend

### Security Considerations
- Validate all user inputs on the backend
- Use JWT authentication for admin functions
- Implement proper CORS policies
- Sanitize user inputs to prevent XSS attacks
- Follow Supabase security best practices

### Testing
- Manual testing across different devices and browsers
- Form submission testing
- API endpoint testing
- Admin functionality testing
- Contact form email delivery verification

## Admin Functionality

The application includes an admin dashboard accessible through authentication:
- Add and manage property listings with photos
- Add and manage client reviews
- Toggle listing status (active/sold)
- Edit listing details
- View contact form submissions (stored in Supabase)

## Database Schema (Supabase)

### Tables
- `listings`: Property information (address, city, state, zip, price, beds, baths, sqft, photos, status, metadata, created_at)
- `reviews`: Client testimonials
  - `id`: Primary key
  - `author_name`: Review author name
  - `comment`: Review text
  - `rating`: Star rating (1-5)
  - `email`: Submitter's email (for public submissions, not displayed publicly)
  - `status`: Review status ('pending', 'confirmed', 'deleted')
  - `google_review_id`: Google's review ID for deduplication during sync
  - `created_at`: Timestamp
- `contacts`: Contact form submissions (name, email, message, opt_in, created_at)

### Storage
- `listings-images`: Property photos stored in Supabase Storage with public URLs

### Database Migration Required
Before deploying, run this SQL in Supabase SQL Editor:

```sql
-- Add status column for review moderation
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed' 
CHECK (status IN ('pending', 'confirmed', 'deleted'));

-- Add email column for public submissions
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add google_review_id for Google sync deduplication
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS google_review_id TEXT;

-- Set existing reviews to confirmed
UPDATE reviews SET status = 'confirmed' WHERE status IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_google_id ON reviews(google_review_id);
```

## Deployment

The application is designed for deployment on platforms that support Node.js applications:
- Set the working directory to `backend/`
- Set up environment variables in the deployment environment
- Ensure Supabase and Resend services are properly configured
- Configure the domain name and SSL certificate
- Set up Google Analytics tracking if applicable
- The `backend/` folder serves static files from `../frontend/`

## Recent Updates
- **Feb 2026**: Added public review submission with admin moderation
  - New "Write a Review" modal with star rating component
  - Reviews submitted with "pending" status requiring admin approval
  - Admin dashboard "Pending Reviews" section with approve/delete actions
  - Email notifications to admin on new review submissions
  - Google Reviews sync auto-confirms imported reviews
  - Mobile-optimized modal form styling
- **Feb 2026**: Fixed supabase variable naming conflict with CDN global (renamed to `supabaseClient`)
- **Feb 2026**: Fixed cursor flicker on header navigation hover (added padding to nav links)
- **Dec 2025**: Fixed listing edit functionality by replacing inline event handlers with event listeners (CSP compliance)
- **Nov 2025**: Added KW logo to footer and optimized site header images

## Security Configuration

This application implements Content Security Policy (CSP) headers to enhance security. The CSP allows:
- Loading scripts from `self` and trusted CDNs (`cdn.jsdelivr.net`)
- Loading images from `self` and Supabase storage
- Loading fonts from `fonts.gstatic.com`
- Connecting to Supabase and Resend APIs