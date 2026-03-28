import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const AddComboInsumoModal = ({ isOpen, onClose, onAdd, availableProducts }) => {
  const { toast } = useToast();
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('Unidade');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!selectedProductId) {
      toast({ title: 'Selecione um produto', variant: 'destructive' });
      return;
    }
    if (!quantidade || parseFloat(quantidade) <= 0) {
      toast({ title: 'Quantidade inválida', variant: 'destructive' });
      return;
    }

    const produto = availableProducts.find(p => p.id === selectedProductId);
    
    onAdd({
      insumo_id: selectedProductId,
      nomeProduto: produto.descricao,
      quantidade: parseFloat(quantidade),
      unidade_medida: unidade
    });

    toast({
      title: 'Insumo adicionado ao combo',
      className: 'bg-[#00d084] text-white border-none'
    });

    // Reset fields
    setSelectedProductId('');
    setQuantidade('');
    setUnidade('Unidade');
    onClose();
  };

  // Filter out products that are already combos, if any (though usually inputs are simple products)
  const simpleProducts = availableProducts.filter(p => p.tipo !== 'combo');

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#0f1419] rounded-xl border border-gray-700 shadow-2xl w-full max-w-lg overflow-hidden"
        >
          <div className="bg-[#2d3e52] p-4 border-b border-gray-600 flex justify-between items-center">
            <h3 className="text-white font-bold text-lg">ADICIONAR INSUMO AO COMBO</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="text-xs text-gray-400 mb-1 block uppercase font-bold">Produto (Insumo) *</label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-3 text-white focus:border-[#00d084] focus:outline-none"
              >
                <option value="">Selecione um produto...</option>
                {simpleProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.descricao} ({p.unidade || 'UN'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block uppercase font-bold">Quantidade *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-3 text-white focus:border-[#00d084] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block uppercase font-bold">Unidade de Medida</label>
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-3 text-white focus:border-[#00d084] focus:outline-none"
                >
                  <option value="Unidade">Unidade</option>
                  <option value="ml">ml</option>
                  <option value="l">l</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="cm">cm</option>
                  <option value="m">m</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <Button
                type="button"
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 py-6"
              >
                CANCELAR
              </Button>
              <Button
                type="submit"
                className="bg-[#00d084] hover:bg-[#00b872] text-white font-bold py-6"
              >
                <Check className="w-4 h-4 mr-2" />
                ADICIONAR INSUMO
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AddComboInsumoModal;