/**
 * Centralized API configuration.
 *
 * Uses VITE_API_URL environment variable.
 *   - Local development: set VITE_API_URL=http://localhost:5000 in frontend/.env
 *   - Production (Vercel): set VITE_API_URL=https://intellmeet-backend-hchq.onrender.com
 *
 * This variable MUST be set in all environments. There is no localhost fallback
 * to prevent accidental production failures.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  console.error(
    "[config] VITE_API_URL is not set. API requests will fail. " +
    "Set VITE_API_URL in your .env file (local) or Vercel environment variables (production)."
  );
}

export default API_BASE_URL;
