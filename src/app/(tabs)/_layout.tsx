import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2563EB' }}>
      <Tabs.Screen
        name="client"
        options={{
          title: 'Traveler',
          tabBarIcon: () => <Text>📍</Text>,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Guardian',
          tabBarIcon: () => <Text>🛡️</Text>,
        }}
      />
    </Tabs>
  );
}
