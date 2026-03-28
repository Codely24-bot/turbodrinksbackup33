import { supabase } from '@/lib/customSupabaseClient';

/**
 * Deletes a product (soft delete preferred, hard delete fallback)
 * @param {string} productId 
 * @param {string} userId 
 * @returns {Promise<Object>} The original product data before deletion (for undo)
 */
export const deleteProduct = async (productId, userId) => {
  try {
    // 1. Fetch current state for backup/restore
    const { data: originalProduct, error: fetchError } = await supabase
      .from('produtos')
      .select('*')
      .eq('id', productId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !originalProduct) {
      throw new Error(`Produto não encontrado ou erro ao buscar: ${fetchError?.message}`);
    }

    // 2. If it's a combo, fetch its ingredients for backup
    let originalInsumos = [];
    if (originalProduct.tipo === 'combo') {
      const { data: insumos } = await supabase
        .from('combo_insumos')
        .select('*')
        .eq('combo_id', productId);
      originalInsumos = insumos || [];
    }

    // 3. Attempt Soft Delete (Update to inactive)
    const { error: softDeleteError } = await supabase
      .from('produtos')
      .update({ 
        ativo: false, 
        estoque: 0, 
        estoque_minimo: 0,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', productId)
      .eq('user_id', userId);

    if (softDeleteError) {
      console.warn("Soft delete failed, attempting hard delete...", softDeleteError);
      
      // 4. Fallback: Hard Delete (Only if soft delete fails)
      // Note: This might fail if there are foreign key constraints (like sales history)
      const { error: hardDeleteError } = await supabase
        .from('produtos')
        .delete()
        .eq('id', productId)
        .eq('user_id', userId);

      if (hardDeleteError) {
        throw new Error(`Falha ao excluir produto (Soft e Hard delete falharam): ${hardDeleteError.message}`);
      }
    }

    // 5. Clean up combo relationships if needed (orphaned references)
    // We only delete these if the product was successfully "deleted" (soft or hard)
    // For soft delete, we might want to keep them, but prompt asks to delete relationships.
    // Re-inserting them during restore is necessary.
    if (originalProduct.tipo === 'combo') {
        const { error: comboDeleteError } = await supabase
            .from('combo_insumos')
            .delete()
            .eq('combo_id', productId);
            
        if (comboDeleteError) {
            console.warn("Aviso: Não foi possível limpar os insumos do combo.", comboDeleteError);
        }
    }
    
    // Also remove where this product is an ingredient in other combos
    // (Optional safety step, though usually we might want to block deletion if used elsewhere)
    // For now, we just log/warn if we can't clean up, as per prompt instruction "non-fatal if fails"
    await supabase
        .from('combo_insumos')
        .delete()
        .eq('insumo_id', productId)
        .then(({ error }) => {
            if (error) console.warn("Aviso: Produto removido pode ainda estar referenciado como insumo em outros combos.", error);
        });

    // Return backup data
    return {
      ...originalProduct,
      combo_insumos_backup: originalInsumos
    };

  } catch (error) {
    console.error("deleteProduct service error:", error);
    throw error;
  }
};

/**
 * Restores a previously deleted product
 * @param {Object} productData - The object returned by deleteProduct
 * @param {string} userId 
 * @returns {Promise<Object>} The restored product
 */
export const restoreProduct = async (productData, userId) => {
  try {
    if (!productData || !productData.id) {
      throw new Error("Dados inválidos para restauração.");
    }

    // 1. Prepare data for restoration (exclude backup fields)
    const { combo_insumos_backup, ...prodFields } = productData;

    // 2. Restore main product record
    const { data: restored, error: restoreError } = await supabase
      .from('produtos')
      .upsert({
        ...prodFields,
        ativo: true, // Force active
        user_id: userId,
        atualizado_em: new Date().toISOString()
      })
      .select()
      .single();

    if (restoreError) {
      throw new Error(`Erro ao restaurar produto: ${restoreError.message}`);
    }

    // 3. Restore combo relationships if they existed
    if (productData.tipo === 'combo' && Array.isArray(combo_insumos_backup) && combo_insumos_backup.length > 0) {
      const insumosToInsert = combo_insumos_backup.map(item => ({
        user_id: userId,
        combo_id: item.combo_id,
        insumo_id: item.insumo_id,
        quantidade: item.quantidade,
        unidade_medida: item.unidade_medida
        // We don't restore created_at/id to let DB handle new IDs or use upsert if strictly keeping IDs
      }));

      const { error: insumoError } = await supabase
        .from('combo_insumos')
        .insert(insumosToInsert);

      if (insumoError) {
        console.warn("Aviso: Produto restaurado, mas houve erro ao restaurar os insumos do combo.", insumoError);
        // Not throwing here to avoid "failure" message when main product is back
      }
    }

    return restored;

  } catch (error) {
    console.error("restoreProduct service error:", error);
    throw error;
  }
};