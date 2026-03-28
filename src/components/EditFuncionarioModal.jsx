import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EditFuncionarioModal = ({ isOpen, onClose, funcionario, onSave }) => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    cargo: '',
    salario: '',
    data_admissao: '',
    data_demissao: '',
    status: 'ativo',
    observacoes: ''
  });

  useEffect(() => {
    if (funcionario && isOpen) {
      setFormData({
        nome: funcionario.nome || '',
        email: funcionario.email || '',
        telefone: funcionario.telefone || '',
        cpf: funcionario.cpf || '',
        cargo: funcionario.cargo || '',
        salario: funcionario.salario || '',
        data_admissao: funcionario.data_admissao || '',
        data_demissao: funcionario.data_demissao || '',
        status: funcionario.status || 'ativo',
        observacoes: funcionario.observacoes || ''
      });
    }
  }, [funcionario, isOpen]);

  if (!isOpen || !funcionario) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validations
    if (formData.data_demissao && new Date(formData.data_demissao) < new Date(formData.data_admissao)) {
      alert("Data de demissão não pode ser anterior à admissão.");
      return;
    }

    onSave(funcionario.id, {
      ...formData,
      salario: parseFloat(formData.salario) || 0
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#1a2332] rounded-xl border border-gray-700 shadow-2xl w-full max-w-2xl overflow-hidden"
        >
          <div className="bg-[#2d3e52] p-4 border-b border-gray-600 flex justify-between items-center">
            <div className="flex items-center gap-2 text-white font-bold">
              <Edit2 className="w-5 h-5 text-[#00d084]" />
              <span>EDITAR FUNCIONÁRIO</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            
            {/* Personal Data */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase border-b border-gray-700 pb-1">Dados Pessoais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1 block">Nome Completo *</label>
                  <input
                    name="nome"
                    required
                    value={formData.nome}
                    onChange={handleChange}
                    className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Email *</label>
                  <input
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Telefone</label>
                  <input
                    name="telefone"
                    value={formData.telefone}
                    onChange={handleChange}
                    className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">CPF</label>
                  <input
                    name="cpf"
                    value={formData.cpf}
                    onChange={handleChange}
                    className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Professional Data */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase border-b border-gray-700 pb-1">Dados Profissionais</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Cargo *</label>
                  <select
                    name="cargo"
                    required
                    value={formData.cargo}
                    onChange={handleChange}
                    className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="Vendedor">Vendedor</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Caixa">Caixa</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Salário (R$)</label>
                  <input
                    name="salario"
                    type="number"
                    step="0.01"
                    value={formData.salario}
                    onChange={handleChange}
                    className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Data de Admissão *</label>
                  <input
                    name="data_admissao"
                    type="date"
                    required
                    value={formData.data_admissao}
                    onChange={handleChange}
                    className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Data de Demissão</label>
                  <input
                    name="data_demissao"
                    type="date"
                    value={formData.data_demissao}
                    onChange={handleChange}
                    className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Observations */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Observações</label>
              <textarea
                name="observacoes"
                rows="3"
                value={formData.observacoes}
                onChange={handleChange}
                className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white resize-none focus:border-[#00d084] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <Button
                type="button"
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
              >
                CANCELAR
              </Button>
              <Button
                type="submit"
                className="bg-[#00d084] hover:bg-[#00b872] text-white font-bold"
              >
                SALVAR ALTERAÇÕES
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default EditFuncionarioModal;