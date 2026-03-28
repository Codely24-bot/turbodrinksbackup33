import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, Bike, Building, FileText } from 'lucide-react';

const DeliveryDataSection = ({ 
  motoboys = [], 
  formData, 
  onChange, 
  errors = {} 
}) => {
  const handleChange = (field, value) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-[var(--layout-surface-2)] rounded-xl border border-[var(--layout-border)] p-5 space-y-4 overflow-hidden"
    >
      <div className="flex items-center gap-2 text-white font-bold text-sm uppercase border-b border-[var(--layout-border)] pb-2 mb-2">
        <Bike className="w-4 h-4 text-[var(--layout-accent)]" />
        Dados de Entrega
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Motoboy Selection */}
        <div className="md:col-span-2">
          <label className="block text-xs text-[var(--layout-text-muted)] uppercase font-bold mb-1">
            Motoboy Responsável *
          </label>
          <div className="relative">
            <select
              value={formData.motoboy_id || ''}
              onChange={(e) => handleChange('motoboy_id', e.target.value)}
              className={`w-full bg-[var(--layout-bg)] border rounded-lg px-3 py-2.5 text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[var(--layout-accent)] ${
                errors.motoboy_id ? 'border-red-500' : 'border-[var(--layout-border)]'
              }`}
            >
              <option value="">Selecione um motoboy...</option>
              {motoboys.map((moto) => (
                <option key={moto.id} value={moto.id}>
                  {moto.nome} {moto.telefone ? `(${moto.telefone})` : ''}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Bike className="w-4 h-4 text-[var(--layout-text-muted)]" />
            </div>
          </div>
          {errors.motoboy_id ? (
            <span className="text-red-400 text-xs mt-1">{errors.motoboy_id}</span>
          ) : null}
        </div>

        {/* Address Fields */}
        <div className="md:col-span-2">
          <label className="block text-xs text-[var(--layout-text-muted)] uppercase font-bold mb-1">
            Endereço *
          </label>
          <div className="relative">
            <input
              type="text"
              value={formData.endereco || ''}
              onChange={(e) => handleChange('endereco', e.target.value)}
              placeholder="Rua, Avenida, Logradouro..."
              className={`w-full bg-[var(--layout-bg)] border rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)] ${
                errors.endereco ? 'border-red-500' : 'border-[var(--layout-border)]'
              }`}
            />
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--layout-text-muted)]" />
          </div>
          {errors.endereco ? <span className="text-red-400 text-xs mt-1">{errors.endereco}</span> : null}
        </div>

        <div>
          <label className="block text-xs text-[var(--layout-text-muted)] uppercase font-bold mb-1">
            Número *
          </label>
          <div className="relative">
            <input
              type="text"
              value={formData.numero || ''}
              onChange={(e) => handleChange('numero', e.target.value)}
              placeholder="123"
              className={`w-full bg-[var(--layout-bg)] border rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)] ${
                errors.numero ? 'border-red-500' : 'border-[var(--layout-border)]'
              }`}
            />
            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--layout-text-muted)]" />
          </div>
          {errors.numero ? <span className="text-red-400 text-xs mt-1">{errors.numero}</span> : null}
        </div>

        <div>
          <label className="block text-xs text-[var(--layout-text-muted)] uppercase font-bold mb-1">
            Bairro *
          </label>
          <div className="relative">
            <input
              type="text"
              value={formData.bairro || ''}
              onChange={(e) => handleChange('bairro', e.target.value)}
              placeholder="Centro"
              className={`w-full bg-[var(--layout-bg)] border rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)] ${
                errors.bairro ? 'border-red-500' : 'border-[var(--layout-border)]'
              }`}
            />
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--layout-text-muted)]" />
          </div>
          {errors.bairro ? <span className="text-red-400 text-xs mt-1">{errors.bairro}</span> : null}
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs text-[var(--layout-text-muted)] uppercase font-bold mb-1">
            Complemento
          </label>
          <input
            type="text"
            value={formData.complemento || ''}
            onChange={(e) => handleChange('complemento', e.target.value)}
            placeholder="Apto 101, Bloco B (Opcional)"
            className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)]"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs text-[var(--layout-text-muted)] uppercase font-bold mb-1">
            Observações de Entrega
          </label>
          <div className="relative">
            <textarea
              value={formData.observacoes || ''}
              onChange={(e) => handleChange('observacoes', e.target.value)}
              placeholder="Ponto de referência, instruções para o entregador..."
              rows={2}
              className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-[var(--layout-accent)] resize-none"
            />
            <FileText className="absolute left-3 top-3 w-4 h-4 text-[var(--layout-text-muted)]" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DeliveryDataSection;
