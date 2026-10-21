import React from 'react';
import { Tabs } from 'expo-router';
import { Text, StyleSheet } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
      }}
    >
      {/* 1. Yatra (Navigation, Map, Alarm, Multi-Modal) */}
      <Tabs.Screen
        name="client"
        options={{
          title: 'Yatra',
          tabBarIcon: ({ focused }) => (
            <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>🧭</Text>
          ),
        }}
      />

      {/* 2. Stations & Saved (Live Railway Radar & Offline Routes) */}
      <Tabs.Screen
        name="stations"
        options={{
          title: 'Stations',
          tabBarIcon: ({ focused }) => (
            <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>🚆</Text>
          ),
        }}
      />

      {/* 3. Guardian (Traveler Monitoring, Pairing, SOS) */}
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Guardian',
          tabBarIcon: ({ focused }) => (
            <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>🛡️</Text>
          ),
        }}
      />

      {/* 4. Profile & Settings (Preferences, Alarm Lead Time, Contacts, Helplines) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>⚙️</Text>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: -2,
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.7,
  },
  tabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.15 }],
  },
});
