import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFuncionarios } from '@/hooks/useFuncionarios';

const OpenCashierModal = ({ isOpen, onClose, onConfirm }) => {
  const [funcionarioId, setFuncionarioId] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('0'); // Changed default to '0'
  const [observacoes, setObservacoes] = useState('');
  const { funcionarios, fetchFuncionarios } = useFuncionarios();

  useEffect(() => {
    if (isOpen) {
      fetchFuncionarios({ status: 'Ativo' });
      setSaldoInicial('0'); // Reset to '0' on open
      setFuncionarioId('');
      setObservacoes('');
    }
  }, [isOpen, fetchFuncionarios]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!funcionarioId) return alert("Selecione um funcionário.");
    const saldo = parseFloat(saldoInicial);
    if (isNaN(saldo) || saldo < 0) return alert("Saldo inicial inválido.");

    onConfirm(funcionarioId, saldo, observacoes);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#1a2332] rounded-xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="bg-[#2d3e52] p-4 border-b border-gray-600 flex justify-between items-center">
            <div className="flex items-center gap-2 text-white font-bold">
              <Lock className="w-5 h-5 text-[#00d084]" />
              <span>ABRIR CAIXA</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            <div>
              <label className="text-xs text-gray-400 mb-1 block uppercase font-bold">Funcionário *</label>
              <select
                required
                value={funcionarioId}
                onChange={(e) => setFuncionarioId(e.target.value)}
                className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
              >
                <option value="">Selecione...</option>
                {funcionarios.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.nome} ({f.cargo})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block uppercase font-bold">Saldo Inicial (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none text-lg font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block uppercase font-bold">Observações</label>
              <textarea
                rows="3"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white resize-none focus:border-[#00d084] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <Button
                type="button"
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
              >
                CANCELAR
              </Button>
              <Button
                type="submit"
                className="bg-[#00d084] hover:bg-[#00b872] text-white font-bold shadow-lg shadow-[#00d084]/20"
              >
                ABRIR CAIXA
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default OpenCashierModal;