/**
 * Central configuration for the SecureNexus frontend.
 *
 * The backend is a separate Express + Socket.IO server. The frontend
 * talks to it over HTTP/WebSocket. Override with NEXT_PUBLIC_API_URL and
 * NEXT_PUBLIC_SOCKET_URL if your backend runs on a different origin.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

export const config = {
  apiUrl: API_URL,
  socketUrl: SOCKET_URL,
  isConfigured: Boolean(API_URL),
};

export default config;