import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Helper to normalize Supabase errors into friendly messages
const getFriendlyErrorMessage = (error) => {
  console.error("Auth Error:", error);

  if (error.message === 'Email not confirmed' || error.code === 'email_not_confirmed') {
    return 'Seu email ainda não foi confirmado. Por favor, verifique sua caixa de entrada e clique no link de confirmação antes de fazer login.';
  }

  if (
    error.message?.includes('rate limit') || 
    error.code === 'over_email_send_rate_limit' ||
    error.status === 429
  ) {
    return 'Muitas tentativas recentes. Por favor, aguarde alguns minutos antes de tentar novamente para evitar spam.';
  }

  if (error.message === 'Invalid login credentials') {
    return 'Email ou senha incorretos. Por favor, verifique suas credenciais.';
  }

  if (error.message?.includes('already registered')) {
    return 'Este email já está cadastrado. Tente fazer login ou recuperar sua senha.';
  }

  if (error.message?.includes('Password should be')) {
    return 'A senha é muito fraca. Use uma senha mais forte.';
  }

  if (error.message?.includes('refresh_token_not_found') || error.code === 'refresh_token_not_found') {
    return 'Sua sessão expirou. Por favor, faça login novamente.';
  }

  return error.message || 'Ocorreu um erro inesperado. Tente novamente.';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check active sessions and sets the user
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          // Handle refresh token errors specifically
          if (error.message?.includes('refresh_token_not_found') || error.code === 'refresh_token_not_found') {
            console.warn('Refresh token invalid or not found. Clearing session.');
            await supabase.auth.signOut();
            setUser(null);
          } else {
            console.error('Error getting session:', error);
          }
        } else {
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Unexpected error getting session:', error);
        // Fallback: check if we have a token in storage but it failed
        const storedSession = localStorage.getItem('sb-api-auth-token');
        if (storedSession) {
           // If we had a session but failed to retrieve it, it might be corrupted
           console.warn('Clearing potentially corrupted session from storage');
           localStorage.removeItem('sb-api-auth-token');
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
      } else if (event === 'INITIAL_SESSION') {
        setUser(session?.user ?? null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signup = async (email, password, name) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
        },
      });

      if (error) throw error;

      toast({
        title: 'Cadastro realizado!',
        description: 'Verifique seu email para confirmar o cadastro.',
      });

      return { user: data.user, error: null };
    } catch (error) {
      const friendlyMessage = getFriendlyErrorMessage(error);
      toast({
        title: 'Erro no cadastro',
        description: friendlyMessage,
        variant: 'destructive'
      });
      return { user: null, error: { ...error, message: friendlyMessage } };
    }
  };

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: 'Login realizado!',
        description: 'Bem-vindo de volta!',
      });

      return { user: data.user, error: null };
    } catch (error) {
      const friendlyMessage = getFriendlyErrorMessage(error);
      toast({
        title: 'Erro no login',
        description: friendlyMessage,
        variant: 'destructive'
      });
      return { user: null, error: { ...error, message: friendlyMessage } };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      toast({
        title: 'Logout realizado',
        description: 'Até logo!',
      });
    } catch (error) {
      console.error('Error logging out:', error.message);
      // Force local cleanup even if server request fails
      setUser(null);
      localStorage.removeItem('sb-api-auth-token');
    }
  };

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;

      toast({
        title: 'Email de recuperação enviado',
        description: 'Verifique sua caixa de entrada.',
      });

      return { error: null };
    } catch (error) {
      const friendlyMessage = getFriendlyErrorMessage(error);
      toast({
        title: 'Erro na recuperação',
        description: friendlyMessage,
        variant: 'destructive'
      });
      return { error: { ...error, message: friendlyMessage } };
    }
  };

  const value = {
    user,
    loading,
    signup,
    login,
    logout,
    resetPassword,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};