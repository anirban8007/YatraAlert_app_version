import React, { createContext, useState, useContext } from 'react';

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

  // App Settings
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

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
    isVoiceEnabled, setIsVoiceEnabled,
    isDarkMode, setIsDarkMode,
    offlineMode, setOfflineMode,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);