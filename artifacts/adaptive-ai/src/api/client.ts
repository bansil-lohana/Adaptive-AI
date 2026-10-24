import { Platform } from 'react-native';
import { supabaseAuth } from '@/services/auth/supabaseAuth';
import { getSupabaseClient } from '@/services/auth/supabaseClient';
import { handleOfflineMock, isOfflineMockMode } from './offlineMock';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code = 'API_ERROR', status = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const origin = new URL(window.location.origin);
    const forwardedHost = origin.hostname.match(/^(.*)-\d+(\.app\.github\.dev)$/);
    if (forwardedHost) {
      origin.hostname = `${forwardedHost[1]}-5000${forwardedHost[2]}`;
      return origin.origin.replace(/\/+$/, '');
    }
    if (
      (origin.hostname === 'localhost' || origin.hostname === '127.0.0.1') &&
      (origin.port === '8081' || origin.port === '8082')
    ) {
      origin.port = '5000';
      return origin.origin.replace(/\/+$/, '');
    }
    if (configuredUrl) return normalizeConfiguredUrl(configuredUrl);
    return origin.origin.replace(/\/+$/, '');
  }

  return configuredUrl ? normalizeConfiguredUrl(configuredUrl) : '';
}

function normalizeConfiguredUrl(value: string): string {
  const url = new URL(value);
  const forwardedHost = url.hostname.match(/^(.*)-\d+(\.app\.github\.dev)$/);
  if (forwardedHost) {
    url.hostname = `${forwardedHost[1]}-5000${forwardedHost[2]}`;
  } else if (
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
    (url.port === '8081' || url.port === '8082')
  ) {
    url.port = '5000';
  }
  return url.origin.replace(/\/+$/, '');
}

async function getCurrentAccessToken(): Promise<string | null> {
  if (supabaseAuth.isConfigured()) {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) {
      throw new ApiError(error.message, 'AUTH_SESSION_ERROR', 0);
    }
    if (data.session?.access_token) return data.session.access_token;
  }

  return supabaseAuth.getAccessToken();
}

async function refreshCurrentAccessToken(): Promise<string | null> {
  if (supabaseAuth.isConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new ApiError(error.message, 'AUTH_SESSION_ERROR', 0);
    }
    if (data.session) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        throw new ApiError(refreshError.message, 'AUTH_REFRESH_ERROR', 0);
      }
      return refreshed.session?.access_token ?? null;
    }
  }

  return supabaseAuth.refreshAccessToken();
}

const READ_RETRY_DELAYS_MS = [300, 700];

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  hasRetried = false,
): Promise<T> {
  if (isOfflineMockMode()) {
    return handleOfflineMock<T>(endpoint, options);
  }

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError(
      'Backend URL is not configured. Set EXPO_PUBLIC_API_URL to the HTTPS Codespaces forwarded URL for port 5000, then restart Expo.',
      'CONFIGURATION_ERROR',
      0,
    );
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const token = await getCurrentAccessToken();

  const headers = new Headers(options.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  // If body is NOT FormData, set JSON content-type
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response | undefined;
  const method = (options.method ?? 'GET').toUpperCase();
  const retryDelays = method === 'GET' || method === 'HEAD' ? READ_RETRY_DELAYS_MS : [];
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      response = await fetch(url, {
        ...options,
        headers,
        credentials: Platform.OS === 'web' ? 'include' : 'omit',
      });
      break;
    } catch {
      const delay = retryDelays[attempt];
      if (delay === undefined) break;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  if (!response) {
    throw new ApiError(
      'Unable to reach the API server. Confirm it is running on port 5000 and EXPO_PUBLIC_API_URL is set to its HTTPS Codespaces forwarded URL.',
      'NETWORK_ERROR',
      0,
    );
  }

  // Handle 401 token expiration and retry once
  if (response.status === 401 && !hasRetried) {
    const refreshedToken = await refreshCurrentAccessToken();
    if (refreshedToken) {
      return apiRequest<T>(endpoint, options, true);
    }
  }

  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(
        `Server returned ${response.status} ${response.statusText}`,
        'SERVER_ERROR',
        response.status,
      );
    }
    return {} as T;
  }

  if (!response.ok || payload.success === false) {
    const message = payload.error?.message || `Request failed with status ${response.status}`;
    const code = payload.error?.code || 'API_ERROR';
    throw new ApiError(message, code, response.status, payload.error?.details);
  }

  return payload.data as T;
}

export async function apiUpload<T>(
  endpoint: string,
  formData: FormData,
  method = 'POST',
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method,
    body: formData,
  });
}