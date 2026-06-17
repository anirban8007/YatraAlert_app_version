import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../utils/api';

export default function LoginScreen({ onLoginSuccess, onSkip }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else onLoginSuccess();
    setLoading(false);
  }

  async function handleSignUp() {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else alert('Check your email for the confirmation link!');
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>🚂 YatraAlert</Text>
        <Text style={styles.subtitle}>Secure your journeys</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleSignUp} disabled={loading}>
          <Text style={styles.secondaryBtnText}>Create Account</Text>
        </TouchableOpacity>

        {/* --- GOOGLE AUTH PLACEHOLDER --- */}
        <TouchableOpacity style={styles.googleBtn} onPress={() => alert("Google Auth requires Google Cloud setup. Coming soon!")}>
          <Text style={styles.googleBtnText}>G Continue with Google</Text>
        </TouchableOpacity>

        {/* --- SKIP FOR TESTING --- */}
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Skip for now (Testing) →</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2563EB', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  logo: { fontSize: 28, fontWeight: '900', color: '#1E3A8A', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  input: { backgroundColor: '#F1F5F9', padding: 14, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  primaryBtn: { backgroundColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  secondaryBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  secondaryBtnText: { color: '#2563EB', fontWeight: 'bold' },
  googleBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  googleBtnText: { color: '#334155', fontWeight: 'bold' },
  skipBtn: { marginTop: 24, alignItems: 'center' },
  skipText: { color: '#64748B', fontWeight: '600' },
  error: { color: '#EF4444', marginBottom: 12, textAlign: 'center' }
});