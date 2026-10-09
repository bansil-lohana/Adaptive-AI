import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
export default function Entry() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />;
}