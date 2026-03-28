import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Search, Plus, Edit, Trash2, X, Loader2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { deleteProduct, restoreProduct } from '@/services/productService';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCombos } from '@/hooks/useCombos';
import CreateProductModal from '@/components/CreateProductModal';
import EditProductModal from '@/components/EditProductModal';

const ProdutosPage = () => {
  const [produtos, setProdutos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const { fetchComboInsumos } = useCombos();

  useEffect(() => {
    if (user?.id) {
      loadProdutos();

      const subscription = supabase
        .channel('produtos_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos', filter: `user_id=eq.${user.id}` }, () => {
          loadProdutos();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
    // Listen for sales and refresh products
    const handler = async (e) => {
      try { await loadProdutos(); } catch (err) { console.error('Error refreshing produtos after sale:', err); }
    };
    window.addEventListener('venda.finalizada', handler);
    return () => { window.removeEventListener('venda.finalizada', handler); };
  }, [user]);

  const loadProdutos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .order('descricao', { ascending: true });

      if (error) throw error;
      // Enrich combo products with their insumos (component products and stock)
      const enriched = await Promise.all((data || []).map(async (p) => {
        if (p.tipo === 'combo') {
          try {
            const insumos = await fetchComboInsumos(p.id);
            // insumos items include `produto` (the referenced product) from the join
            return { ...p, insumos };
          } catch (e) {
            console.error('Erro ao buscar insumos do combo', p.id, e);
            return { ...p, insumos: [] };
          }
        }
        return p;
      }));
      setProdutos(enriched);
    } catch (error) {
      toast({ title: 'Erro ao carregar produtos', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const calculateMargin = (compra, venda) => {
    const c = parseFloat(compra) || 0;
    const v = parseFloat(venda) || 0;
    if (c === 0) return 0;
    return (((v - c) / c) * 100).toFixed(2);
  };

  const handleSaveProduct = async (productData, insumos = []) => {
    try {
      const payload = {
        user_id: user.id,
        codigo: productData.codigo,
        descricao: productData.descricao,
        categoria: productData.categoria,
        unidade: productData.unidade,
        valor_compra: productData.valor_compra,
        valor_venda: productData.valor_venda,
        estoque: productData.estoque,
        estoque_minimo: productData.estoque_minimo,
        ativo: productData.ativo,
        tipo: productData.tipo,
        eh_combo: productData.eh_combo
      };

      // Create Product
      const { data: newProd, error } = await supabase
        .from('produtos')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      // Handle Combo Insumos
      if (productData.tipo === 'combo' && insumos.length > 0) {
        const insumoRecords = insumos.map(i => ({
          user_id: user.id,
          combo_id: newProd.id,
          insumo_id: i.insumo_id,
          quantidade: i.quantidade,
          unidade_medida: i.unidade_medida
        }));
        const { error: insumoError } = await supabase.from('combo_insumos').insert(insumoRecords);
        if (insumoError) throw insumoError;
      }

      await loadProdutos(); // Refresh list immediately after save
      return true;
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const handleUpdateProduct = async (id, productData, insumos = []) => {
    try {
      const payload = {
        codigo: productData.codigo,
        descricao: productData.descricao,
        categoria: productData.categoria,
        unidade: productData.unidade,
        valor_compra: productData.valor_compra,
        valor_venda: productData.valor_venda,
        estoque: productData.estoque,
        estoque_minimo: productData.estoque_minimo,
        ativo: productData.ativo,
        tipo: productData.tipo,
        eh_combo: productData.eh_combo
      };

      // Update Product
      const { error } = await supabase
        .from('produtos')
        .update(payload)
        .eq('id', id);

      if (error) throw error;

      // Handle Combo Insumos - Delete old, insert new (simplest approach)
      if (productData.tipo === 'combo') {
        // Delete existing
        await supabase.from('combo_insumos').delete().eq('combo_id', id);

        // Insert new
        if (insumos.length > 0) {
          const insumoRecords = insumos.map(i => ({
            user_id: user.id,
            combo_id: id,
            insumo_id: i.insumo_id,
            quantidade: i.quantidade,
            unidade_medida: i.unidade_medida
          }));
          const { error: insumoError } = await supabase.from('combo_insumos').insert(insumoRecords);
          if (insumoError) throw insumoError;
        }
      }

      await loadProdutos(); // Refresh list immediately after update
      return true;
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente excluir este produto?')) return;
    try {
      const previous = await deleteProduct(id, user.id);
      // Optimistically remove
      setProdutos(prev => prev.filter(p => p.id !== id));
      toast({
        title: 'Produto removido (inativo)',
        description: 'Produto marcado como inativo e estoque zerado.',
        action: (
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              await restoreProduct(previous, user.id);
              await loadProdutos();
              toast({ title: 'Restaurado', description: 'Produto restaurado com sucesso.' });
            } catch (e) {
              console.error('Undo restore failed', e);
              toast({ title: 'Erro ao restaurar', description: e.message || e, variant: 'destructive' });
            }
          }}>Desfazer</Button>
        ),
      });
      await loadProdutos();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({ title: 'Erro ao excluir', description: error.message || error, variant: 'destructive' });
    }
  };

  const handleEdit = (prod) => {
    setSelectedProduct(prod);
    setIsEditOpen(true);
  };

  const filteredProdutos = produtos.filter(p =>
    p.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6">
      <Helmet>
        <title>Produtos - PDV</title>
      </Helmet>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Produtos</h1>
        <p className="text-[var(--layout-text-muted)]">Gerenciar cadastro de produtos e combos</p>
      </div>

      <div className="bg-[var(--layout-surface-2)] rounded-lg p-4 sm:p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--layout-text-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, descrição ou categoria..."
              className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg pl-10 pr-4 py-3 text-white placeholder-[var(--layout-text-muted)] focus:border-[var(--layout-accent)] focus:outline-none"
            />
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white w-full md:w-auto">
            <Plus className="w-5 h-5 mr-2" />
            Novo Produto
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-[var(--layout-border)]">
                <th className="text-left py-3 px-4 text-[var(--layout-text-muted)] font-medium">Código</th>
                <th className="text-left py-3 px-4 text-[var(--layout-text-muted)] font-medium">Descrição</th>
                <th className="text-left py-3 px-4 text-[var(--layout-text-muted)] font-medium">Tipo</th>
                <th className="text-left py-3 px-4 text-[var(--layout-text-muted)] font-medium">Estoque</th>
                <th className="text-left py-3 px-4 text-[var(--layout-text-muted)] font-medium">V. Venda</th>
                <th className="text-left py-3 px-4 text-[var(--layout-text-muted)] font-medium">Margem</th>
                <th className="text-right py-3 px-4 text-[var(--layout-text-muted)] font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="py-8 text-center text-[var(--layout-text-muted)]"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></td></tr>
              ) : filteredProdutos.length === 0 ? (
                <tr><td colSpan="7" className="py-8 text-center text-[var(--layout-text-muted)]">Nenhum produto encontrado</td></tr>
              ) : (
                filteredProdutos.map((produto) => (
                  <tr key={produto.id} className="border-b border-[var(--layout-border)] hover:bg-[var(--layout-bg)] transition-colors">
                    <td className="py-3 px-4 text-white font-mono">{produto.codigo}</td>
                    <td className="py-3 px-4 text-white">{produto.descricao}</td>
                    <td className="py-3 px-4">
                      {produto.tipo === 'combo' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          <Layers className="w-3 h-3 mr-1" /> Combo
                        </span>
                      ) : (
                        <span className="text-[var(--layout-text-muted)] text-sm">Simples</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[var(--layout-text-muted)] align-top">
                      {produto.tipo === 'combo' ? (
                        <div className="space-y-1 max-w-xs">
                          {produto.insumos && produto.insumos.length > 0 ? (
                            (() => {
                              // compute how many full combos can be assembled from insumos
                              const availability = produto.insumos.reduce((acc, ins) => {
                                try {
                                  const insumoStock = parseFloat(ins.produto?.estoque || 0);
                                  const needed = parseFloat(ins.quantidade) || 1;
                                  const canMake = Math.floor(insumoStock / needed);
                                  return acc === null ? canMake : Math.min(acc, canMake);
                                } catch (e) {
                                  return acc === null ? 0 : Math.min(acc, 0);
                                }
                              }, null) ?? 0;

                              return (
                                <>
                                  <div className="text-sm text-white font-semibold">Disponível: {availability}</div>
                                  <div className="mt-1 text-xs text-[var(--layout-text-muted)] space-y-1">
                                    {produto.insumos.map((ins) => (
                                      <div key={ins.id} className="flex justify-between">
                                        <span className="truncate">{ins.produto?.descricao || 'Insumo'} x{ins.quantidade}</span>
                                        <span className="font-mono">{ins.produto?.estoque ?? 0}</span>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              );
                            })()
                          ) : (
                            <div className="text-sm text-[var(--layout-text-muted)]">Sem insumos configurados</div>
                          )}
                        </div>
                      ) : (
                        produto.estoque
                      )}
                    </td>
                    <td className="py-3 px-4 text-[var(--layout-accent)] font-semibold">R$ {parseFloat(produto.valor_venda || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-blue-400">{calculateMargin(produto.valor_compra, produto.valor_venda)}%</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleEdit(produto)} className="text-blue-400 hover:text-blue-300 mr-3"><Edit className="w-5 h-5" /></button>
                      <button onClick={() => handleDelete(produto.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-5 h-5" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateProductModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSave={handleSaveProduct}
      />

      <EditProductModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        product={selectedProduct}
        onSave={handleUpdateProduct}
      />
    </div>
  );
};

export default ProdutosPage;
