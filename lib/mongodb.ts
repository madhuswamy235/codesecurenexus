/**
 * LEGACY Next.js API-route MongoDB helper.
 *
 * The SecureNexus backend is a separate Express + Mongoose server (backend/).
 * The Next.js frontend talks to it over HTTP through lib/api.ts and does NOT
 * bundle Mongoose. This file is kept only so any remaining legacy importers do
 * not reference a missing module. Do not call connectDB() here — the real
 * database connection lives on the Express backend.
 */
export const mongoose = {
  connect: async () => {
    throw new Error(
      "Mongoose is a backend-only dependency. The Next.js app proxies to the Express backend instead."
    );
  },
};

export async function connectDB(): Promise<never> {
  throw new Error(
    "connectDB() is a legacy Next.js helper. Persistence happens on the Express backend (see backend/)."
  );
}