import React, { useState, useEffect } from 'react';
import { X, Edit, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const EditarVendaFiadoModal = ({ isOpen, onClose, conta, onConfirm, clientes = [] }) => {
  const [formData, setFormData] = useState({
    cliente_id: '',
    valor: '',
    data_vencimento: '',
    observacoes: '',
    status: 'pendente'
  });

  useEffect(() => {
    if (conta) {
      setFormData({
        cliente_id: conta.cliente_id || '',
        valor: conta.valor || '',
        data_vencimento: conta.data_vencimento || '',
        observacoes: conta.observacoes || '',
        status: conta.status || 'pendente'
      });
    }
  }, [conta]);

  if (!isOpen || !conta) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(conta.id, formData);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#1a2332] rounded-xl w-full max-w-lg border border-gray-700 shadow-2xl"
        >
          <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-[#2a3a4a] rounded-t-xl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-400" />
              EDITAR VENDA
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5">Cliente</label>
              <select
                value={formData.cliente_id}
                onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}
                className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
              >
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1.5">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.valor}
                  onChange={(e) => setFormData({...formData, valor: e.target.value})}
                  className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1.5">Data Vencimento</label>
                <input
                  type="date"
                  required
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData({...formData, data_vencimento: e.target.value})}
                  className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5">Observações</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                rows="3"
                className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" onClick={onClose} variant="outline" className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold">
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EditarVendaFiadoModal;