import config from '@/config';

/**
 * Central API client for SecureNexus.
 *
 * Every component/page talks to the backend through this module so auth
 * headers, error handling and the response envelope stay consistent.
 */

const TOKEN_KEY = 'securenexus_token';

export function getToken() {
  return (
    (typeof window !== 'undefined' && window.localStorage.getItem(TOKEN_KEY)) || ''
  );
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(TOKEN_KEY);
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export class ApiError extends Error {
  status: number;
  errors?: string[];

  constructor(message: string, status = 500, errors?: string[]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; token?: boolean; headers?: Record<string, string> } = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, token = true, headers = {} } = options;

  if (!config.isConfigured && process.env.NODE_ENV === 'production') {
    throw new ApiError(
      'The frontend API is not configured. Set NEXT_PUBLIC_API_URL in the Netlify site environment and redeploy.',
      503
    );
  }

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const authToken = token ? getToken() : '';
  if (authToken) requestHeaders.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => ({ success: false }))) as ApiResponse<T>;

  if (!res.ok || !json.success) {
    throw new ApiError(
      json.message || `Request failed (${res.status})`,
      res.status,
      json.errors
    );
  }

  return json;
}

export const api = {
  /** Make an authenticated request using the stored token (pass false to skip auth). */
  get: <T = unknown>(path: string, withAuth = true): Promise<ApiResponse<T>> =>
    request<T>(path, { method: 'GET', token: withAuth }),
  post: <T = unknown>(path: string, body?: unknown, withAuth = true): Promise<ApiResponse<T>> =>
    request<T>(path, { method: 'POST', body, token: withAuth }),
  put: <T = unknown>(path: string, body?: unknown, withAuth = true): Promise<ApiResponse<T>> =>
    request<T>(path, { method: 'PUT', body, token: withAuth }),
  del: <T = unknown>(path: string, withAuth = true): Promise<ApiResponse<T>> =>
    request<T>(path, { method: 'DELETE', token: withAuth }),
};

export default api;
