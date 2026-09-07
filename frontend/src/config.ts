// Single source of truth for the backend's base URL.
// Locally, Vite reads this from frontend/.env (VITE_API_URL=http://localhost:5000).
// On Vercel, we'll set VITE_API_URL as a real environment variable pointing to
// the deployed Render backend instead — no code change needed to switch between them.
//
// Every file that calls the backend (axios.get/post/put/delete) should import
// API_URL from here instead of writing out "http://localhost:5000" directly.
export const API_URL = import.meta.env.VITE_API_URL;