# SharpChoice Real Estate Website

## Project Overview

SharpChoice is a real estate website for "Sharp Choice Real Estate", built as a single-page application (SPA) with a Node.js/Express backend and vanilla JavaScript frontend. The application serves as a showcase for Austin, TX real estate listings and provides tools for clients to contact the agent and for the agent to manage properties and reviews.

### Key Features:
- Real estate listings management (add, edit, view)
- Client reviews system
- Contact form with email notifications
- Admin dashboard for content management
- Mobile-responsive design
- SEO-optimized with structured data
- Privacy policy and terms of service pages

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

## Key Files and Structure

### Backend Files
- `server.js`: Main Express server with API routes and middleware

### Frontend Files
- `public/index.html`: Main SPA template with structured data and SEO tags
- `public/js/scripts.js`: Client-side JavaScript logic for API calls and UI interactions
- `public/css/styles.css`: Custom CSS with responsive design and animations
- `public/privacy.html`: Privacy policy page
- `public/terms.html`: Terms of service page

### Configuration
- `package.json`: Project dependencies and start script
- Environment variables for Supabase and email service configuration

## API Endpoints

### Public Endpoints
- `GET /api/reviews`: Fetch all client reviews
- `GET /api/listings[?status=active]`: Fetch property listings (with optional status filter)
- `POST /api/contact`: Submit contact form (name, email, message, privacy consent)
- `POST /api/upload-image`: Upload property photos to Supabase Storage

### Admin Endpoints (require JWT authentication)
- `POST /api/reviews`: Add new review
- `GET /api/listings/:id`: Get single listing
- `POST /api/listings`: Add new listing
- `PATCH /api/listings/:id`: Update listing
- `POST /api/upload-image`: Upload images

## Environment Variables

The application requires the following environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for server-side operations)
- `RESEND_API_KEY`: Your Resend API key for email notifications
- `PORT`: Port for the server (defaults to 3000)

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
   Create a `.env` file in the root directory with the required environment variables:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   RESEND_API_KEY=your_resend_api_key
   PORT=3000
   ```

4. **Update frontend Supabase config**
   In `public/index.html`, update the Supabase meta tags:
   ```html
   <meta name="supabase-url" content="YOUR_SUPABASE_URL">
   <meta name="supabase-anon-key" content="YOUR_SUPABASE_ANON_KEY">
   ```

5. **Start the server**
   ```bash
   npm start
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
- `listings`: Property information (address, price, beds, baths, sqft, photos, metadata)
- `reviews`: Client testimonials (author_name, comment, rating, created_at)
- `contacts`: Contact form submissions (name, email, message, opt_in, created_at)

### Storage
- `listings-images`: Property photos stored in Supabase Storage with public URLs

## Deployment

The application is designed for deployment on platforms that support Node.js applications:
- Set up environment variables in the deployment environment
- Ensure Supabase and Resend services are properly configured
- Configure the domain name and SSL certificate
- Set up Google Analytics tracking if applicable