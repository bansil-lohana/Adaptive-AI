import { Platform } from 'react-native';
import { supabaseAuth } from '@/services/auth/supabaseAuth';

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

function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');

  // Default to standard Express port 5000
  if (Platform.OS === 'android') {
    // 10.0.2.2 points to host machine from Android emulator
    return 'http://10.0.2.2:5000';
  }
  return 'http://localhost:5000';
}

export const API_BASE_URL = resolveApiBaseUrl();

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
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const token = await supabaseAuth.getAccessToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // If body is NOT FormData, set JSON content-type
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr) {
    throw new ApiError(
      'Unable to connect to backend server. Make sure the API server is running.',
      'NETWORK_ERROR',
      0,
    );
  }

  // Handle 401 token expiration and retry once
  if (response.status === 401 && !hasRetried) {
    const refreshedToken = await supabaseAuth.refreshAccessToken();
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