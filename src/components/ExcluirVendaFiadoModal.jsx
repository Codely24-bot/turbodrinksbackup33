import React from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const ExcluirVendaFiadoModal = ({ isOpen, onClose, conta, onConfirm }) => {
  if (!isOpen || !conta) return null;

  const handleConfirm = () => {
    onConfirm(conta.id);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#1a2332] rounded-xl w-full max-w-md border border-red-500/30 shadow-2xl"
        >
          <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-[#2a3a4a] rounded-t-xl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-red-500" />
              EXCLUIR VENDA
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-lg font-medium text-white mb-2">Tem certeza que deseja excluir?</h3>
            <p className="text-gray-400 mb-6 text-sm">
              Você está prestes a excluir a conta do cliente <strong className="text-white">{conta.cliente?.nome}</strong> no valor de <strong className="text-white">R$ {parseFloat(conta.valor).toFixed(2)}</strong>.
              <br/><br/>
              <span className="text-red-400 font-bold uppercase text-xs tracking-wider">Esta ação não pode ser desfeita!</span>
            </p>

            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline" className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800">
                Cancelar
              </Button>
              <Button onClick={handleConfirm} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold border-none">
                Sim, Excluir
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ExcluirVendaFiadoModal;