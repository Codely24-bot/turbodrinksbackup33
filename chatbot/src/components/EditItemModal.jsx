import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, X, Save, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EditItemModal = ({ isOpen, onClose, item, onSave }) => {
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (isOpen && item) {
      setQuantity(item.quantidade);
      setPrice(item.valor_unitario || item.precoUnitario); // Handle both DB and local cart structures if needed
    }
  }, [isOpen, item]);

  const handleSave = () => {
    if (quantity <= 0 || price < 0) return;
    onSave({
      ...item,
      quantidade: Number(quantity),
      valor_unitario: Number(price),
      total: Number(quantity) * Number(price)
    });
  };

  if (!isOpen || !item) return null;

  const oldTotal = item.quantidade * (item.valor_unitario || item.precoUnitario);
  const newTotal = quantity * price;
  const difference = newTotal - oldTotal;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#1a2332] rounded-xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="bg-[#2d3e52] p-4 border-b border-gray-600 flex justify-between items-center">
            <div className="flex items-center gap-2 text-white font-bold">
              <Edit2 className="w-5 h-5 text-[#00d084]" />
              <span className="truncate max-w-[200px]">{item.descricao}</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#0d1117] border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Preço Unitário</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">R$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-[#0d1117] border border-gray-600 rounded-lg pl-8 pr-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#0d1117] rounded-lg p-4 border border-gray-700 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal Anterior</span>
                <span className="text-gray-400 line-through">R$ {oldTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Novo Subtotal</span>
                <span className="text-white font-bold">R$ {newTotal.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-700 pt-2 flex justify-between text-sm">
                <span className="text-gray-400">Diferença</span>
                <span className={`font-bold ${difference >= 0 ? 'text-[#00d084]' : 'text-red-500'}`}>
                  {difference > 0 ? '+' : ''} R$ {difference.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
              >
                CANCELAR
              </Button>
              <Button
                onClick={handleSave}
                className="bg-[#00d084] hover:bg-[#00b872] text-white font-bold shadow-lg shadow-[#00d084]/20"
              >
                <Save className="w-4 h-4 mr-2" />
                SALVAR
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default EditItemModal;