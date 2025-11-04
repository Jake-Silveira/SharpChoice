# SharpChoice Real Estate Website

## Project Overview

This project is a real estate website for "Sharp Choice Real Estate". It's a single-page application (SPA) built with a Node.js backend and a vanilla JavaScript frontend.

**Backend:**

*   **Framework:** Express.js
*   **Database:** Supabase (for listings, reviews, and contacts)
*   **Authentication:** Supabase (for admin login)
*   **Email:** Resend (for contact form submissions and auto-replies)

**Frontend:**

*   **Framework:** None (vanilla JavaScript)
*   **Styling:** CSS with custom properties (variables)
*   **Features:**
    *   Dynamically loaded listings and reviews from the backend.
    *   Modals for viewing all listings, reviews, and admin login/dashboard.
    *   Contact form with email notifications.
    *   Admin dashboard for managing listings and reviews.

## Building and Running

**Prerequisites:**

*   Node.js and npm installed.
*   Supabase account and project created.
*   Resend account and API key.

**Configuration:**

1.  **Environment Variables:** The `server.js` file requires the following environment variables to be set:
    *   `SUPABASE_URL`: Your Supabase project URL.
    *   `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key.
    *   `RESEND_API_KEY`: Your Resend API key.

2.  **Supabase Credentials:** The frontend (`public/index.html`) requires the following meta tags to be updated with your Supabase credentials:
    ```html
    <meta name="supabase-url" content="YOUR_SUPABASE_URL">
    <meta name="supabase-anon-key" content="YOUR_SUPABASE_ANON_KEY">
    ```

**Running the Project:**

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start the Server:**
    ```bash
    npm start
    ```

## Development Conventions

*   **Code Style:** The code follows a consistent style, with comments explaining the purpose of different sections.
*   **API Routes:** All API routes are defined in `server.js` and prefixed with `/api`.
*   **Frontend Logic:** The frontend logic is contained in `public/js/scripts.js`.
*   **Styling:** The styling is in `public/css/styles.css`.
*   **Admin Functionality:** The admin functionality is handled through a dashboard that is accessed by logging in. The dashboard allows for adding and editing listings and reviews.
