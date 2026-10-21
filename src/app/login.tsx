import '../utils/cryptoPolyfill';
import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, KeyboardAvoidingView, Platform, ImageBackground, Alert, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useSignIn, useSignUp, useSSO } from '@clerk/expo';
import { useAuth } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { session, skipLogin } = useAuth();
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn() as any;
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp() as any;
  const { startSSOFlow } = useSSO();

  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP Verification state for Sign Up
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  // Warm up web browser on Android for snappier OAuth experience
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  // ── 0. Clerk Google OAuth Handler ─────────────────────────────
  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const redirectUrl = Linking.createURL('/(tabs)/client', { scheme: 'yatraalertapp' });
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/(tabs)/client');
      }
    } catch (err: any) {
      const msg = err.errors?.[0]?.message || err.message || 'Google sign in failed';
      Alert.alert('Google Sign In', msg);
    } finally {
      setLoading(false);
    }
  }

  // ── 1. Clerk Sign In Handler ──────────────────────────────────
  async function handleLogin() {
    if (!isSignInLoaded) return;
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        router.replace('/(tabs)/client');
      } else {
        console.warn('Sign in status:', result.status);
        Alert.alert('Sign In', 'Additional verification needed on your account.');
      }
    } catch (err: any) {
      const msg = err.errors?.[0]?.message || err.message || 'Failed to sign in';
      Alert.alert('Sign In Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  // ── 2. Clerk Sign Up Handler (Triggers OTP Email) ─────────────
  async function handleSignUp() {
    if (!isSignUpLoaded) return;
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      // Create user with Clerk
      await signUp.create({
        emailAddress: email.trim(),
        password,
      });

      // Send 6-digit email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      const msg = err.errors?.[0]?.message || err.message || 'Failed to sign up';
      Alert.alert('Sign Up Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  // ── 3. Verify OTP Code ────────────────────────────────────────
  async function handleVerifyOtp() {
    if (!isSignUpLoaded) return;
    if (!verificationCode.trim()) {
      Alert.alert('Code Required', 'Please enter the 6-digit code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
        router.replace('/(tabs)/client');
      } else {
        Alert.alert('Verification Incomplete', 'Please check the code and try again.');
      }
    } catch (err: any) {
      const msg = err.errors?.[0]?.message || err.message || 'Invalid code';
      Alert.alert('Verification Error', msg);
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    skipLogin();
    router.replace('/(tabs)/client');
  }

  return (
    <ImageBackground 
      source={require('../../assets/images/login-bg.jpg')} 
      style={styles.background}
      resizeMode="cover"
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.glassCard}>
          <Text style={styles.title}>YatraAlert</Text>
          <Text style={styles.subtitle}>
            {pendingVerification 
              ? 'Verify your email' 
              : isSignUpMode 
                ? 'Create your traveler account' 
                : 'Sign in to access journey radar'}
          </Text>

          {session ? (
            <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/client')}>
              <Text style={styles.buttonText}>Continue to Journey →</Text>
            </TouchableOpacity>
          ) : pendingVerification ? (
            /* OTP Verification Form */
            <>
              <Text style={styles.otpPrompt}>
                Enter the 6-digit code sent to:{"\n"}
                <Text style={{ fontWeight: 'bold', color: '#fff' }}>{email}</Text>
              </Text>
              <TextInput
                style={[styles.input, { letterSpacing: 4, textAlign: 'center', fontSize: 20 }]}
                placeholder="123456"
                placeholderTextColor="#FFFFFF"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Continue →</Text>}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modeSwitchBtn} 
                onPress={() => setPendingVerification(false)}
              >
                <Text style={styles.modeSwitchText}>← Back to Sign Up</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Sign In / Sign Up Form */
            <>
              {/* Official Google Sign In */}
              <TouchableOpacity 
                style={[styles.button, styles.googleButton]} 
                onPress={handleGoogleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1f1f1f" />
                ) : (
                  <View style={styles.googleBtnContent}>
                    <Image 
                      source={require('../../assets/images/google-logo.png')} 
                      style={styles.googleIcon} 
                      resizeMode="contain" 
                    />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or with email</Text>
                <View style={styles.dividerLine} />
              </View>

              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#FFFFFF"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="Password (8+ chars)"
                placeholderTextColor="#FFFFFF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity 
                style={styles.button} 
                onPress={isSignUpMode ? handleSignUp : handleLogin} 
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {isSignUpMode ? 'Sign Up (Email Code)' : 'Sign In'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modeSwitchBtn} 
                onPress={() => setIsSignUpMode(!isSignUpMode)}
              >
                <Text style={styles.modeSwitchText}>
                  {isSignUpMode 
                    ? 'Already have an account? Sign In' 
                    : "Don't have an account? Create one"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip for now →</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Much more transparent glass effect
    padding: 30,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#fff', 
    textAlign: 'center', 
    marginBottom: 5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3
  },
  subtitle: { 
    fontSize: 16, 
    color: '#eee', 
    textAlign: 'center', 
    marginBottom: 25, 
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
  },
  input: { 
    backgroundColor: 'rgba(0, 0, 0, 0.45)', // Solid dark background for crystal-clear white placeholder contrast
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 15, 
    borderWidth: 1.5, 
    borderColor: 'rgba(255, 255, 255, 0.65)',
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600'
  },
  button: { 
    backgroundColor: 'rgba(26, 35, 126, 0.6)', // Transparent blue glass
    padding: 15, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)'
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  googleButton: {
    backgroundColor: '#ffffff', // Standard crisp white background for Google button
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    color: '#3c4043',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    color: '#eee',
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  skipButton: { 
    marginTop: 20, 
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  skipText: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
  },
  otpPrompt: {
    color: '#eee',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  modeSwitchBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  modeSwitchText: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
