/**
 * Centralized API configuration.
 *
 * VITE_API_URL must be set in all environments:
 *   - Local: frontend/.env  →  VITE_API_URL=http://localhost:5000
 *   - Vercel: Environment Variables  →  VITE_API_URL=https://intellmeet-backend-hchq.onrender.com
 *
 * NO localhost fallback — forces explicit configuration in every environment.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export default API_BASE_URL;
