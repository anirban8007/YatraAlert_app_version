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

// Google Authentication
export async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    return {
      success: true,
      data,
    };
  } catch (e) {
    console.error('Google sign-in error:', e);
    return { error: e.message };
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
