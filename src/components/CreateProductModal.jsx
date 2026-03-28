import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PackagePlus, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { generateBarcode, checkBarcodeExists } from '@/utils/barcodeGenerator';
import { supabase } from '@/lib/customSupabaseClient';
import ComboInsumoTable from '@/components/ComboInsumoTable';
import AddComboInsumoModal from '@/components/AddComboInsumoModal';

const CreateProductModal = ({ isOpen, onClose, onSave }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [showAddInsumo, setShowAddInsumo] = useState(false);
  
  const initialFormState = {
    codigo: '',
    descricao: '',
    categoria: '',
    unidade: 'UN',
    valor_compra: '',
    valor_venda: '',
    estoque: '',
    estoque_minimo: '',
    ativo: true,
    tipo: 'simples', // 'simples' or 'combo'
    eh_combo: false,
    insumos: [] // Local state for insumos
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (isOpen && user) {
      fetchProducts();
      // Ensure form is clean when opening
      setFormData(initialFormState);
    }
  }, [isOpen, user]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .neq('tipo', 'combo'); // Fetch only non-combo products for insumos
    
    if (data) setAllProducts(data);
  };

  if (!isOpen) return null;

  const resetForm = () => {
    setFormData(initialFormState);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleTypeChange = (e) => {
    const type = e.target.value;
    setFormData(prev => ({
      ...prev,
      tipo: type,
      eh_combo: type === 'combo',
      insumos: type === 'combo' ? prev.insumos : [] // Clear insumos if switching back to simple? Maybe keep them just in case.
    }));
  };

  const handleGenerateBarcode = async () => {
    if (!user) return;
    setIsGenerating(true);

    try {
      let newCode = '';
      let exists = true;
      let attempts = 0;

      while (exists && attempts < 5) {
        newCode = generateBarcode();
        exists = await checkBarcodeExists(newCode, user.id);
        attempts++;
      }

      if (exists) {
        toast({ title: 'Erro ao gerar código', description: 'Tente novamente.', variant: 'destructive' });
      } else {
        setFormData(prev => ({ ...prev, codigo: newCode }));
        toast({ title: 'Código gerado', description: newCode, className: 'bg-blue-600 text-white border-none' });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setTimeout(() => setIsGenerating(false), 1000);
    }
  };

  const handleAddInsumo = (insumo) => {
    // Check duplicate
    if (formData.insumos.some(i => i.insumo_id === insumo.insumo_id)) {
      toast({ title: 'Este insumo já foi adicionado', variant: 'destructive' });
      return;
    }
    setFormData(prev => ({
      ...prev,
      insumos: [...prev.insumos, insumo]
    }));
  };

  const handleRemoveInsumo = (insumoId) => {
    setFormData(prev => ({
      ...prev,
      insumos: prev.insumos.filter(i => i.insumo_id !== insumoId)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.tipo === 'combo' && formData.insumos.length === 0) {
      toast({
        title: 'Erro de validação',
        description: 'Adicione pelo menos 1 insumo para o combo.',
        variant: 'destructive'
      });
      return;
    }

    // Call onSave which should handle the async operations
    const success = await onSave({
      ...formData,
      valor_compra: parseFloat(formData.valor_compra) || 0,
      valor_venda: parseFloat(formData.valor_venda) || 0,
      estoque: formData.tipo === 'combo' ? 0 : (parseInt(formData.estoque) || 0), // Combos don't have direct stock usually, or 0
      estoque_minimo: parseInt(formData.estoque_minimo) || 0
    }, formData.insumos);
    
    if (success !== false) {
      toast({
        title: 'Sucesso',
        description: 'Produto criado com sucesso!',
        className: 'bg-green-600 text-white border-none'
      });
      resetForm();
      setTimeout(() => onClose(), 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[var(--layout-bg)] rounded-xl border border-[var(--layout-border)] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="bg-[var(--layout-surface-2)] p-4 border-b border-[var(--layout-border)] flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 text-white font-bold">
              <PackagePlus className="w-5 h-5 text-[var(--layout-accent)]" />
              <span>NOVO PRODUTO</span>
            </div>
            <button onClick={onClose} className="text-[var(--layout-text-muted)] hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto custom-scrollbar p-6">
            <form id="createProductForm" onSubmit={handleSubmit} className="space-y-6">
              
              {/* Type Selection */}
              <div className="bg-[var(--layout-surface-2)]/50 p-4 rounded-lg border border-[var(--layout-border)]">
                <label className="text-xs text-[var(--layout-text-muted)] mb-2 block uppercase font-bold">Tipo de Produto</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="tipo" 
                      value="simples" 
                      checked={formData.tipo === 'simples'} 
                      onChange={handleTypeChange}
                      className="text-[var(--layout-accent)] focus:ring-[var(--layout-accent)]"
                    />
                    <span className="text-white">Produto Simples</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="tipo" 
                      value="combo" 
                      checked={formData.tipo === 'combo'} 
                      onChange={handleTypeChange}
                      className="text-[#3B82F6] focus:ring-[#3B82F6]"
                    />
                    <span className="text-white font-bold text-[#3B82F6]">Combo / Kit</span>
                  </label>
                </div>
              </div>

              {/* Identification */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[var(--layout-text-muted)] uppercase border-b border-[var(--layout-border)] pb-1">Identificação</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-1">
                    <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Código de Barras</label>
                    <div className="flex">
                      <input
                        name="codigo"
                        value={formData.codigo}
                        onChange={handleChange}
                        placeholder="EAN-13 ou Código Interno"
                        className="flex-1 bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-l px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                      />
                      <Button
                        type="button"
                        onClick={handleGenerateBarcode}
                        disabled={isGenerating}
                        className="ml-0 rounded-l-none bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3"
                        size="sm"
                      >
                        {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="col-span-1">
                     <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Descrição *</label>
                     <input
                      name="descricao"
                      required
                      value={formData.descricao}
                      onChange={handleChange}
                      className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Categoria</label>
                    <select
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleChange}
                      className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                    >
                      <option value="">Selecione...</option>
                      <option value="Alimentos">Alimentos</option>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Combos">Combos</option>
                      <option value="Limpeza">Limpeza</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  
                  <div>
                     <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Unidade</label>
                     <select
                      name="unidade"
                      value={formData.unidade}
                      onChange={handleChange}
                      className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                    >
                      <option value="UN">Unidade (UN)</option>
                      <option value="KG">Quilograma (KG)</option>
                      <option value="KIT">Kit / Combo</option>
                      <option value="LT">Litro (LT)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* COMBO INSUMOS SECTION */}
              {formData.tipo === 'combo' && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex justify-between items-end border-b border-[var(--layout-border)] pb-1">
                     <h3 className="text-sm font-bold text-[#3B82F6] uppercase">Insumos do Combo</h3>
                     <Button
                      type="button"
                      size="sm"
                      onClick={() => setShowAddInsumo(true)}
                      className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white text-xs h-7"
                     >
                       <Plus className="w-3 h-3 mr-1" /> ADICIONAR INSUMO
                     </Button>
                  </div>
                  
                  <ComboInsumoTable 
                    insumos={formData.insumos} 
                    onRemove={handleRemoveInsumo} 
                  />
                </div>
              )}

              {/* Values */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[var(--layout-text-muted)] uppercase border-b border-[var(--layout-border)] pb-1">Valores</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                    <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Preço de Custo (R$)</label>
                    <input
                      name="valor_compra"
                      type="number"
                      step="0.01"
                      value={formData.valor_compra}
                      onChange={handleChange}
                      className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Preço de Venda (R$) *</label>
                    <input
                      name="valor_venda"
                      required
                      type="number"
                      step="0.01"
                      value={formData.valor_venda}
                      onChange={handleChange}
                      className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none font-bold"
                    />
                  </div>
                </div>
              </div>
              
              {/* Stock - Only for Simple Products */}
              {formData.tipo !== 'combo' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-[var(--layout-text-muted)] uppercase border-b border-[var(--layout-border)] pb-1">Estoque</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Estoque Atual</label>
                      <input
                        name="estoque"
                        type="number"
                        value={formData.estoque}
                        onChange={handleChange}
                        className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Estoque Mínimo</label>
                      <input
                        name="estoque_minimo"
                        type="number"
                        value={formData.estoque_minimo}
                        onChange={handleChange}
                        className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  name="ativo"
                  checked={formData.ativo}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-[var(--layout-border)] bg-[var(--layout-surface-2)] text-[var(--layout-accent)] focus:ring-[var(--layout-accent)]"
                />
                <label htmlFor="ativo" className="text-sm text-white cursor-pointer select-none">
                  Produto Ativo
                </label>
              </div>
            </form>
          </div>

          <div className="p-4 border-t border-[var(--layout-border)] bg-[var(--layout-surface-2)] shrink-0 grid grid-cols-2 gap-4">
            <Button
              type="button"
              onClick={onClose}
              className="bg-[var(--layout-border)] hover:bg-[var(--layout-surface-2)] text-white border border-[var(--layout-border)]"
            >
              CANCELAR
            </Button>
            <Button
              form="createProductForm"
              type="submit"
              className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white font-bold"
            >
              SALVAR PRODUTO
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      <AddComboInsumoModal
        isOpen={showAddInsumo}
        onClose={() => setShowAddInsumo(false)}
        onAdd={handleAddInsumo}
        availableProducts={allProducts}
      />
    </div>
  );
};

export default CreateProductModal;
