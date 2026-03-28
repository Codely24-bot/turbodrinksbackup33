import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export const useRealtimeReports = ({ onVendasChange, onItensChange, onProdutosChange }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState('disconnected');
  const timeoutRef = useRef(null);

  // Debounce function to prevent excessive updates
  const debounce = (callback, delay = 300) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback();
    }, delay);
  };

  useEffect(() => {
    if (!user?.id) return;

    const vendasChannel = supabase
      .channel('realtime-reports-vendas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendas', filter: `user_id=eq.${user.id}` },
        () => {
          if (onVendasChange) debounce(onVendasChange);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setStatus('connected');
      });

    const itensChannel = supabase
      .channel('realtime-reports-itens')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'itens_venda', filter: `user_id=eq.${user.id}` },
        () => {
          if (onItensChange) debounce(onItensChange);
        }
      )
      .subscribe();

    const produtosChannel = supabase
      .channel('realtime-reports-produtos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'produtos', filter: `user_id=eq.${user.id}` },
        () => {
          if (onProdutosChange) debounce(onProdutosChange);
        }
      )
      .subscribe();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(vendasChannel);
      supabase.removeChannel(itensChannel);
      supabase.removeChannel(produtosChannel);
      setStatus('disconnected');
    };
  }, [user, onVendasChange, onItensChange, onProdutosChange]);

  return { status };
};