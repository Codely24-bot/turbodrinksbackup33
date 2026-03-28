export const validateComboType = (produto) => {
  return produto?.tipo === 'combo' || produto?.eh_combo === true;
};

export const validateInsumoNotCombo = (insumo) => {
  return insumo?.tipo !== 'combo' && !insumo?.eh_combo;
};

export const validateNoDuplicateInsumo = (currentInsumos, newInsumoId) => {
  return !currentInsumos.some(item => item.insumo_id === newInsumoId);
};

export const validateComboHasInsumos = (insumos) => {
  return insumos && insumos.length > 0;
};

export const validateInsumoStock = (insumo, quantidadeNecessaria) => {
  return (insumo?.estoque || 0) >= quantidadeNecessaria;
};