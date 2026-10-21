import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_RINGTONE } from '../constants/ringtones.js';

const AppContext = createContext();

export function AppProvider({ children }) {
  // Location State
  const [currentLat, setCurrentLat] = useState(null);
  const [currentLng, setCurrentLng] = useState(null);
  const [destLat, setDestLat] = useState(null);
  const [destLng, setDestLng] = useState(null);
  const [destName, setDestName] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);

  // Alarm & Journey State
  const [alarmMinutes, setAlarmMinutes] = useState(10);
  const [alarmSet, setAlarmSet] = useState(false);
  const [alarmTriggered, setAlarmTriggered] = useState(false);
  const [currentDurationMin, setCurrentDurationMin] = useState(null);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [selectedRingtone, setSelectedRingtone] = useState(DEFAULT_RINGTONE);

  // App Settings
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  // User Profile — name & gender for personalized SOS messages
  const [userProfile, setUserProfile] = useState({ name: null, gender: null });

  // Load persisted theme and ringtone preferences on startup
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem('pref_theme_mode');
        if (storedTheme !== null) {
          setIsDarkMode(storedTheme === 'dark');
        }
        const storedRingtone = await AsyncStorage.getItem('pref_alarm_ringtone');
        if (storedRingtone) {
          const parsed = JSON.parse(storedRingtone);
          const found = ALARM_RINGTONES.find((r) => r.id === parsed?.id);
          if (found) {
            setSelectedRingtone(found);
          } else {
            setSelectedRingtone(parsed);
          }
        }
      } catch (_e) {
        // silent
      }
    };
    loadPreferences();
  }, []);

  const value = {
    currentLat, setCurrentLat,
    currentLng, setCurrentLng,
    destLat, setDestLat,
    destLng, setDestLng,
    destName, setDestName,
    routeCoords, setRouteCoords,
    alarmMinutes, setAlarmMinutes,
    alarmSet, setAlarmSet,
    alarmTriggered, setAlarmTriggered,
    currentDurationMin, setCurrentDurationMin,
    journeyStarted, setJourneyStarted,
    selectedRingtone, setSelectedRingtone,
    isVoiceEnabled, setIsVoiceEnabled,
    isDarkMode, setIsDarkMode,
    offlineMode, setOfflineMode,
    userProfile, setUserProfile,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);