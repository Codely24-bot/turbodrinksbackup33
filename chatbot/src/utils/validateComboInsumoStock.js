import { supabase } from '@/lib/customSupabaseClient';

/**
 * Validates if there is enough stock for all insumos of a given combo
 * @param {string} comboId 
 * @param {number} quantidadeCombos 
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
export const validateComboInsumoStock = async (comboId, quantidadeCombos) => {
  try {
    const { data: insumos, error } = await supabase
      .from('combo_insumos')
      .select(`
        quantidade,
        produto:produtos!combo_insumos_insumo_id_fkey (id, descricao, estoque)
      `)
      .eq('combo_id', comboId);

    if (error) {
      console.error('Erro ao buscar insumos do combo:', error);
      throw error;
    }

    if (!insumos || insumos.length === 0) {
      // If combo has no insumos configured, technically there's no stock restriction on insumos
      return { valid: true, errors: [] };
    }

    const errors = [];
    for (const insumo of insumos) {
      const required = parseFloat(insumo.quantidade) * quantidadeCombos;
      const available = parseFloat(insumo.produto?.estoque || 0);
      
      if (available < required) {
        errors.push(`Insumo insuficiente: ${insumo.produto?.descricao || 'Desconhecido'}. Necessário: ${required}, Disponível: ${available}`);
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    console.error('Error validating combo stock:', error);
    return { valid: false, errors: ['Erro interno ao validar estoque do combo'] };
  }
};