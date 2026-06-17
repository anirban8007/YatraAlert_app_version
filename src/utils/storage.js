import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getItem(key, defaultValue = null) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value !== null ? value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setItem(key, value) {
  try {
    await AsyncStorage.setItem(key, String(value));
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
}

export async function getJSON(key, defaultValue = []) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
}

export async function removeItem(key) {
  await AsyncStorage.removeItem(key);
}