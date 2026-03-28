import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CreateFuncionarioModal = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    cargo: '',
    salario: '',
    data_admissao: '',
    observacoes: ''
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.nome.length < 3) {
      alert("Nome deve ter pelo menos 3 caracteres.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert("Email inválido.");
      return;
    }
    
    // Check future date
    if (new Date(formData.data_admissao) > new Date()) {
      alert("Data de admissão não pode ser futura.");
      return;
    }

    onSave({
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
        className="bg-[var(--layout-bg)] rounded-xl border border-[var(--layout-border)] shadow-2xl w-full max-w-2xl overflow-hidden"
      >
          <div className="bg-[var(--layout-surface-2)] p-4 border-b border-[var(--layout-border)] flex justify-between items-center">
            <div className="flex items-center gap-2 text-white font-bold">
              <UserPlus className="w-5 h-5 text-[var(--layout-accent)]" />
              <span>NOVO FUNCIONÁRIO</span>
            </div>
            <button onClick={onClose} className="text-[var(--layout-text-muted)] hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            
            {/* Personal Data */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[var(--layout-text-muted)] uppercase border-b border-[var(--layout-border)] pb-1">
                Dados Pessoais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Nome Completo *</label>
                  <input
                    name="nome"
                    required
                    value={formData.nome}
                    onChange={handleChange}
                    className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Email *</label>
                  <input
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Telefone</label>
                  <input
                    name="telefone"
                    value={formData.telefone}
                    onChange={handleChange}
                    className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">CPF</label>
                  <input
                    name="cpf"
                    value={formData.cpf}
                    onChange={handleChange}
                    placeholder="000.000.000-00"
                    className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Professional Data */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[var(--layout-text-muted)] uppercase border-b border-[var(--layout-border)] pb-1">
                Dados Profissionais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Cargo *</label>
                  <select
                    name="cargo"
                    required
                    value={formData.cargo}
                    onChange={handleChange}
                    className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="Vendedor">Vendedor</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Caixa">Caixa</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Salário (R$)</label>
                  <input
                    name="salario"
                    type="number"
                    step="0.01"
                    value={formData.salario}
                    onChange={handleChange}
                    className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Data de Admissão *</label>
                  <input
                    name="data_admissao"
                    type="date"
                    required
                    value={formData.data_admissao}
                    onChange={handleChange}
                    className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Observations */}
            <div>
              <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Observações</label>
              <textarea
                name="observacoes"
                rows="3"
                value={formData.observacoes}
                onChange={handleChange}
                className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white resize-none focus:border-[var(--layout-accent)] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <Button
                type="button"
                onClick={onClose}
                className="bg-[var(--layout-border)] hover:bg-[var(--layout-surface-2)] text-white border border-[var(--layout-border)]"
              >
                CANCELAR
              </Button>
              <Button
                type="submit"
                className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white font-bold"
              >
                SALVAR FUNCIONÁRIO
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CreateFuncionarioModal;
