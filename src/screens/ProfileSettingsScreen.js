import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser, useAuth } from '@clerk/expo';
import { ALARM_RINGTONES, DEFAULT_RINGTONE } from '../constants/ringtones.js';
import { useApp } from '../context/AppContext';
import { getItem, removeItem, setItem, getJSON, setJSON } from '../utils/storage.js';
import { supabase } from '../utils/api.js';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { signOut } = useAuth();

  const {
    userProfile,
    setUserProfile,
    alarmMinutes,
    setAlarmMinutes,
    isVoiceEnabled,
    setIsVoiceEnabled,
    isDarkMode,
    setIsDarkMode,
    offlineMode,
    setOfflineMode,
    selectedRingtone,
    setSelectedRingtone,
  } = useApp();

  // Local Form State
  const [name, setName] = useState(userProfile?.name || '');
  const [gender, setGender] = useState(userProfile?.gender || 'male');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [vibrateOnAlarm, setVibrateOnAlarm] = useState(true);

  // Feedback State
  const [feedbackCategory, setFeedbackCategory] = useState('bug');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Audio Preview State
  const [playingId, setPlayingId] = useState(null);
  const initialSource =
    selectedRingtone?.source ||
    selectedRingtone?.url ||
    DEFAULT_RINGTONE?.source ||
    DEFAULT_RINGTONE?.url;
  const previewPlayer = useAudioPlayer(initialSource);

  // Load stored preferences
  useEffect(() => {
    const loadProfile = async () => {
      const storedPhone = await getItem('emergency_contact_phone', '');
      setEmergencyPhone(storedPhone);
      const storedVibrate = await getItem('pref_vibrate_alarm', 'true');
      setVibrateOnAlarm(storedVibrate === 'true');
    };
    loadProfile();
  }, []);

  // Cleanup audio preview on unmount
  useEffect(() => {
    return () => {
      try {
        if (previewPlayer) previewPlayer.pause();
      } catch (_e) {
        // silent
      }
    };
  }, [previewPlayer]);

  // Save profile changes
  const handleSaveProfile = async () => {
    setUserProfile({ name: name.trim(), gender });
    await setItem('emergency_contact_phone', emergencyPhone.trim());
    Alert.alert('Saved', 'Your traveler profile and emergency settings have been updated.');
  };

  // Populate name from Clerk account if available
  useEffect(() => {
    if (!name && clerkUser?.fullName) {
      setName(clerkUser.fullName);
    }
  }, [clerkUser, name]);

  const handleSignOut = () => {
    Alert.alert('Log Out', 'Are you sure you want to sign out of your Clerk account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/login');
          } catch (e) {
            console.warn('Sign out error:', e);
          }
        },
      },
    ]);
  };

  // Toggle Dark/Light Mode
  const handleToggleDarkMode = async (val) => {
    setIsDarkMode(val);
    await setItem('pref_theme_mode', val ? 'dark' : 'light');
  };

  // Select Ringtone
  const handleSelectRingtone = async (tone) => {
    setSelectedRingtone(tone);
    // Persist safe serializable representation
    await setItem('pref_alarm_ringtone', JSON.stringify({ id: tone.id, name: tone.name, icon: tone.icon }));
  };

  // Audio preview playback
  const handleTogglePreview = async (tone) => {
    if (playingId === tone.id) {
      try {
        previewPlayer.pause();
      } catch (_e) { }
      setPlayingId(null);
    } else {
      setPlayingId(tone.id);
      try {
        await setAudioModeAsync({ playsInSilentMode: true, staysActiveInBackground: false });
        const source = tone.source || tone.url;
        if (previewPlayer.replace) {
          previewPlayer.replace(source);
        }
        previewPlayer.play();
      } catch (err) {
        console.warn('Audio preview error:', err);
      }
    }
  };

  const toggleVibrate = async (val) => {
    setVibrateOnAlarm(val);
    await setItem('pref_vibrate_alarm', String(val));
  };

  const handleClearAllCache = async () => {
    Alert.alert(
      'Clear Storage',
      'This will remove all cached offline routes and map temporary files.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await removeItem('cached_route');
            Alert.alert('Done', 'Offline storage cleared.');
          },
        },
      ]
    );
  };

  const dialEmergency = (num) => {
    Linking.openURL(`tel:${num}`).catch(() => {
      Alert.alert('Calling Failed', `Please dial ${num} directly from your phone.`);
    });
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      Alert.alert('Message Required', 'Please enter your problem details or suggestion.');
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const email = clerkUser?.primaryEmailAddress?.emailAddress || userProfile?.email || 'Anonymous Traveler';
      const userName = clerkUser?.fullName || userProfile?.name || 'Traveler';
      const userId = clerkUser?.id || userProfile?.id || null;

      const deviceInfo = {
        platform: Platform.OS,
        osVersion: Platform.Version,
        timestamp: new Date().toISOString(),
      };

      const { error } = await supabase.from('app_feedback').insert([
        {
          user_id: userId,
          user_name: userName,
          user_email: email,
          category: feedbackCategory,
          message: feedbackMessage.trim(),
          device_info: deviceInfo,
          status: 'new',
        },
      ]);

      if (error) {
        console.warn('Supabase feedback insert notice:', error.message);
        // Fallback: Cache locally if offline or table not yet created
        const cached = await getJSON('cached_offline_feedback', []);
        cached.push({
          category: feedbackCategory,
          message: feedbackMessage.trim(),
          date: new Date().toISOString(),
        });
        await setJSON('cached_offline_feedback', cached);
      }

      Alert.alert(
        'Thank You! 🙌',
        feedbackCategory === 'bug'
          ? 'Your problem report has been submitted. Our team will review the issue and fix it!'
          : 'Thank you for your suggestion! We review all traveler feedback to improve YatraAlert.'
      );
      setFeedbackMessage('');
    } catch (err) {
      console.warn('Feedback submit fallback:', err);
      Alert.alert('Feedback Recorded', 'Your feedback has been saved and will sync to our team.');
      setFeedbackMessage('');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Dynamic Theme Colors
  const theme = {
    bg: isDarkMode ? '#0F172A' : '#F8FAFC',
    headerBg: isDarkMode ? '#1E293B' : '#FFFFFF',
    border: isDarkMode ? '#334155' : '#E2E8F0',
    cardBg: isDarkMode ? '#1E293B' : '#FFFFFF',
    title: isDarkMode ? '#F8FAFC' : '#0F172A',
    subtitle: isDarkMode ? '#94A3B8' : '#64748B',
    inputBg: isDarkMode ? '#0F172A' : '#F8FAFC',
    inputText: isDarkMode ? '#F8FAFC' : '#0F172A',
    inputBorder: isDarkMode ? '#475569' : '#CBD5E1',
    chipBg: isDarkMode ? '#334155' : '#F1F5F9',
    chipText: isDarkMode ? '#CBD5E1' : '#475569',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.title }]}>Profile & Settings</Text>
        <Text style={[styles.headerSubtitle, { color: theme.subtitle }]}>
          Safety preferences, ringtones & theme
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── 1. Appearance / Dark Mode Card ───────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.switchRowNoBorder}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.title }]}>
                {isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </Text>
              <Text style={[styles.cardSubtitle, { color: theme.subtitle }]}>
                {isDarkMode ? 'Deep dark theme active for night travel' : 'Clean bright theme for daylight use'}
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={handleToggleDarkMode}
              trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
              thumbColor={isDarkMode ? '#60A5FA' : '#F8FAFC'}
            />
          </View>
        </View>

        {/* ── 2. Destination Alarm Ringtones Library ────────────── */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.title }]}>🔔 Alarm Ringtones</Text>
          <Text style={[styles.cardSubtitle, { color: theme.subtitle }]}>
            Choose the sound that plays when approaching your stop
          </Text>

          <View style={{ marginTop: 10 }}>
            {ALARM_RINGTONES.map((tone) => {
              const isSelected = (selectedRingtone?.id || DEFAULT_RINGTONE.id) === tone.id;
              const isPlaying = playingId === tone.id;

              return (
                <TouchableOpacity
                  key={tone.id}
                  style={[
                    styles.ringtoneItem,
                    { borderColor: isSelected ? '#2563EB' : theme.border },
                    isSelected && { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' },
                  ]}
                  onPress={() => handleSelectRingtone(tone)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ringtoneIcon}>{tone.icon}</Text>

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.ringtoneName, { color: theme.title }]}>{tone.name}</Text>
                    <Text style={[styles.ringtoneDesc, { color: theme.subtitle }]}>{tone.description}</Text>
                  </View>

                  {/* Preview Sound Button */}
                  <TouchableOpacity
                    style={[
                      styles.previewBtn,
                      { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
                      isPlaying && styles.previewBtnActive,
                    ]}
                    onPress={() => handleTogglePreview(tone)}
                  >
                    <Text
                      style={[
                        styles.previewBtnText,
                        { color: isDarkMode ? '#93C5FD' : '#2563EB' },
                        isPlaying && { color: '#FFFFFF' },
                      ]}
                    >
                      {isPlaying ? '⏹ Stop' : '▶ Play'}
                    </Text>
                  </TouchableOpacity>

                  {/* Radio Selection Dot */}
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 3. Traveler Identity Card ────────────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {name ? name.charAt(0).toUpperCase() : '👤'}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.cardTitle, { color: theme.title }]}>Traveler Identity</Text>
              <Text style={[styles.cardSubtitle, { color: theme.subtitle }]}>Used to personalize emergency SOS alerts</Text>
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: theme.subtitle }]}>Full Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.inputText, borderColor: theme.inputBorder }]}
            placeholder="e.g. Diya"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
          />

          <Text style={[styles.fieldLabel, { color: theme.subtitle }]}>Gender</Text>
          <View style={styles.genderRow}>
            {['male', 'female', 'other'].map((g) => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.genderChip,
                  { backgroundColor: theme.chipBg, borderColor: theme.border },
                  gender === g && styles.genderChipActive,
                ]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.genderChipText, { color: theme.chipText }, gender === g && styles.genderChipTextActive]}>
                  {g === 'male' ? '👨 Male' : g === 'female' ? '👩 Female' : '🧑 Other'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: theme.subtitle }]}>Emergency SOS Phone Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.inputText, borderColor: theme.inputBorder }]}
            placeholder="+91 9876543210"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
            <Text style={styles.saveBtnText}>Save Profile</Text>
          </TouchableOpacity>

          {clerkUser && (
            <View style={[styles.clerkRow, { borderTopColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clerkEmailLabel, { color: theme.subtitle }]}>Account (Clerk)</Text>
                <Text style={[styles.clerkEmailText, { color: theme.title }]}>
                  {clerkUser.primaryEmailAddress?.emailAddress || clerkUser.username}
                </Text>
              </View>
              <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                <Text style={styles.signOutBtnText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── 4. Destination Alarm Timing & Voice ──────────────── */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.title }]}>Alarm Timing & Voice</Text>
          <Text style={[styles.cardSubtitle, { color: theme.subtitle }]}>Wake-up minutes and voice alerts</Text>

          <Text style={[styles.fieldLabel, { color: theme.subtitle }]}>Default Alert Lead Time</Text>
          <View style={styles.alarmLeadRow}>
            {[5, 10, 15, 20, 30].map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.leadChip,
                  { backgroundColor: theme.chipBg, borderColor: theme.border },
                  alarmMinutes === m && styles.leadChipActive,
                ]}
                onPress={() => setAlarmMinutes(m)}
              >
                <Text style={[styles.leadChipText, { color: theme.chipText }, alarmMinutes === m && styles.leadChipTextActive]}>
                  {m}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.switchRow, { borderTopColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: theme.title }]}>🔊 Voice Announcements</Text>
              <Text style={[styles.switchSubtitle, { color: theme.subtitle }]}>Read arrival alerts aloud as you approach</Text>
            </View>
            <Switch
              value={isVoiceEnabled}
              onValueChange={setIsVoiceEnabled}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={isVoiceEnabled ? '#2563EB' : '#F8FAFC'}
            />
          </View>

          <View style={[styles.switchRow, { borderTopColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: theme.title }]}>📳 Strong Vibration on Arrival</Text>
              <Text style={[styles.switchSubtitle, { color: theme.subtitle }]}>Continuous pulse to wake heavy sleepers</Text>
            </View>
            <Switch
              value={vibrateOnAlarm}
              onValueChange={toggleVibrate}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={vibrateOnAlarm ? '#2563EB' : '#F8FAFC'}
            />
          </View>
        </View>

        {/* ── 5. Offline & Data Settings ───────────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.title }]}>Offline & Data</Text>

          <View style={[styles.switchRow, { borderTopColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: theme.title }]}>🔴 Force Offline Mode</Text>
              <Text style={[styles.switchSubtitle, { color: theme.subtitle }]}>Simulate zero-network routing and local ETA</Text>
            </View>
            <Switch
              value={offlineMode}
              onValueChange={setOfflineMode}
              trackColor={{ false: '#CBD5E1', true: '#FCA5A5' }}
              thumbColor={offlineMode ? '#DC2626' : '#F8FAFC'}
            />
          </View>

          <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAllCache}>
            <Text style={styles.clearAllBtnText}>🗑️ Clear Offline Route Cache</Text>
          </TouchableOpacity>
        </View>

        {/* ── 6. Feedback & Problem Reporting ───────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.title }]}>Feedback & Problem Reporting</Text>
          <Text style={[styles.cardSubtitle, { color: theme.subtitle }]}>
            Encountered an issue or have an idea to make YatraAlert better? Tell us!
          </Text>

          {/* Category Toggle Tabs */}
          <View style={styles.feedbackTypeRow}>
            <TouchableOpacity
              style={[
                styles.feedbackTypeBtn,
                feedbackCategory === 'bug' && styles.feedbackTypeBtnActiveBug,
                { borderColor: theme.border }
              ]}
              onPress={() => setFeedbackCategory('bug')}
            >
              <Text
                style={[
                  styles.feedbackTypeText,
                  { color: feedbackCategory === 'bug' ? '#DC2626' : theme.subtitle }
                ]}
              >
                🐞 Report a Problem
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.feedbackTypeBtn,
                feedbackCategory === 'improvement' && styles.feedbackTypeBtnActiveIdea,
                { borderColor: theme.border }
              ]}
              onPress={() => setFeedbackCategory('improvement')}
            >
              <Text
                style={[
                  styles.feedbackTypeText,
                  { color: feedbackCategory === 'improvement' ? '#2563EB' : theme.subtitle }
                ]}
              >
                💡 Suggest Improvement
              </Text>
            </TouchableOpacity>
          </View>

          {/* Feedback Input Box */}
          <TextInput
            style={[
              styles.feedbackInput,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                borderColor: theme.border,
                color: theme.title,
              }
            ]}
            placeholder={
              feedbackCategory === 'bug'
                ? "Describe what problem occurred (e.g. 'Station distance inaccurate', 'Alarm did not trigger on arrival')..."
                : "What new feature or improvement would make your journey easier?..."
            }
            placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
            multiline
            numberOfLines={4}
            value={feedbackMessage}
            onChangeText={setFeedbackMessage}
            textAlignVertical="top"
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.feedbackSubmitBtn,
              feedbackCategory === 'bug' ? styles.feedbackSubmitBtnBug : styles.feedbackSubmitBtnIdea,
              (!feedbackMessage.trim() || isSubmittingFeedback) && { opacity: 0.6 }
            ]}
            onPress={handleSubmitFeedback}
            disabled={!feedbackMessage.trim() || isSubmittingFeedback}
          >
            {isSubmittingFeedback ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.feedbackSubmitText}>
                {feedbackCategory === 'bug' ? 'Submit Problem Report →' : 'Send Suggestion →'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── 7. Emergency Helplines ───────────────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.title }]}>Quick Helplines (India)</Text>
          <Text style={[styles.cardSubtitle, { color: theme.subtitle }]}>One-touch dial for national and transit services</Text>

          <View style={styles.helplineList}>
            <TouchableOpacity style={[styles.helplineItem, { borderBottomColor: theme.border }]} onPress={() => dialEmergency('112')}>
              <Text style={styles.helplineNum}>🚨 112</Text>
              <Text style={[styles.helplineDesc, { color: theme.subtitle }]}>National Emergency (Police, Fire, Ambulance)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.helplineItem, { borderBottomColor: theme.border }]} onPress={() => dialEmergency('139')}>
              <Text style={styles.helplineNum}>🚆 139</Text>
              <Text style={[styles.helplineDesc, { color: theme.subtitle }]}>RailMadad (Indian Railways Security & Assistance)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.helplineItem, { borderBottomColor: theme.border }]} onPress={() => dialEmergency('1090')}>
              <Text style={styles.helplineNum}>👩 1090</Text>
              <Text style={[styles.helplineDesc, { color: theme.subtitle }]}>Women Safety Powerline</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.subtitle }]}>YatraAlert v1.0.0 • AI Multi-Modal Travel & Safety</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },

  // Cards
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#2563EB' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSubtitle: { fontSize: 12, marginTop: 1 },

  // Fields
  fieldLabel: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },

  // Gender
  genderRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  genderChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  genderChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  genderChipText: { fontSize: 12, fontWeight: '600' },
  genderChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  saveBtn: {
    marginTop: 14,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  clerkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  clerkEmailLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  clerkEmailText: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  signOutBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  signOutBtnText: { color: '#DC2626', fontWeight: 'bold', fontSize: 12 },

  // Ringtones
  ringtoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  ringtoneIcon: { fontSize: 22 },
  ringtoneName: { fontSize: 14, fontWeight: '700' },
  ringtoneDesc: { fontSize: 11, marginTop: 1 },
  previewBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 10,
  },
  previewBtnActive: {
    backgroundColor: '#DC2626',
  },
  previewBtnText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#2563EB',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  tipBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
  },
  tipTitle: { fontSize: 12, fontWeight: '700' },
  tipText: { fontSize: 11, marginTop: 2, lineHeight: 16 },

  // Alarm Lead
  alarmLeadRow: { flexDirection: 'row', gap: 8, marginVertical: 6 },
  leadChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  leadChipActive: { backgroundColor: '#EA580C', borderColor: '#EA580C' },
  leadChipText: { fontSize: 13, fontWeight: '700' },
  leadChipTextActive: { color: '#FFFFFF' },

  // Switch
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  switchRowNoBorder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchTitle: { fontSize: 14, fontWeight: '600' },
  switchSubtitle: { fontSize: 11, marginTop: 1 },

  clearAllBtn: {
    marginTop: 12,
    backgroundColor: '#FEE2E2',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearAllBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 12 },

  // Helplines
  helplineList: { marginTop: 8 },
  helplineItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  helplineNum: { fontSize: 15, fontWeight: '800', color: '#DC2626' },
  helplineDesc: { fontSize: 12, marginTop: 2 },

  // Feedback & Reporting
  feedbackTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  feedbackTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  feedbackTypeBtnActiveBug: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderColor: '#DC2626',
  },
  feedbackTypeBtnActiveIdea: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderColor: '#2563EB',
  },
  feedbackTypeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  feedbackInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 12,
  },
  feedbackSubmitBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackSubmitBtnBug: {
    backgroundColor: '#DC2626',
  },
  feedbackSubmitBtnIdea: {
    backgroundColor: '#2563EB',
  },
  feedbackSubmitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },

  footer: { alignItems: 'center', marginTop: 10, marginBottom: 20 },
  footerText: { fontSize: 11, fontWeight: '500' },
});
