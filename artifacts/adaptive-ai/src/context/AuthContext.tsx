import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { UserProfile } from '@/models';
import { AUTH_MODE } from '@/config/auth';
import { authService, AuthResult } from '@/services/auth/AuthService';

type AuthContextValue = {
  user: UserProfile | null;
  isLoading: boolean;
  authMode: typeof AUTH_MODE;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  resetPassword: (email: string, password: string) => Promise<AuthResult>;
  updateProfile: (patch: Partial<Pick<UserProfile, 'name' | 'avatarUri'>>) => Promise<AuthResult>;
  changePassword: (current: string, next: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService.restore().then(result => setUser(result.user)).catch(() => undefined).finally(() => setIsLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await authService.signIn(email, password);
    if (result.user) setUser(result.user);
    return result;
  };
  const signUp = async (name: string, email: string, password: string) => {
    const result = await authService.signUp(name, email, password);
    if (result.user) setUser(result.user);
    return result;
  };
  const updateProfile = async (patch: Partial<Pick<UserProfile, 'name' | 'avatarUri'>>) => {
    if (!user) return { ok: false, message: 'Your session has expired. Please sign in again.' };
    const result = await authService.updateProfile(user.email, patch);
    if (result.user) setUser(result.user);
    return result;
  };
  const changePassword = async (current: string, next: string) => {
    if (!user) return { ok: false, message: 'Your session has expired. Please sign in again.' };
    const result = await authService.changePassword(user.email, current, next);
    if (result.user) setUser(result.user);
    return result;
  };
  const signOut = async () => { await authService.signOut(); setUser(null); };
  const value = useMemo(() => ({ user, isLoading, authMode: AUTH_MODE, signIn, signUp, requestPasswordReset: authService.requestPasswordReset.bind(authService), resetPassword: authService.resetPassword.bind(authService), updateProfile, changePassword, signOut }), [user, isLoading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}