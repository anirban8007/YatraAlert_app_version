import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { signInWithEmail, signUpWithEmail, signInWithGoogle, validateEmail, validatePassword } from '../utils/auth';

export default function LoginScreen({ onLoginSuccess, onSkip }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    setError('');
    
    // Validation
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    const result = await signInWithEmail(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setEmail('');
      setPassword('');
      onLoginSuccess();
    }
  }

  async function handleSignUp() {
    setError('');
    
    // Validation
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!validatePassword(password)) {
      setError('Password must be 8+ characters with uppercase, lowercase & numbers');
      return;
    }

    setLoading(true);
    const result = await signUpWithEmail(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      Alert.alert(
        'Signup Successful',
        result.message || 'Check your email to confirm your account',
        [
          {
            text: 'OK',
            onPress: () => {
              setEmail('');
              setPassword('');
              setIsSignUp(false);
            },
          },
        ]
      );
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    
    try {
      const result = await signInWithGoogle();
      setLoading(false);

      if (result.error) {
        setError(result.error);
      } else {
        // Google OAuth typically redirects, but if it doesn't:
        onLoginSuccess();
      }
    } catch (e) {
      setLoading(false);
      setError('Google sign-in failed. Please try again.');
      console.error(e);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.logo}>🚂 YatraAlert</Text>
          <Text style={styles.subtitle}>Secure your journeys</Text>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.error}>⚠️ {error}</Text>
            </View>
          ) : null}

          {/* Email Input */}
          <TextInput
            style={[styles.input, error && styles.inputError]}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
            placeholderTextColor="#999"
          />

          {/* Password Input */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, error && styles.inputError]}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
              disabled={!password}
            >
              <Text>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Password Requirements (Show on signup) */}
          {isSignUp && (
            <View style={styles.requirementsBox}>
              <Text style={styles.requirementText}>Password must contain:</Text>
              <Text style={[styles.requirementItem, password.length >= 8 ? styles.requirementMet : styles.requirementUnmet]}>
                ✓ At least 8 characters
              </Text>
              <Text style={[styles.requirementItem, /[A-Z]/.test(password) ? styles.requirementMet : styles.requirementUnmet]}>
                ✓ One uppercase letter
              </Text>
              <Text style={[styles.requirementItem, /[a-z]/.test(password) ? styles.requirementMet : styles.requirementUnmet]}>
                ✓ One lowercase letter
              </Text>
              <Text style={[styles.requirementItem, /[0-9]/.test(password) ? styles.requirementMet : styles.requirementUnmet]}>
                ✓ One number
              </Text>
            </View>
          )}

          {/* Primary Button */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{isSignUp ? 'Create Account' : 'Login'}</Text>
            )}
          </TouchableOpacity>

          {/* Toggle Button */}
          <TouchableOpacity style={styles.toggleBtn} onPress={() => { setIsSignUp(!isSignUp); setError(''); }} disabled={loading}>
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Auth Button */}
          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} disabled={loading}>
            <Text style={styles.googleBtnText}>🔵 Continue with Google</Text>
          </TouchableOpacity>

          {/* Skip Button */}
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip} disabled={loading}>
            <Text style={styles.skipText}>Skip for now (Testing) →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2563EB' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  logo: { fontSize: 28, fontWeight: '900', color: '#1E3A8A', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  errorBox: { backgroundColor: '#FEE2E2', borderLeftWidth: 4, borderLeftColor: '#DC2626', padding: 12, borderRadius: 8, marginBottom: 16 },
  error: { color: '#991B1B', fontWeight: '600', fontSize: 13 },
  input: { backgroundColor: '#F1F5F9', padding: 14, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 14 },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  passwordInput: { flex: 1, backgroundColor: '#F1F5F9', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 14 },
  eyeIcon: { position: 'absolute', right: 14, padding: 6 },
  requirementsBox: { backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#22C55E' },
  requirementText: { fontSize: 12, fontWeight: '600', color: '#166534', marginBottom: 8 },
  requirementItem: { fontSize: 12, marginVertical: 3 },
  requirementMet: { color: '#22C55E' },
  requirementUnmet: { color: '#94A3B8' },
  primaryBtn: { backgroundColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  toggleBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
  toggleText: { color: '#2563EB', fontWeight: '600', fontSize: 13 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { paddingHorizontal: 8, color: '#94A3B8', fontSize: 12 },
  googleBtn: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  googleBtnText: { color: '#2563EB', fontWeight: 'bold', fontSize: 14 },
  skipBtn: { marginTop: 8, alignItems: 'center', padding: 10 },
  skipText: { color: '#64748B', fontWeight: '600', fontSize: 13 },
});
