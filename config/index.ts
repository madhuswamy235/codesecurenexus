/**
 * Central configuration for the SecureNexus frontend.
 *
 * The backend is a separate Express + Socket.IO server. The frontend
 * talks to it over HTTP/WebSocket. Override with NEXT_PUBLIC_API_URL and
 * NEXT_PUBLIC_SOCKET_URL if your backend runs on a different origin.
 */

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const API_URL = configuredApiUrl || 'http://localhost:5000/api';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

export const config = {
  apiUrl: API_URL,
  socketUrl: SOCKET_URL,
  // The localhost fallback is useful only during local development. Netlify
  // must receive NEXT_PUBLIC_API_URL at build time because NEXT_PUBLIC_*
  // values are embedded into the browser bundle by Next.js.
  isConfigured: Boolean(configuredApiUrl),
};

export default config;
