import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CancelItemConfirmation = ({ isOpen, onClose, item, onConfirm }) => {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#1a2332] rounded-xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="p-6 space-y-4 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-xl font-bold text-white">Confirmar Cancelamento</h3>
            
            <p className="text-gray-400">
              Tem certeza que deseja cancelar este item?
            </p>

            <div className="bg-[#2d3e52] rounded-lg p-3 text-left border border-gray-600 mt-4">
              <div className="text-white font-medium">{item.descricao}</div>
              <div className="flex justify-between mt-1 text-sm">
                <span className="text-gray-400">Quantidade: {item.quantidade}</span>
                <span className="text-[#EF4444] font-bold">R$ {Number(item.total).toFixed(2)}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <Button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
              >
                NÃO, VOLTAR
              </Button>
              <Button
                onClick={onConfirm}
                className="bg-[#EF4444] hover:bg-red-600 text-white font-bold shadow-lg shadow-red-500/20"
              >
                SIM, CANCELAR
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CancelItemConfirmation;