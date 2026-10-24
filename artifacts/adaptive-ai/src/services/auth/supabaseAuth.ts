import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '@/models';
import { getSupabaseClient } from './supabaseClient';

const SESSION_STORAGE_KEY = 'adaptive_supabase_session';

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in seconds
  token_type: string;
  user: {
    id: string;
    email: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
      avatar_url?: string;
      [key: string]: unknown;
    };
  };
}

export interface AuthResult {
  ok: boolean;
  message?: string;
  user?: UserProfile;
  session?: SupabaseSession | null;
}

class SupabaseAuthService {
  private session: SupabaseSession | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  private get supabaseUrl(): string {
    return (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  }

  private get supabaseKey(): string {
    return (
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      ''
    );
  }

  public isConfigured(): boolean {
    return Boolean(this.supabaseUrl && this.supabaseKey);
  }

  /**
   * Restores existing session from AsyncStorage on app launch.
   */
  async restoreSession(): Promise<{ user: UserProfile | null; session: SupabaseSession | null }> {
    try {
      if (this.isConfigured()) {
        const { data, error } = await getSupabaseClient().auth.getSession();
        if (error) throw error;
        if (data.session) {
          const session: SupabaseSession = {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at:
              data.session.expires_at ??
              Math.floor(Date.now() / 1000) + data.session.expires_in,
            token_type: data.session.token_type,
            user: {
              id: data.session.user.id,
              email: data.session.user.email ?? '',
              user_metadata: data.session.user.user_metadata,
            },
          };
          await this.persistSession(session);
          return { user: this.mapToProfile(session.user), session };
        }
      }

      const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return { user: null, session: null };
      const parsed = JSON.parse(raw) as SupabaseSession;
      if (!parsed?.access_token || !parsed.user?.id) {
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
        return { user: null, session: null };
      }
      if (parsed.access_token.startsWith('mock-')) {
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
        return { user: null, session: null };
      }

      this.session = parsed;

      // Check if token is expired or close to expiry (< 60s)
      const nowSec = Math.floor(Date.now() / 1000);
      if (this.isConfigured() && parsed.expires_at && parsed.expires_at - nowSec < 60) {
        await this.refreshAccessToken();
      }

      return {
        user: this.mapToProfile(this.session?.user),
        session: this.session,
      };
    } catch {
      return { user: null, session: null };
    }
  }

  /**
   * Retrieves active access token, refreshing if necessary.
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.session) {
      await this.restoreSession();
    }
    if (!this.session) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (this.isConfigured() && this.session.expires_at && this.session.expires_at - nowSec < 60) {
      return this.refreshAccessToken();
    }

    return this.session.access_token;
  }

  /**
   * Returns current authenticated user.
   */
  getCurrentUser(): UserProfile | null {
    if (!this.session?.user) return null;
    return this.mapToProfile(this.session.user);
  }

  /**
   * Signs in with email and password using Supabase Auth.
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const cleanEmail = email.trim().toLowerCase();

    if (!this.isConfigured()) {
      return {
        ok: false,
        message: 'Sign-in is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
      };
    }

    try {
      const res = await fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseKey,
        },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          message: data.error_description || data.msg || data.message || 'Invalid email or password.',
        };
      }

      const session: SupabaseSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
        token_type: data.token_type || 'bearer',
        user: data.user,
      };

      await this.persistSession(session);
      return { ok: true, user: this.mapToProfile(session.user), session };
    } catch (err) {
      return { ok: false, message: 'Network error. Unable to connect to authentication server.' };
    }
  }

  /**
   * Signs up a new student account using Supabase Auth.
   */
  async signUp(name: string, email: string, password: string): Promise<AuthResult> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!this.isConfigured()) {
      return {
        ok: false,
        message: 'Account creation is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
      };
    }

    try {
      const res = await fetch(`${this.supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseKey,
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          data: {
            full_name: cleanName,
            name: cleanName,
          },
        }),
      });

      const contentType = res.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
      if (!contentType?.includes('json')) {
        return {
          ok: false,
          message: `Authentication service returned an unexpected response (HTTP ${res.status}, ${contentType || 'unknown content type'}). Please try again later.`,
        };
      }

      let data: {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        expires_in?: number;
        token_type?: string;
        user?: SupabaseSession['user'] | null;
        error_description?: string;
        msg?: string;
        message?: string;
      };
      try {
        data = await res.json();
      } catch {
        return {
          ok: false,
          message: `Authentication service returned invalid JSON (HTTP ${res.status}). Please try again later.`,
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          message: data.error_description || data.msg || data.message || 'Unable to create account.',
        };
      }

      // If Supabase confirms immediately or auto-confirms
      if (data.access_token && data.refresh_token && data.user?.id) {
        const session: SupabaseSession = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
          token_type: data.token_type || 'bearer',
          user: data.user,
        };
        await this.persistSession(session);
        return { ok: true, user: this.mapToProfile(session.user), session };
      }

      // Email confirmation required or user created
      if (data.user?.id) {
        return {
          ok: true,
          message: 'Account created! Please check your email to confirm your account or sign in.',
          user: this.mapToProfile(data.user),
        };
      }

      return {
        ok: false,
        message: 'This email may already be registered. Try signing in or resetting your password.',
      };
    } catch {
      return { ok: false, message: 'Network error. Unable to create account.' };
    }
  }

  /**
   * Sends password reset email.
   */
  async requestPasswordReset(email: string): Promise<AuthResult> {
    const cleanEmail = email.trim().toLowerCase();
    if (!this.isConfigured()) {
      return { ok: true };
    }

    try {
      const res = await fetch(`${this.supabaseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseKey,
        },
        body: JSON.stringify({ email: cleanEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, message: data.msg || 'Unable to request password reset.' };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: 'Network error during password reset request.' };
    }
  }

  /**
   * Updates user profile or password.
   */
  async updateUser(attributes: {
    password?: string;
    data?: Record<string, unknown>;
  }): Promise<AuthResult> {
    const token = await this.getAccessToken();
    if (!token) return { ok: false, message: 'Session expired. Please sign in again.' };

    if (!this.isConfigured()) {
      if (this.session && attributes.data?.full_name) {
        this.session.user.user_metadata = {
          ...this.session.user.user_metadata,
          full_name: attributes.data.full_name as string,
        };
        await this.persistSession(this.session);
      }
      return { ok: true, user: this.getCurrentUser() ?? undefined };
    }

    try {
      const res = await fetch(`${this.supabaseUrl}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseKey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(attributes),
      });

      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.message || 'Unable to update account.' };
      }

      if (this.session && data.id) {
        this.session.user = data;
        await this.persistSession(this.session);
      }

      return { ok: true, user: this.mapToProfile(data) };
    } catch {
      return { ok: false, message: 'Network error updating account.' };
    }
  }

  /**
   * Refreshes access token with refresh token.
   */
  async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      try {
        if (!this.session?.refresh_token || !this.isConfigured()) {
          return this.session?.access_token ?? null;
        }

        const res = await fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.supabaseKey,
          },
          body: JSON.stringify({ refresh_token: this.session.refresh_token }),
        });

        if (!res.ok) {
          // Token refresh failed, clear session
          await this.signOut();
          return null;
        }

        const data = await res.json();
        const updated: SupabaseSession = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
          token_type: data.token_type || 'bearer',
          user: data.user || this.session.user,
        };

        await this.persistSession(updated);
        return updated.access_token;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  /**
   * Signs out and clears persisted session.
   */
  async signOut(): Promise<void> {
    const token = this.session?.access_token;
    this.session = null;
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);

    if (this.isConfigured()) {
      const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
      if (error) throw error;
    }

    if (this.isConfigured() && token) {
      try {
        await fetch(`${this.supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: this.supabaseKey,
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Ignore network failure on sign out
      }
    }
  }

  private async persistSession(session: SupabaseSession) {
    this.session = session;
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  private mapToProfile(user?: SupabaseSession['user']): UserProfile {
    if (!user) {
      return { id: '', name: 'User', email: '' };
    }
    const metadata = user.user_metadata;
    const emailPrefix = user.email?.split('@')[0]?.trim();
    const name =
      (typeof metadata?.full_name === 'string' && metadata.full_name.trim()) ||
      (typeof metadata?.name === 'string' && metadata.name.trim()) ||
      (emailPrefix ? `${emailPrefix.charAt(0).toUpperCase()}${emailPrefix.slice(1).toLowerCase()}` : '') ||
      'User';
    return {
      id: user.id,
      name,
      email: user.email || '',
      avatarUri: user.user_metadata?.avatar_url as string | undefined,
      user_metadata: metadata,
    };
  }
}

export const supabaseAuth = new SupabaseAuthService();
