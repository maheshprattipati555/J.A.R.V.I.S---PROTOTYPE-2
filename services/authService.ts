
import { UserProfile } from '../types';

// KEY FOR LOCAL STORAGE
const USER_STORAGE_KEY = 'jarvis_user_profile';

/**
 * AUTHENTICATION SERVICE
 * 
 * Simulates a production-grade auth backend (e.g., Firebase Auth).
 * 
 * TO GO LIVE:
 * 1. Replace `signUp` and `verifyOTP` with `firebase.auth().createUserWithEmailAndPassword` etc.
 * 2. Replace `sendVerificationEmail` with a call to your backend API (Node/Python) that uses SendGrid/Mailgun.
 */

export const AuthService = {
  
  // Check if a user is currently logged in and verified
  getCurrentUser(): UserProfile | null {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      if (!stored) return null;
      const user = JSON.parse(stored) as UserProfile;
      if (!user.verified) return null; // Enforce verification
      return user;
    } catch (e) {
      return null;
    }
  },

  // Step 1: Sign Up
  async signUp(name: string, email: string, password: string, country: string): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Basic validation
        if (!email.includes('@') || !email.includes('.')) {
          resolve({ success: false, message: 'Invalid email format detected.' });
          return;
        }
        if (password.length < 6) {
          resolve({ success: false, message: 'Password must be at least 6 characters.' });
          return;
        }

        // Simulate "User already exists" check
        const existing = localStorage.getItem(USER_STORAGE_KEY);
        if (existing) {
          const user = JSON.parse(existing);
          if (user.email === email && user.verified) {
            resolve({ success: false, message: 'Identity already registered in database.' });
            return;
          }
        }

        // Create temporary user session (unverified)
        const newUser: UserProfile = {
          id: Math.random().toString(36).substr(2, 9),
          name: name.trim(),
          email: email.trim(),
          country: country,
          authProvider: 'email',
          verified: false, // Must verify email
          createdAt: new Date().toISOString()
        };

        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
        resolve({ success: true });
      }, 1500); // Simulate network delay
    });
  },

  // Step 2: Send OTP (Simulation of Email Service)
  // We return the code here so the UI can simulate a "Push Notification"
  async sendVerificationEmail(email: string): Promise<{ success: boolean; code?: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Generate a 6-digit code
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // STORE OTP for verification (In real app, this is on the server)
        sessionStorage.setItem('current_otp', otp);
        sessionStorage.setItem('otp_email', email);

        console.log(`[EMAIL SERVICE] Sending email to ${email} with code: ${otp}`);
        
        // Return the code to the UI to show a fake notification
        resolve({ success: true, code: otp });
      }, 2000);
    });
  },

  // Step 3: Verify OTP
  async verifyOTP(email: string, code: string): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const storedOtp = sessionStorage.getItem('current_otp');
        const storedEmail = sessionStorage.getItem('otp_email');

        if (!storedOtp || storedEmail !== email) {
            resolve({ success: false, message: 'Session expired. Please resend code.' });
            return;
        }

        if (code === storedOtp) {
          // Mark user as verified
          const storedUser = localStorage.getItem(USER_STORAGE_KEY);
          if (storedUser) {
            const user = JSON.parse(storedUser);
            user.verified = true;
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
            
            // Cleanup
            sessionStorage.removeItem('current_otp');
            sessionStorage.removeItem('otp_email');
            
            resolve({ success: true, user });
          } else {
            resolve({ success: false, message: 'User record not found.' });
          }
        } else {
          resolve({ success: false, message: 'Invalid security code.' });
        }
      }, 1000);
    });
  },

  // Mock Social Login
  async loginWithProvider(provider: 'google' | 'apple' | 'facebook'): Promise<{ success: boolean; user?: UserProfile }> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockUser: UserProfile = {
                id: Math.random().toString(36).substr(2, 9),
                name: 'Tony Stark',
                email: `tony.stark@${provider}.com`,
                country: 'US',
                authProvider: provider,
                verified: true, // Social logins are auto-verified
                createdAt: new Date().toISOString()
            };
            
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));
            resolve({ success: true, user: mockUser });
        }, 2000);
    });
  },

  // Logout
  logout() {
    localStorage.removeItem(USER_STORAGE_KEY);
    window.location.reload();
  }
};
