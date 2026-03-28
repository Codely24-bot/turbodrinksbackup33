import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useSalesHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const parseLocalDate = (dateStr, endOfDay = false) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [year, month, day] = parts;
    return new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    );
  };

  // Fetch sales with comprehensive filtering
  const fetchSalesWithFilters = useCallback(async ({ startDate, endDate, searchTerm, tipoVenda, status }) => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('vendas')
        .select(`
          *,
          cliente:pessoas(nome, telefone),
          vendedor:vendedores(nome),
          itens:itens_venda(
            *,
            produto:produtos(descricao, codigo)
          ),
          pagamentos:venda_pagamentos(*)
        `)
        .eq('user_id', user.id)
        .order('data_criacao', { ascending: false });

      // Date Filters (start of day to end of day)
      const start = parseLocalDate(startDate, false);
      const end = parseLocalDate(endDate, true);

      const startIso = start ? start.toISOString() : null;
      const endIso = end ? end.toISOString() : null;

      if (startIso && endIso) {
        query = query.or(`and(data_criacao.gte.${startIso},data_criacao.lte.${endIso}),and(data_hora.gte.${startIso},data_hora.lte.${endIso})`);
      } else if (startIso) {
        query = query.or(`data_criacao.gte.${startIso},data_hora.gte.${startIso}`);
      } else if (endIso) {
        query = query.or(`data_criacao.lte.${endIso},data_hora.lte.${endIso}`);
      }

      // Type Filter
      if (tipoVenda && tipoVenda !== 'todos') {
        query = query.eq('tipo_venda', tipoVenda);
      }

      // Status Filter
      if (status && status !== 'todos') {
         const dbStatus = status === 'completa' ? 'concluido' : status;
         query = query.eq('status', dbStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Search Filter (Client Side for simpler text search on relations)
      let filteredData = data || [];
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        filteredData = filteredData.filter(sale => 
          (sale.numero_venda?.toString().includes(lowerTerm)) ||
          (sale.cliente?.nome?.toLowerCase().includes(lowerTerm)) ||
          (String(sale.id).toLowerCase().includes(lowerTerm))
        );
      }

      setSales(filteredData);
    } catch (err) {
      console.error('Error fetching sales history:', err);
      setError(err.message);
      toast({
        title: 'Erro ao carregar histórico',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const updateSale = async (saleId, updates) => {
    if (!user) return;
    try {
      // Validate vendedor_id if present
      if (updates.hasOwnProperty('vendedor_id')) {
        if (updates.vendedor_id === '' || updates.vendedor_id === 'undefined') {
          updates.vendedor_id = null;
        }
        // Additional validation could be done here if we had the list of sellers,
        // but for now we ensure it's at least null if empty to avoid FK violation with empty string
      }

      const { error } = await supabase
        .from('vendas')
        .update(updates)
        .eq('id', saleId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state locally to avoid refetch
      setSales(prev => prev.map(s => s.id === saleId ? { ...s, ...updates } : s));

      toast({
        title: 'Venda atualizada com sucesso',
        className: 'bg-[#00d084] text-white border-none'
      });
      return true;
    } catch (err) {
      console.error('Error updating sale:', err);
      toast({
        title: 'Erro ao atualizar venda',
        description: err.message,
        variant: 'destructive'
      });
      return false;
    }
  };

  const deleteSale = async (saleId) => {
    if (!user) return;
    try {
      // Manual cascade delete just in case DB doesn't handle it
      // 1. Delete Items
      await supabase.from('itens_venda').delete().eq('venda_id', saleId);
      // 2. Delete Payments
      await supabase.from('venda_pagamentos').delete().eq('venda_id', saleId);
      // 3. Delete History (if exists)
      await supabase.from('vendas_itens_historico').delete().eq('venda_id', saleId);
      
      // 4. Delete Sale
      const { error } = await supabase
        .from('vendas')
        .delete()
        .eq('id', saleId)
        .eq('user_id', user.id);

      if (error) throw error;

      setSales(prev => prev.filter(s => s.id !== saleId));
      
      toast({
        title: 'Venda excluída com sucesso',
        className: 'bg-[#EF4444] text-white border-none'
      });
      return true;
    } catch (err) {
      console.error('Error deleting sale:', err);
      toast({
        title: 'Erro ao excluir venda',
        description: err.message,
        variant: 'destructive'
      });
      return false;
    }
  };

  const getSalesSummary = () => {
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((acc, curr) => acc + Number(curr.total), 0);
    const totalItems = sales.reduce((acc, curr) => acc + (curr.itens?.length || 0), 0);
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    return { totalSales, totalRevenue, totalItems, averageTicket };
  };

  return {
    sales,
    loading,
    error,
    fetchSalesWithFilters,
    updateSale,
    deleteSale,
    getSalesSummary
  };
};
