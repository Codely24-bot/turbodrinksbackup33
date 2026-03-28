import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Calendar, Bike, MapPin, User, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const MotoboyCadastroModal = ({ isOpen, onClose, onSave, motoboy = null }) => {
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    veiculo: '',
    placa: '',
    renavam: '',
    cnh: '',
    data_admissao: new Date().toISOString().split('T')[0],
    comissao_percentual: '5.00',
    comissao_fixa: '0.00',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    observacoes: '',
    status: 'ativo'
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (motoboy) {
        setFormData({
          ...motoboy,
          comissao_percentual: motoboy.comissao_percentual || '5.00',
          comissao_fixa: motoboy.comissao_fixa || '0.00'
        });
      } else {
        // Reset for new entry
        setFormData({
          nome: '',
          cpf: '',
          telefone: '',
          email: '',
          veiculo: '',
          placa: '',
          renavam: '',
          cnh: '',
          data_admissao: new Date().toISOString().split('T')[0],
          comissao_percentual: '5.00',
          comissao_fixa: '0.00',
          endereco: '',
          numero: '',
          complemento: '',
          bairro: '',
          cidade: '',
          estado: '',
          cep: '',
          observacoes: '',
          status: 'ativo'
        });
      }
      setErrors({});
    }
  }, [isOpen, motoboy]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    // Basic masking logic
    if (name === 'cpf') {
      formattedValue = value.replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
    } else if (name === 'telefone') {
      formattedValue = value.replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/g, '($1) $2')
        .replace(/(\d{5})(\d{4})/, '$1-$2')
        .slice(0, 15);
    } else if (name === 'cep') {
      formattedValue = value.replace(/\D/g, '')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .slice(0, 9);
    } else if (name === 'placa') {
      formattedValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
        .replace(/^([A-Z]{3})(\d)/, '$1-$2') // Old format logic, simplified
        .slice(0, 8); // Allow mercosul too
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.nome || formData.nome.length < 3) newErrors.nome = "Nome deve ter no mínimo 3 caracteres.";
    if (!formData.cpf || formData.cpf.length < 14) newErrors.cpf = "CPF inválido.";
    if (!formData.telefone) newErrors.telefone = "Telefone é obrigatório.";
    if (!formData.veiculo) newErrors.veiculo = "Veículo é obrigatório.";
    if (!formData.placa) newErrors.placa = "Placa é obrigatória.";
    if (!formData.data_admissao) newErrors.data_admissao = "Data de admissão é obrigatória.";
    
    // Future date check
    const today = new Date();
    today.setHours(0,0,0,0);
    const admissionDate = new Date(formData.data_admissao);
    // Simple check: timezone might affect this but for day granularity usually safe
    if (admissionDate > new Date(today.getTime() + 86400000)) { 
        newErrors.data_admissao = "Data não pode ser futura.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      // Error handled by hook toast usually, but we keep modal open
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--layout-bg)] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-[var(--layout-border)] shadow-2xl"
      >
        <div className="p-5 border-b border-[var(--layout-border)] flex justify-between items-center bg-[var(--layout-surface-2)] rounded-t-xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bike className="w-5 h-5 text-[var(--layout-accent)]" />
            {motoboy ? 'Editar Motoboy' : 'Novo Motoboy'}
          </h2>
          <button onClick={onClose} className="text-[var(--layout-text-muted)] hover:text-white p-1 rounded-full hover:bg-white/10 transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
          
          {/* Section 1: Dados Pessoais */}
          <section>
            <h3 className="text-[var(--layout-accent)] font-bold uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4" /> Dados Pessoais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Nome Completo *</label>
                <input
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  className={`w-full bg-[var(--layout-bg)] border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)] ${errors.nome ? 'border-red-500' : 'border-[var(--layout-border)]'}`}
                  placeholder="Nome do motoboy"
                />
                {errors.nome && <span className="text-red-500 text-xs mt-1">{errors.nome}</span>}
              </div>
              <div>
                <label className="text-sm text-[var(--layout-text-muted)] block mb-1">CPF *</label>
                <input
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleChange}
                  className={`w-full bg-[var(--layout-bg)] border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)] ${errors.cpf ? 'border-red-500' : 'border-[var(--layout-border)]'}`}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
                {errors.cpf && <span className="text-red-500 text-xs mt-1">{errors.cpf}</span>}
              </div>
              <div>
                <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Telefone *</label>
                <input
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleChange}
                  className={`w-full bg-[var(--layout-bg)] border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)] ${errors.telefone ? 'border-red-500' : 'border-[var(--layout-border)]'}`}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
                 {errors.telefone && <span className="text-red-500 text-xs mt-1">{errors.telefone}</span>}
              </div>
              <div className="col-span-2">
                <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Email (Opcional)</label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Dados do Veículo */}
          <section>
            <h3 className="text-[var(--layout-accent)] font-bold uppercase text-xs tracking-wider mb-4 flex items-center gap-2 border-t border-[var(--layout-border)] pt-4">
              <Bike className="w-4 h-4" /> Dados do Veículo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Modelo do Veículo *</label>
                <input
                  name="veiculo"
                  value={formData.veiculo}
                  onChange={handleChange}
                  className={`w-full bg-[var(--layout-bg)] border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)] ${errors.veiculo ? 'border-red-500' : 'border-[var(--layout-border)]'}`}
                  placeholder="Ex: Honda CG 160 Titan"
                />
                 {errors.veiculo && <span className="text-red-500 text-xs mt-1">{errors.veiculo}</span>}
              </div>
              <div>
                <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Placa *</label>
                <input
                  name="placa"
                  value={formData.placa}
                  onChange={handleChange}
                  className={`w-full bg-[var(--layout-bg)] border rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-[var(--layout-accent)] ${errors.placa ? 'border-red-500' : 'border-[var(--layout-border)]'}`}
                  placeholder="ABC-1234"
                  maxLength={8}
                />
                 {errors.placa && <span className="text-red-500 text-xs mt-1">{errors.placa}</span>}
              </div>
              <div>
                <label className="text-sm text-[var(--layout-text-muted)] block mb-1">RENAVAM</label>
                <input
                  name="renavam"
                  value={formData.renavam}
                  onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setFormData(prev => ({ ...prev, renavam: val }));
                  }}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
                  placeholder="11 dígitos"
                />
              </div>
              <div>
                <label className="text-sm text-[var(--layout-text-muted)] block mb-1">CNH</label>
                <input
                  name="cnh"
                  value={formData.cnh}
                  onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setFormData(prev => ({ ...prev, cnh: val }));
                  }}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
                  placeholder="Nº Registro"
                />
              </div>
            </div>
          </section>

          {/* Section 3 & 4: Admissão e Comissão */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-[var(--layout-border)] pt-4">
            <div>
              <h3 className="text-[var(--layout-accent)] font-bold uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Data de Admissão
              </h3>
              <div>
                <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Data de Início *</label>
                <input
                  type="date"
                  name="data_admissao"
                  value={formData.data_admissao}
                  onChange={handleChange}
                  max={new Date().toISOString().split('T')[0]}
                  className={`w-full bg-[var(--layout-bg)] border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)] ${errors.data_admissao ? 'border-red-500' : 'border-[var(--layout-border)]'}`}
                />
                 {errors.data_admissao && <span className="text-red-500 text-xs mt-1">{errors.data_admissao}</span>}
              </div>
            </div>

            <div>
              <h3 className="text-[var(--layout-accent)] font-bold uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Comissão
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Percentual (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    name="comissao_percentual"
                    value={formData.comissao_percentual}
                    onChange={handleChange}
                    className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Fixa (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="comissao_fixa"
                    value={formData.comissao_fixa}
                    onChange={handleChange}
                    className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Endereço */}
          <section>
            <h3 className="text-[var(--layout-accent)] font-bold uppercase text-xs tracking-wider mb-4 flex items-center gap-2 border-t border-[var(--layout-border)] pt-4">
              <MapPin className="w-4 h-4" /> Endereço
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                 <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Logradouro</label>
                 <input
                  name="endereco"
                  value={formData.endereco}
                  onChange={handleChange}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
                  placeholder="Rua, Avenida, etc."
                />
              </div>
              <div>
                 <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Número</label>
                 <input
                  name="numero"
                  value={formData.numero}
                  onChange={handleChange}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
                />
              </div>
              <div className="md:col-span-2">
                 <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Complemento</label>
                 <input
                  name="complemento"
                  value={formData.complemento}
                  onChange={handleChange}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
                  placeholder="Apto, Bloco, etc."
                />
              </div>
              <div className="md:col-span-2">
                 <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Bairro</label>
                 <input
                  name="bairro"
                  value={formData.bairro}
                  onChange={handleChange}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
                />
              </div>
              <div>
                 <label className="text-sm text-[var(--layout-text-muted)] block mb-1">CEP</label>
                 <input
                  name="cep"
                  value={formData.cep}
                  onChange={handleChange}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
                  placeholder="00000-000"
                  maxLength={9}
                />
              </div>
              <div>
                 <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Cidade</label>
                 <input
                  name="cidade"
                  value={formData.cidade}
                  onChange={handleChange}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
                />
              </div>
              <div className="md:col-span-2">
                 <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Estado</label>
                 <select
                  name="estado"
                  value={formData.estado}
                  onChange={handleChange}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
                 >
                   <option value="">Selecione...</option>
                   {BRAZILIAN_STATES.map(uf => (
                     <option key={uf} value={uf}>{uf}</option>
                   ))}
                 </select>
              </div>
            </div>
          </section>

          {/* Section 6 & 7: Obs & Status */}
          <section className="grid grid-cols-1 gap-4 border-t border-[var(--layout-border)] pt-4">
             <div>
                <label className="text-sm text-[var(--layout-text-muted)] block mb-1">Observações</label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleChange}
                  maxLength={500}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)] h-24 resize-none"
                  placeholder="Informações adicionais..."
                />
             </div>
             
             <div className="flex items-center gap-3 bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
               <label className="relative inline-flex items-center cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={formData.status === 'ativo'} 
                   onChange={(e) => setFormData(p => ({ ...p, status: e.target.checked ? 'ativo' : 'inativo' }))}
                   className="sr-only peer" 
                 />
                 <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--layout-accent)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--layout-accent)]"></div>
                 <span className="ml-3 text-sm font-medium text-[var(--layout-text-muted)]">
                   Motoboy {formData.status === 'ativo' ? 'Ativo' : 'Inativo'}
                 </span>
               </label>
             </div>
          </section>

        </div>

        <div className="p-5 border-t border-[var(--layout-border)] flex justify-end gap-3 bg-[var(--layout-surface-2)] rounded-b-xl">
          <Button variant="outline" onClick={onClose} className="border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:bg-[var(--layout-border)] hover:text-white">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white min-w-[140px] font-bold"
          >
            {loading ? 'Salvando...' : 'SALVAR'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default MotoboyCadastroModal;
