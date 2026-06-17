import React from 'react';
import HomeScreen from '../screens/HomeScreen';
import { useAuth } from '../context/AuthContext';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1a237e" />
      </View>
    );
  }

  return <Redirect href="/login" />;
}