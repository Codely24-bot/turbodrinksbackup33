import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, X, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminPasswordModal from '@/components/AdminPasswordModal';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const EditSaleModal = ({ isOpen, onClose, sale, onSave }) => {
  const { user } = useAuth();
  const [desconto, setDesconto] = useState(0);
  const [observacoes, setObservacoes] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [vendedores, setVendedores] = useState([]);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchVendedores();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen && sale) {
      setDesconto(sale.desconto || 0);
      setObservacoes(sale.observacoes || '');
      setVendedorId(sale.vendedor_id || '');
    }
  }, [isOpen, sale]);

  const fetchVendedores = async () => {
    try {
      const { data } = await supabase
        .from('vendedores')
        .select('id, nome')
        .eq('user_id', user.id)
        .eq('ativo', true);
      setVendedores(data || []);
    } catch (error) {
      console.error('Error fetching vendedores:', error);
    }
  };

  if (!isOpen || !sale) return null;

  const originalTotal = Number(sale.subtotal) + Number(sale.acrescimo || 0);
  const newTotal = Math.max(0, originalTotal - Number(desconto));

  const handleInitialSubmit = () => {
    if (desconto < 0) return;
    if (desconto > originalTotal) {
      alert("Desconto não pode ser maior que o subtotal!");
      return;
    }
    
    // Validate vendedor_id if selected
    if (vendedorId && !vendedores.find(v => v.id === vendedorId)) {
      alert("Vendedor selecionado inválido.");
      return;
    }

    setPasswordModalOpen(true);
  };

  const handlePasswordConfirm = () => {
    onSave(sale.id, {
      desconto: Number(desconto),
      total: newTotal,
      observacoes,
      vendedor_id: vendedorId || null
    });
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
            <div className="bg-[#2d3e52] p-4 border-b border-gray-600 flex justify-between items-center">
              <div className="flex items-center gap-2 text-white font-bold">
                <Edit2 className="w-5 h-5 text-[#00d084]" />
                <span>EDITAR VENDA #{sale.numero_venda || String(sale.id).slice(0, 8)}</span>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Vendedor</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={vendedorId}
                    onChange={(e) => setVendedorId(e.target.value)}
                    className="w-full bg-[#2d3e52] border border-gray-600 rounded-lg pl-10 pr-3 py-2 text-white focus:border-[#00d084] focus:outline-none appearance-none"
                  >
                    <option value="">Sem vendedor</option>
                    {vendedores.map(v => (
                      <option key={v.id} value={v.id}>{v.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Desconto (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  className="w-full bg-[#2d3e52] border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Observações</label>
                <textarea
                  maxLength={500}
                  rows={4}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full bg-[#2d3e52] border border-gray-600 rounded-lg px-3 py-2 text-white resize-none focus:border-[#00d084] focus:outline-none"
                />
                <div className="text-right text-xs text-gray-500 mt-1">{observacoes.length}/500</div>
              </div>

              <div className="bg-[#0f1419] rounded-lg p-4 border border-gray-700 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal + Acréscimo</span>
                  <span className="text-gray-300">R$ {originalTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Novo Desconto</span>
                  <span className="text-red-400 font-medium">- R$ {Number(desconto).toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-700 pt-2 flex justify-between text-base font-bold">
                  <span className="text-white">Novo Total</span>
                  <span className="text-[#00d084]">R$ {newTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <Button
                  onClick={onClose}
                  className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
                >
                  CANCELAR
                </Button>
                <Button
                  onClick={handleInitialSubmit}
                  className="bg-[#00d084] hover:bg-[#00b872] text-white font-bold"
                >
                  <Save className="w-4 h-4 mr-2" />
                  SALVAR
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
        actionType="edit"
      />
    </>
  );
};

export default EditSaleModal;