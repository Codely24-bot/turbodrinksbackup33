import React, { useState } from 'react';
import { X, CheckCircle, Calendar, CreditCard, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const MarcarComoPagoModal = ({ isOpen, onClose, conta, onConfirm }) => {
  const [formData, setFormData] = useState({
    dataPagamento: new Date().toISOString().split('T')[0],
    formaPagamento: 'Dinheiro',
    observacoes: ''
  });

  if (!isOpen || !conta) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(conta.id, {
      ...formData,
      clienteName: conta.cliente?.nome
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#1a2332] rounded-xl w-full max-w-md border border-gray-700 shadow-2xl"
        >
          <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-[#2a3a4a] rounded-t-xl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-[#00d084]" />
              MARCAR COMO PAGO
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="bg-[#2a3a4a]/50 p-4 rounded-lg border border-gray-700 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Cliente</span>
                <span className="text-white font-medium">{conta.cliente?.nome || 'Cliente Desconhecido'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Valor</span>
                <span className="text-[#00d084] font-bold text-lg">R$ {parseFloat(conta.valor).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Vencimento</span>
                <span className="text-white font-mono text-sm">
                  {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#00d084]" /> Data do Pagamento
              </label>
              <input
                type="date"
                required
                value={formData.dataPagamento}
                onChange={(e) => setFormData({...formData, dataPagamento: e.target.value})}
                className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-[#00d084] focus:outline-none focus:ring-1 focus:ring-[#00d084]"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" /> Forma de Pagamento
              </label>
              <select
                value={formData.formaPagamento}
                onChange={(e) => setFormData({...formData, formaPagamento: e.target.value})}
                className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-[#00d084] focus:outline-none"
              >
                <option value="Dinheiro">Dinheiro</option>
                <option value="Pix">Pix</option>
                <option value="Débito">Débito</option>
                <option value="Crédito">Crédito</option>
                <option value="Cheque">Cheque</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" /> Observações
              </label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                rows="3"
                className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-[#00d084] focus:outline-none resize-none"
                placeholder="Detalhes opcionais sobre o pagamento..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" onClick={onClose} variant="outline" className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-[#00d084] hover:bg-[#00b872] text-white font-bold">
                Confirmar Recebimento
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default MarcarComoPagoModal;