import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { getSuggestions, geocode } from '../utils/api';
import { useApp } from '../context/AppContext';
import { getJSON, setJSON } from '../utils/storage';

export default function SearchBar({ onSelectDestination }) {
  const { currentLat, currentLng } = useApp();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      const savedHistory = await getJSON('searchHistory', []);
      setHistory(savedHistory);
    }
    loadHistory();
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await getSuggestions(query, currentLat, currentLng);
        setSuggestions(data || []);
      } catch (e) {
        console.warn("Suggestion error", e);
      }
      setLoading(false);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [query]);

  const saveToHistory = async (item) => {
    let newHistory = history.filter(h => h.label !== item.label);
    newHistory.unshift(item);
    if (newHistory.length > 5) {
      newHistory = newHistory.slice(0, 5);
    }
    setHistory(newHistory);
    await setJSON('searchHistory', newHistory);
  };

  const handleSelect = async (item) => {
    setQuery(item.label);
    setSuggestions([]);
    setShowDropdown(false);
    
    // If we need strict coordinates, geocode the label
    if (!item.lat || !item.lng) {
      setLoading(true);
      const geo = await geocode(item.label);
      setLoading(false);
      await saveToHistory(geo);
      onSelectDestination(geo);
    } else {
      await saveToHistory(item);
      onSelectDestination(item);
    }
  };

  const displayData = query.length < 2 ? history : suggestions;

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Text style={styles.icon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder="Search destination..."
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setShowDropdown(true);
          }}
          autoCorrect={false}
          onFocus={() => setShowDropdown(true)}
        />
        {loading && <ActivityIndicator size="small" color="#2563EB" />}
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setShowDropdown(false); }} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && displayData.length > 0 && (
        <View style={styles.dropdown}>
          {query.length < 2 && <Text style={styles.historyTitle}>Recent Searches</Text>}
          <FlatList
            data={displayData}
            keyExtractor={(item, idx) => idx.toString()}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestionItem} onPress={() => handleSelect(item)}>
                <Text style={styles.suggestionIcon}>
                  {query.length < 2 ? '🕒' : (item.icon === 'train' ? '🚉' : '📍')}
                </Text>
                <View style={styles.suggestionTextContainer}>
                  <Text style={styles.suggestionPrimary} numberOfLines={1}>{item.label.split(',')[0]}</Text>
                  <Text style={styles.suggestionSecondary} numberOfLines={1}>
                    {item.label.split(',').slice(1).join(',')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 50, left: 16, right: 16, zIndex: 100 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingHorizontal: 12, height: 50,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
  },
  icon: { fontSize: 18, marginRight: 8 },
  input: { flex: 1, fontSize: 16, color: '#333' },
  clearBtn: { padding: 8 },
  clearText: { color: '#888', fontSize: 16 },
  dropdown: {
    marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 12,
    maxHeight: 250, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  suggestionIcon: { fontSize: 18, width: 30, textAlign: 'center', opacity: 0.7 },
  suggestionTextContainer: { flex: 1 },
  suggestionPrimary: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  suggestionSecondary: { fontSize: 12, color: '#888', marginTop: 2 },
  historyTitle: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888',
    textTransform: 'uppercase'
  }
});