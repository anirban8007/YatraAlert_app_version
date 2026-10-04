import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Redirect } from 'expo-router';
import SplashAnimation from '../components/SplashAnimation';

export default function Index() {
  const { loading } = useAuth();

  if (loading) {
    return <SplashAnimation />;
  }

  return <Redirect href="/login" />;
}