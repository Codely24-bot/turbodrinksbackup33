import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useMotoboys = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [motoboys, setMotoboys] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMotoboys = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('motoboys')
        .select('*')
        .eq('user_id', user.id)
        .order('nome', { ascending: true });

      if (error) throw error;
      setMotoboys(data || []);
    } catch (error) {
      console.error('Erro ao buscar motoboys:', error);
      toast({
        title: 'Erro ao carregar motoboys',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const createMotoboy = async (motoboyData) => {
    try {
      // Remove mask characters for storage if needed, or keep them. 
      // Keeping them ensures consistent format for display, but unique constraints might be tricky if format varies.
      // We will store WITH masks as requested by common BR patterns unless specified otherwise.
      
      const { data, error } = await supabase
        .from('motoboys')
        .insert([{ ...motoboyData, user_id: user.id }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique violation
          if (error.message.includes('cpf')) throw new Error('CPF já cadastrado.');
          if (error.message.includes('placa')) throw new Error('Placa já cadastrada.');
          if (error.message.includes('renavam')) throw new Error('RENAVAM já cadastrado.');
          if (error.message.includes('cnh')) throw new Error('CNH já cadastrada.');
        }
        throw error;
      }

      setMotoboys(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      toast({
        title: 'Motoboy cadastrado',
        description: `${motoboyData.nome} foi adicionado com sucesso.`,
        className: 'bg-[#00d084] text-white border-none'
      });
      return data;
    } catch (error) {
      console.error('Erro ao criar motoboy:', error);
      toast({
        title: 'Erro ao cadastrar',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updateMotoboy = async (id, motoboyData) => {
    try {
      const { data, error } = await supabase
        .from('motoboys')
        .update(motoboyData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          if (error.message.includes('cpf')) throw new Error('CPF já cadastrado para outro motoboy.');
          if (error.message.includes('placa')) throw new Error('Placa já cadastrada para outro veículo.');
        }
        throw error;
      }

      setMotoboys(prev => prev.map(m => m.id === id ? data : m).sort((a, b) => a.nome.localeCompare(b.nome)));
      toast({
        title: 'Motoboy atualizado',
        description: 'As alterações foram salvas com sucesso.',
        className: 'bg-[#00d084] text-white border-none'
      });
      return data;
    } catch (error) {
      console.error('Erro ao atualizar motoboy:', error);
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  };

  const deleteMotoboy = async (id) => {
    try {
      const { error } = await supabase
        .from('motoboys')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setMotoboys(prev => prev.filter(m => m.id !== id));
      toast({
        title: 'Motoboy excluído',
        description: 'O registro foi removido com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao excluir motoboy:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchMotoboys();
  }, [fetchMotoboys]);

  return {
    motoboys,
    loading,
    refresh: fetchMotoboys,
    createMotoboy,
    updateMotoboy,
    deleteMotoboy
  };
};