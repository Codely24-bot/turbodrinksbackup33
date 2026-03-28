import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

export const useCombos = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const fetchComboInsumos = useCallback(async (comboId) => {
    try {
      const { data, error } = await supabase
        .from('combo_insumos')
        .select(`
          *,
          produto:produtos!combo_insumos_insumo_id_fkey (
            id,
            descricao,
            unidade,
            estoque,
            tipo
          )
        `)
        .eq('combo_id', comboId);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching combo insumos:', error);
      return [];
    }
  }, []);

  const consumirInsumosDoCombos = async (items, userId) => {
    if (!items || items.length === 0) return { success: true };

    setLoading(true);
    try {
      const comboItems = items.filter(item => item.tipo === 'combo' || item.eh_combo);

      if (comboItems.length === 0) return { success: true };

      for (const comboItem of comboItems) {
        const insumos = await fetchComboInsumos(comboItem.produtoId || comboItem.id);

        if (!insumos || insumos.length === 0) {
          console.warn(`Combo ${comboItem.descricao || 'Desconhecido'} não tem insumos configurados.`);
          continue;
        }

        // Validate Stock first
        for (const insumoRel of insumos) {
          const requiredQty = parseFloat(insumoRel.quantidade) * comboItem.quantidade;
          const currentStock = parseFloat(insumoRel.produto.estoque || 0);

          if (currentStock < requiredQty) {
            throw new Error(`Estoque insuficiente de ${insumoRel.produto.descricao} (Necessário: ${requiredQty}, Atual: ${currentStock})`);
          }
        }

        // Deduct Stock via RPC for atomicity
        for (const insumoRel of insumos) {
          const deductQty = parseFloat(insumoRel.quantidade) * comboItem.quantidade;
          
          const { error: rpcError } = await supabase.rpc('decrement_estoque', {
            p_produto_id: insumoRel.insumo_id,
            p_quantidade: deductQty
          });

          if (rpcError) {
             console.error("Failed to decrement insumo via RPC:", rpcError);
             throw new Error(`Erro ao decrementar estoque do insumo ${insumoRel.produto.descricao}`);
          }
        }

        // Record Combo Sale
        const { error: comboVendaError } = await supabase.from('combo_vendas').insert([{
          user_id: userId,
          combo_id: comboItem.produtoId || comboItem.id,
          quantidade_combos: comboItem.quantidade,
          data_venda: new Date().toISOString()
        }]);
        
        if (comboVendaError) {
          console.error("Failed to record combo_vendas:", comboVendaError);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error in consumirInsumosDoCombos:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    fetchComboInsumos,
    consumirInsumosDoCombos
  };
};