import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '@/models';
import { DEMO_ACCOUNT } from '@/config/auth';

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
      const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return { user: null, session: null };
      const parsed = JSON.parse(raw) as SupabaseSession;
      if (!parsed?.access_token || !parsed.user?.id) {
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

    // Fallback if Supabase credentials are not configured yet in demo mode
    if (!this.isConfigured()) {
      if (cleanEmail === DEMO_ACCOUNT.email.toLowerCase() && password === DEMO_ACCOUNT.password) {
        const dummySession: SupabaseSession = {
          access_token: 'mock-access-token-demo',
          refresh_token: 'mock-refresh-token-demo',
          expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
          token_type: 'bearer',
          user: {
            id: 'demo-account',
            email: DEMO_ACCOUNT.email,
            user_metadata: { full_name: DEMO_ACCOUNT.name },
          },
        };
        await this.persistSession(dummySession);
        return { ok: true, user: this.mapToProfile(dummySession.user), session: dummySession };
      }
      return { ok: false, message: 'Invalid email or password.' };
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
      const dummySession: SupabaseSession = {
        access_token: `mock-token-${Date.now()}`,
        refresh_token: `mock-refresh-${Date.now()}`,
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
        token_type: 'bearer',
        user: {
          id: `local-user-${Date.now()}`,
          email: cleanEmail,
          user_metadata: { full_name: cleanName },
        },
      };
      await this.persistSession(dummySession);
      return { ok: true, user: this.mapToProfile(dummySession.user), session: dummySession };
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

      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          message: data.error_description || data.msg || data.message || 'Unable to create account.',
        };
      }

      // If Supabase confirms immediately or auto-confirms
      if (data.access_token && data.user) {
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
      if (data.user) {
        return {
          ok: true,
          message: 'Account created! Please check your email to confirm your account or sign in.',
          user: this.mapToProfile(data.user),
        };
      }

      return { ok: false, message: 'Unexpected response from authentication service.' };
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
      return { id: '', name: 'Student', email: '' };
    }
    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Student';
    return {
      id: user.id,
      name,
      email: user.email || '',
      avatarUri: user.user_metadata?.avatar_url as string | undefined,
    };
  }
}

export const supabaseAuth = new SupabaseAuthService();
