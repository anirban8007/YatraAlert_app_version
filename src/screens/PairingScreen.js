import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRole } from '../context/RoleContext';
import { supabase } from '../utils/api';
import ShakeAnimation from '../components/ShakeAnimation';

export default function PairingScreen({ mode, onClose }) {
  const { userId } = useRole();
  const [pairingCode, setPairingCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSuccessGuide, setShowSuccessGuide] = useState(false);

  // When traveler generates code, listen for guardian claiming it
  useEffect(() => {
    if (!generatedCode || mode !== 'Traveler') return;

    let subscription = null;
    let pollInterval = null;

    const setupListener = () => {
      // 1. Realtime subscription on guardian_pairings table
      subscription = supabase
        .channel(`pairing-${generatedCode}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'guardian_pairings',
            filter: `pairing_code=eq.${generatedCode}`,
          },
          (payload) => {
            if (payload.new && payload.new.status === 'active') {
              setShowSuccessGuide(true);
            }
          }
        )
        .subscribe();

      // 2. Fallback polling every 3 seconds in case realtime event is missed
      pollInterval = setInterval(async () => {
        try {
          const { data } = await supabase
            .from('guardian_pairings')
            .select('status')
            .eq('pairing_code', generatedCode)
            .maybeSingle();

          if (data && data.status === 'active') {
            setShowSuccessGuide(true);
            clearInterval(pollInterval);
          }
        } catch (_e) {}
      }, 3000);
    };

    setupListener();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [generatedCode, mode]);

  const generateCode = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID is missing. Please log in or restart the app.');
      return;
    }
    setLoading(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const { error } = await supabase
      .from('guardian_pairings')
      .insert([
        {
          traveler_id: userId,
          guardian_id: '00000000-0000-0000-0000-000000000000', // Placeholder until claimed
          pairing_code: code,
          status: 'pending'
        }
      ]);
    
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setGeneratedCode(code);
    }
  };

  const connectToTraveler = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID is missing. Please log in or restart the app.');
      return;
    }
    if (pairingCode.length !== 6) {
      Alert.alert('Invalid Code', 'Code must be 6 digits.');
      return;
    }
    setLoading(true);
    
    // Find the pending pairing
    const { data, error } = await supabase
      .from('guardian_pairings')
      .select('*')
      .eq('pairing_code', pairingCode)
      .eq('status', 'pending')
      .single();

    if (error || !data) {
      setLoading(false);
      Alert.alert('Error', 'Invalid or expired code.');
      return;
    }

    // Claim it
    const { error: updateError } = await supabase
      .from('guardian_pairings')
      .update({ guardian_id: userId, status: 'active' })
      .eq('id', data.id);

    setLoading(false);
    
    if (updateError) {
      Alert.alert('Error', updateError.message);
    } else {
      // Show guidance animation to guardian after pairing as well
      setShowSuccessGuide(true);
      setPairingCode('');
    }
  };

  // If pairing succeeded, render the SOS guidance guide
  if (showSuccessGuide) {
    return (
      <ScrollView contentContainerStyle={styles.guideScrollContainer}>
        <View style={styles.guideCard}>
          <Text style={styles.successBadge}>✅ PAIRING COMPLETE</Text>
          <Text style={styles.guideTitle}>Guardian Linked Successfully!</Text>
          <Text style={styles.guideSubtitle}>
            Now that your devices are connected, emergency alerts will dispatch live location updates.
          </Text>

          {/* Animated Demonstration */}
          <View style={styles.animationSection}>
            <Text style={styles.sectionHeader}>🚨 HOW TO ACTIVATE SOS</Text>
            <ShakeAnimation />
          </View>

          {/* Step-by-Step Instructions */}
          <View style={styles.rulesBox}>
            <Text style={styles.ruleItem}>
              1️⃣ <Text style={styles.boldText}>Gesture:</Text> Firmly shake your phone <Text style={styles.highlightText}>Left → Right → Left</Text> within 2 seconds.
            </Text>
            <Text style={styles.ruleItem}>
              2️⃣ <Text style={styles.boldText}>5-Sec Countdown:</Text> A voice warning plays. Tap <Text style={styles.boldText}>Cancel SOS</Text> anytime if accidental.
            </Text>
            <Text style={styles.ruleItem}>
              3️⃣ <Text style={styles.boldText}>Live Tracking:</Text> Coordinates update every 60s until you tap Stop.
            </Text>
            <Text style={styles.ruleItem}>
              4️⃣ <Text style={styles.boldText}>Manual Fallback:</Text> You can also tap the red SOS button on your screen anytime.
            </Text>
          </View>

          <TouchableOpacity style={styles.finishBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.finishBtnText}>Got it, Return to Map ✓</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pairing Setup</Text>
      <Text style={styles.subtitle}>Current Mode: {mode}</Text>

      {mode === 'Traveler' ? (
        <View style={styles.card}>
          <Text style={styles.instruction}>Generate a code to share with your Guardian.</Text>
          {generatedCode ? (
            <>
              <Text style={styles.codeDisplay}>{generatedCode}</Text>
              <Text style={styles.waitingText}>⏳ Waiting for Guardian to connect...</Text>
              <TouchableOpacity
                style={[styles.btn, styles.secondaryBtn]}
                onPress={() => setShowSuccessGuide(true)}
              >
                <Text style={styles.secondaryBtnText}>View SOS Gesture Guide →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.btn} onPress={generateCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Generate Code</Text>}
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.instruction}>Enter the 6-digit code from the Traveler.</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            maxLength={6}
            value={pairingCode}
            onChangeText={setPairingCode}
            placeholder="000000"
          />
          <TouchableOpacity style={styles.btn} onPress={connectToTraveler} disabled={loading}>
             {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Connect</Text>}
          </TouchableOpacity>
        </View>
      )}

      {onClose && (
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#F8FAFC', justifyContent: 'center' },
  guideScrollContainer: { padding: 20, backgroundColor: '#F8FAFC', flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0F172A', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 40 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  instruction: { fontSize: 16, color: '#334155', marginBottom: 24, textAlign: 'center' },
  codeDisplay: { fontSize: 48, fontWeight: 'bold', color: '#2563EB', textAlign: 'center', letterSpacing: 4 },
  waitingText: { fontSize: 13, color: '#64748B', textAlign: 'center', marginVertical: 12 },
  input: { backgroundColor: '#F1F5F9', fontSize: 24, padding: 16, borderRadius: 8, textAlign: 'center', marginBottom: 24, letterSpacing: 4 },
  btn: { backgroundColor: '#2563EB', padding: 16, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  secondaryBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', marginTop: 12 },
  secondaryBtnText: { color: '#2563EB', fontWeight: 'bold', fontSize: 14 },
  closeBtn: { marginTop: 24, alignItems: 'center' },
  closeBtnText: { color: '#64748B', fontSize: 16, fontWeight: 'bold' },

  // Guide styles
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  successBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 6,
  },
  guideTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  guideSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  animationSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 4,
  },
  rulesBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    gap: 8,
  },
  ruleItem: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  highlightText: {
    fontWeight: '800',
    color: '#2563EB',
  },
  finishBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  finishBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
