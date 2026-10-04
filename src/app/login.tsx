import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, KeyboardAvoidingView, Platform, ImageBackground
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getGoogleSignin, isGoogleAuthAvailable } from '../utils/googleAuth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { session, skipLogin } = useAuth();

  async function handleLogin() {
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      alert(error.message);
      setLoading(false);
    } else {
      router.replace('/(tabs)/client'); 
    }
  }

  function handleSkip() {
    skipLogin();
    router.replace('/(tabs)/client');
  }

  async function onGoogleButtonPress() {
    const GoogleSignin = getGoogleSignin();
    if (!isGoogleAuthAvailable() || !GoogleSignin) {
      alert('Google Native Sign-In is not supported in Expo Go. For testing in Expo Go, please use Email login or "Skip for now". (Google Native Sign-In requires a custom Development Build)');
      return;
    }

    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      if (userInfo.data && userInfo.data.idToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: userInfo.data.idToken,
        });
        if (error) {
          alert(error.message);
        } else {
          router.replace('/(tabs)/client');
        }
      } else {
        alert('Google Sign-In failed to get an ID token.');
      }
    } catch (e: any) {
      alert(e.message || 'Google sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground 
      // Replace with your actual image path or require() if you save it locally
      source={require('../../assets/images/login-bg.jpg')} 
      style={styles.background}
      resizeMode="cover"
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.glassCard}>
          <Text style={styles.title}>YatraAlert</Text>

          {session ? (
            <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/client')}>
              <Text style={styles.buttonText}>Get Started</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.googleButton]} onPress={onGoogleButtonPress} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in with Google</Text>}
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
    backgroundColor: 'rgba(255, 255, 255, 0.25)', // Much more transparent inputs
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.5)',
    color: '#fff',
    fontWeight: '500'
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
    backgroundColor: 'rgba(219, 68, 55, 0.6)', // Google red glass
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
  }
});
