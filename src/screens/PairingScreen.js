import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRole } from '../context/RoleContext';
import { supabase } from '../utils/api';

export default function PairingScreen({ mode, onClose }) {
  const { userId } = useRole();
  const [pairingCode, setPairingCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState(null);
  const [loading, setLoading] = useState(false);

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
      Alert.alert('Success', 'You are now paired with the Traveler.');
      setPairingCode('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pairing Setup</Text>
      <Text style={styles.subtitle}>Current Mode: {mode}</Text>

      {mode === 'Traveler' ? (
        <View style={styles.card}>
          <Text style={styles.instruction}>Generate a code to share with your Guardian.</Text>
          {generatedCode ? (
            <Text style={styles.codeDisplay}>{generatedCode}</Text>
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
  title: { fontSize: 24, fontWeight: 'bold', color: '#0F172A', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 40 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  instruction: { fontSize: 16, color: '#334155', marginBottom: 24, textAlign: 'center' },
  codeDisplay: { fontSize: 48, fontWeight: 'bold', color: '#2563EB', textAlign: 'center', letterSpacing: 4 },
  input: { backgroundColor: '#F1F5F9', fontSize: 24, padding: 16, borderRadius: 8, textAlign: 'center', marginBottom: 24, letterSpacing: 4 },
  btn: { backgroundColor: '#2563EB', padding: 16, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  closeBtn: { marginTop: 24, alignItems: 'center' },
  closeBtnText: { color: '#64748B', fontSize: 16, fontWeight: 'bold' }
});
