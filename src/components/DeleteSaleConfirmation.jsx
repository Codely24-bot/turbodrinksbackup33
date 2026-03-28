import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminPasswordModal from '@/components/AdminPasswordModal';

const DeleteSaleConfirmation = ({ isOpen, onClose, sale, onConfirm }) => {
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  if (!isOpen || !sale) return null;

  const handleInitialConfirm = () => {
    setPasswordModalOpen(true);
  };

  const handlePasswordConfirm = () => {
    onConfirm(sale.id);
    setPasswordModalOpen(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
        <AnimatePresence>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#1a2332] rounded-xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 space-y-4 text-center">
              <div className="w-16 h-16 bg-[#EF4444]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-8 h-8 text-[#EF4444]" />
              </div>
              
              <h3 className="text-xl font-bold text-white">Excluir Venda?</h3>
              
              <p className="text-gray-400">
                Tem certeza que deseja <span className="text-[#EF4444] font-bold">EXCLUIR</span> permanentemente esta venda?
                Isso removerá os registros financeiros e de estoque associados.
              </p>

              <div className="bg-[#2d3e52] rounded-lg p-4 text-left border border-gray-600 mt-4 space-y-2">
                <div className="flex justify-between">
                   <span className="text-gray-400 text-sm">Venda Nº</span>
                   <span className="text-white font-mono">#{sale.numero_venda || String(sale.id).slice(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                   <span className="text-gray-400 text-sm">Data</span>
                   <span className="text-white text-sm">{new Date(sale.data_criacao).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between border-t border-gray-600 pt-2">
                   <span className="text-gray-400 text-sm font-bold">TOTAL</span>
                   <span className="text-[#EF4444] font-bold">R$ {Number(sale.total).toFixed(2)}</span>
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
                  onClick={handleInitialConfirm}
                  className="bg-[#EF4444] hover:bg-red-600 text-white font-bold shadow-lg shadow-red-500/20"
                >
                  SIM, EXCLUIR
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <AdminPasswordModal 
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onConfirm={handlePasswordConfirm}
        actionType="cancel"
      />
    </>
  );
};

export default DeleteSaleConfirmation;