import { UserProfile } from '@/models';
import { supabaseAuth, type AuthResult } from './supabaseAuth';

export type { AuthResult };

export class SupabaseIntegratedAuthService {
  async restore(): Promise<{ user: UserProfile | null }> {
    const { user } = await supabaseAuth.restoreSession();
    return { user };
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    return supabaseAuth.signIn(email, password);
  }

  async signUp(name: string, email: string, password: string): Promise<AuthResult> {
    return supabaseAuth.signUp(name, email, password);
  }

  async requestPasswordReset(email: string): Promise<AuthResult> {
    return supabaseAuth.requestPasswordReset(email);
  }

  async resetPassword(_email: string, password: string): Promise<AuthResult> {
    return supabaseAuth.updateUser({ password });
  }

  async updateProfile(
    _email: string,
    patch: Partial<Pick<UserProfile, 'name' | 'avatarUri'>>,
  ): Promise<AuthResult> {
    const res = await supabaseAuth.updateUser({
      data: {
        ...(patch.name ? { full_name: patch.name.trim(), name: patch.name.trim() } : {}),
        ...(patch.avatarUri ? { avatar_url: patch.avatarUri } : {}),
      },
    });
    return res;
  }

  async changePassword(_email: string, _current: string, next: string): Promise<AuthResult> {
    return supabaseAuth.updateUser({ password: next });
  }

  async signOut(): Promise<void> {
    await supabaseAuth.signOut();
  }

  getCurrentUser(): UserProfile | null {
    return supabaseAuth.getCurrentUser();
  }
}

export const authService = new SupabaseIntegratedAuthService();