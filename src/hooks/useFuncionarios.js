import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useFuncionarios = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFuncionarios = useCallback(async ({ nome, cargo, status } = {}) => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('funcionarios')
        .select('*')
        .eq('user_id', user.id)
        .order('nome', { ascending: true });

      if (nome) {
        query = query.ilike('nome', `%${nome}%`);
      }
      if (cargo && cargo !== 'Todos') {
        query = query.eq('cargo', cargo);
      }
      if (status && status !== 'Todos') {
        query = query.eq('status', status.toLowerCase());
      }

      const { data, error } = await query;

      if (error) throw error;
      setFuncionarios(data || []);
    } catch (err) {
      console.error('Error fetching funcionarios:', err);
      setError(err.message);
      toast({
        title: 'Erro ao carregar funcionários',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const createFuncionario = async (funcionarioData) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('funcionarios')
        .insert([{ ...funcionarioData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setFuncionarios(prev => [...prev, data]);
      toast({
        title: 'Funcionário criado com sucesso',
        className: 'bg-[#00d084] text-white border-none'
      });
      return data;
    } catch (err) {
      console.error('Error creating funcionario:', err);
      toast({
        title: 'Erro ao criar funcionário',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  };

  const updateFuncionario = async (id, updates) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('funcionarios')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setFuncionarios(prev => prev.map(f => f.id === id ? data : f));
      toast({
        title: 'Funcionário atualizado com sucesso',
        className: 'bg-[#00d084] text-white border-none'
      });
      return data;
    } catch (err) {
      console.error('Error updating funcionario:', err);
      toast({
        title: 'Erro ao atualizar funcionário',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  };

  const deleteFuncionario = async (id) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('funcionarios')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setFuncionarios(prev => prev.filter(f => f.id !== id));
      toast({
        title: 'Funcionário excluído com sucesso',
        className: 'bg-[#EF4444] text-white border-none'
      });
    } catch (err) {
      console.error('Error deleting funcionario:', err);
      toast({
        title: 'Erro ao excluir funcionário',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  };

  return {
    funcionarios,
    loading,
    error,
    fetchFuncionarios,
    createFuncionario,
    updateFuncionario,
    deleteFuncionario
  };
};