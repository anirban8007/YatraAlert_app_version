import { supabase } from './api';

// Validation functions
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  // Minimum 8 characters, at least one uppercase, one lowercase, one number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

// Email/Password Authentication
export async function signUpWithEmail(email, password) {
  try {
    // Validate inputs
    if (!email || !password) {
      return { error: 'Email and password are required' };
    }
    if (!validateEmail(email)) {
      return { error: 'Invalid email format' };
    }
    if (!validatePassword(password)) {
      return { error: 'Password must be at least 8 characters with uppercase, lowercase, and numbers' };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { error: error.message };
    }

    return {
      success: true,
      data,
      message: 'Signup successful! Check your email to confirm your account.',
    };
  } catch (e) {
    console.error('Signup error:', e);
    return { error: e.message };
  }
}

export async function signInWithEmail(email, password) {
  try {
    if (!email || !password) {
      return { error: 'Email and password are required' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    if (!data.user) {
      return { error: 'Login failed. User not found.' };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (e) {
    console.error('Login error:', e);
    return { error: e.message };
  }
}

// Google Authentication (React Native — uses native GoogleSignin + Supabase ID token exchange)
export async function signInWithGoogle() {
  try {
    const { getGoogleSignin, isGoogleAuthAvailable } = require('./googleAuth');
    
    if (!isGoogleAuthAvailable()) {
      return { error: 'Google Sign-In is not available in this build. Use email/password instead.' };
    }

    const GoogleSignin = getGoogleSignin();
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();

    // Support both old and new SDK response shapes
    const idToken = userInfo?.data?.idToken || userInfo?.idToken;
    
    if (!idToken) {
      return { error: 'Could not get ID token from Google. Please try again.' };
    }

    // Exchange the Google ID token with Supabase to create a session
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) return { error: error.message };
    return { success: true, user: data.user, session: data.session };

  } catch (e) {
    if (e.code === 'SIGN_IN_CANCELLED') {
      return { error: 'Sign-in was cancelled.' };
    }
    console.error('Google sign-in error:', e);
    return { error: e.message || 'Google sign-in failed. Please try again.' };
  }
}


// Get current session
export async function getCurrentSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (e) {
    console.error('Get session error:', e);
    return null;
  }
}

// Get current user
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  } catch (e) {
    console.error('Get user error:', e);
    return null;
  }
}

// Sign out
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.error('Signout error:', e);
    return { error: e.message };
  }
}

// Auth state listener
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data?.subscription;
}

// Resend confirmation email
export async function resendConfirmationEmail(email) {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) throw error;
    return { success: true, message: 'Confirmation email resent' };
  } catch (e) {
    console.error('Resend email error:', e);
    return { error: e.message };
  }
}

// Reset password
export async function resetPassword(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (error) throw error;
    return { success: true, message: 'Password reset email sent' };
  } catch (e) {
    console.error('Reset password error:', e);
    return { error: e.message };
  }
}
