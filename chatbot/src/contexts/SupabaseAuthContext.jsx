import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSession = useCallback(async (currentSession) => {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          // Handle specific refresh token error
          if (error.message?.includes('refresh_token_not_found') || error.code === 'refresh_token_not_found') {
            console.warn('Refresh token missing or invalid. Clearing auth state.');
            await supabase.auth.signOut();
            handleSession(null);
            return;
          }
          throw error;
        }
        
        handleSession(session);
      } catch (error) {
        console.error('Error initializing session:', error);
        
        // Attempt recovery from storage if session fetch failed but we might have data
        const storedSessionStr = localStorage.getItem('sb-api-auth-token');
        if (storedSessionStr) {
          try {
             const storedSession = JSON.parse(storedSessionStr);
             // Basic validation that it looks like a session
             if (storedSession && storedSession.access_token && storedSession.refresh_token) {
                // If we are here, it means getSession failed but we have a token.
                // It's likely invalid, so we should probably clear it to be safe and force login
                console.warn('Found stored session but getSession failed. Clearing storage to prevent loops.');
                localStorage.removeItem('sb-api-auth-token');
             }
          } catch (e) {
             localStorage.removeItem('sb-api-auth-token');
          }
        }
        
        handleSession(null);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          handleSession(null);
          // Ensure local storage is cleared
          localStorage.removeItem('sb-api-auth-token');
        } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          handleSession(session);
        } else if (event === 'USER_UPDATED') {
          handleSession(session);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession]);

  const signUp = useCallback(async (email, password, options) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sign up Failed",
        description: error.message || "Something went wrong",
      });
      return { data: null, error };
    }
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sign in Failed",
        description: error.message || "Something went wrong",
      });
      return { data: null, error };
    }
  }, [toast]);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sign out Failed",
        description: error.message || "Something went wrong",
      });
      // Force local cleanup on error
      handleSession(null);
      return { error };
    }
  }, [toast, handleSession]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  }), [user, session, loading, signUp, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};