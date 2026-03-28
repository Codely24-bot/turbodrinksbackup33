import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Filter, Calendar, ChevronDown, ChevronUp, Edit2, Trash2, ShoppingBag, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { useSalesHistory } from '@/hooks/useSalesHistory';
import EditItemModal from '@/components/EditItemModal';
import CancelItemConfirmation from '@/components/CancelItemConfirmation';
import AdminPasswordModal from '@/components/AdminPasswordModal';

const SalesHistoryModal = ({ isOpen, onClose }) => {
  const { sales, items, loading, fetchSalesHistory, editItem, cancelItem } = useSalesHistory();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('todos'); // todos, loja, delivery
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  
  // Modals State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'edit'|'cancel', data: ... }

  useEffect(() => {
    if (isOpen) {
      fetchSalesHistory();
      setExpandedSaleId(null);
    }
  }, [isOpen, fetchSalesHistory]);

  const toggleExpand = (saleId) => {
    setExpandedSaleId(expandedSaleId === saleId ? null : saleId);
  };

  // --- Handlers for Actions ---

  const handleEditClick = (item) => {
    setSelectedItem(item);
    setEditModalOpen(true);
  };

  const handleCancelClick = (item) => {
    setSelectedItem(item);
    setCancelModalOpen(true);
  };

  const handleEditSave = (newItemData) => {
    setPendingAction({ type: 'edit', data: newItemData });
    setEditModalOpen(false);
    setPasswordModalOpen(true);
  };

  const handleCancelConfirm = () => {
    setPendingAction({ type: 'cancel', data: selectedItem });
    setCancelModalOpen(false);
    setPasswordModalOpen(true);
  };

  const handlePasswordConfirm = () => {
    if (pendingAction?.type === 'edit') {
      editItem(selectedItem.id, pendingAction.data);
    } else if (pendingAction?.type === 'cancel') {
      cancelItem(selectedItem.id);
    }
    setPendingAction(null);
    setSelectedItem(null);
  };

  // --- Filtering & Stats ---

  const filteredSales = sales.filter(sale => {
    const matchesSearch = 
      (sale.numero_venda?.toString() || '').includes(searchTerm) ||
      (sale.cliente?.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'todos' || sale.tipo_venda === filterType;

    return matchesSearch && matchesType;
  });

  const totalSales = filteredSales.length;
  const totalRevenue = filteredSales.reduce((acc, sale) => acc + Number(sale.total), 0);
  const totalItems = filteredSales.reduce((acc, sale) => {
    // Only count active items from the sale object (fetched as `itens` by the hook)
    const activeItems = (sale.itens || []).filter(i => i.status !== 'cancelado');
    return acc + activeItems.length;
  }, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--layout-bg)] rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-[var(--layout-border)]"
      >
        {/* Header */}
        <div className="bg-[var(--layout-surface-2)] border-b border-[var(--layout-border)] p-6 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              HISTÓRICO DE VENDAS DO DIA (F12)
            </h2>
            <div className="flex items-center gap-2 text-[var(--layout-text-muted)] text-sm mt-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(), 'dd/MM/yyyy')}
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--layout-text-muted)] hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filters & Stats */}
        <div className="p-6 border-b border-[var(--layout-border)] bg-[var(--layout-surface-2)]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-[var(--layout-surface-2)] p-4 rounded-lg border border-[var(--layout-border)]">
              <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Vendas Totais</span>
              <div className="text-2xl font-bold text-white">{totalSales}</div>
            </div>
            <div className="bg-[var(--layout-surface-2)] p-4 rounded-lg border border-[var(--layout-border)]">
              <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Faturamento</span>
              <div className="text-2xl font-bold text-[var(--layout-accent)]">R$ {totalRevenue.toFixed(2)}</div>
            </div>
             <div className="bg-[var(--layout-surface-2)] p-4 rounded-lg border border-[var(--layout-border)]">
              <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Itens Vendidos</span>
              <div className="text-2xl font-bold text-blue-400">{totalItems}</div>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--layout-text-muted)]" />
              <input
                type="text"
                placeholder="Buscar por nº pedido ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg pl-9 pr-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="loja">Loja</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>
        </div>

        {/* Sales List */}
        <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
          <table className="w-full">
            <thead className="bg-[var(--layout-surface-2)] sticky top-0 shadow-sm z-10">
              <tr>
                <th className="py-3 px-6 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">Pedido</th>
                <th className="py-3 px-6 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">Hora</th>
                <th className="py-3 px-6 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">Tipo</th>
                <th className="py-3 px-6 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">Cliente</th>
                <th className="py-3 px-6 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase">Itens</th>
                <th className="py-3 px-6 text-right text-xs font-bold text-[var(--layout-text-muted)] uppercase">Total</th>
                <th className="py-3 px-6 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--layout-border)]">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-[var(--layout-text-muted)]">Carregando histórico...</td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-[var(--layout-text-muted)]">Nenhuma venda encontrada.</td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <React.Fragment key={sale.id}>
                    <tr 
                      className={`hover:bg-[var(--layout-surface-2)]/50 transition-colors cursor-pointer ${expandedSaleId === sale.id ? 'bg-[var(--layout-surface-2)]/30' : ''}`}
                      onClick={() => toggleExpand(sale.id)}
                    >
                      <td className="py-4 px-6 text-white font-mono">#{sale.numero_venda || String(sale.id).slice(0, 8)}</td>
                      <td className="py-4 px-6 text-[var(--layout-text-muted)] text-sm">
                        {format(new Date(sale.data_criacao || sale.data_hora), 'HH:mm')}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                          sale.tipo_venda === 'delivery' 
                            ? 'bg-orange-500/10 text-orange-500' 
                            : 'bg-blue-500/10 text-blue-500'
                        }`}>
                          {sale.tipo_venda === 'delivery' ? <Truck className="w-3 h-3" /> : <ShoppingBag className="w-3 h-3" />}
                          {sale.tipo_venda === 'delivery' ? 'DELIVERY' : 'LOJA'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-white text-sm">{sale.cliente?.nome || 'Cliente Não Identificado'}</td>
                      <td className="py-4 px-6 text-center text-[var(--layout-text-muted)]">{(sale.itens || []).length}</td>
                      <td className="py-4 px-6 text-right text-[var(--layout-accent)] font-bold">R$ {Number(sale.total).toFixed(2)}</td>
                      <td className="py-4 px-6 text-center">
                        {expandedSaleId === sale.id ? <ChevronUp className="w-5 h-5 mx-auto text-[var(--layout-text-muted)]" /> : <ChevronDown className="w-5 h-5 mx-auto text-[var(--layout-text-muted)]" />}
                      </td>
                    </tr>
                    
                    {/* Expanded Details - Item List */}
                    {expandedSaleId === sale.id && (
                      <tr className="bg-[var(--layout-surface-2)] shadow-inner">
                        <td colSpan="7" className="p-4">
                          <div className="bg-[var(--layout-bg)] rounded-lg border border-[var(--layout-border)] overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-[var(--layout-surface-2)]">
                                <tr>
                                  <th className="py-2 px-4 text-left text-xs text-[var(--layout-text-muted)]">Produto</th>
                                  <th className="py-2 px-4 text-center text-xs text-[var(--layout-text-muted)]">Qtd</th>
                                  <th className="py-2 px-4 text-right text-xs text-[var(--layout-text-muted)]">Unitário</th>
                                  <th className="py-2 px-4 text-right text-xs text-[var(--layout-text-muted)]">Total</th>
                                  <th className="py-2 px-4 text-center text-xs text-[var(--layout-text-muted)]">Status</th>
                                  <th className="py-2 px-4 text-center text-xs text-[var(--layout-text-muted)]">Gerenciar</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--layout-border)]">
                                {(sale.itens || []).map((item) => (
                                  <tr key={item.id} className={item.status === 'cancelado' ? 'opacity-50 bg-red-900/10' : ''}>
                                    <td className="py-2 px-4 text-sm text-white">
                                      {item.status === 'cancelado' && <span className="text-red-500 font-bold mr-2">[CANCELADO]</span>}
                                      {/* Product Name lookup typically needed if items_venda doesn't store name directly, but here we assume we might need a join or items_venda stores snapshot data.
                                          Wait, useSalesHistory join fetched items_venda(*). Usually items_venda has product_id. 
                                          If product name is needed, we need to join products too or items_venda should have description. 
                                          Assuming items_venda has description/name snapshot or we rely on product_id relation.
                                          Let's assume the hook fetches products relation or items_venda has copied description. 
                                          Looking at fetchSalesHistory: select(*, itens:itens_venda(*)). 
                                          If items_venda doesn't have name, we need to fetch product info.
                                          Let's update hook or assume items_venda has it. For PDV, items_venda often copies description.
                                          If not, we'd see IDs. Let's assume description exists on items_venda for now based on Task 4 implying it.
                                          Actually, let's fix the hook to join products if needed. 
                                          `select(..., itens:itens_venda(*, produto:produtos(descricao)))` 
                                      */}
                                      {item.produto?.descricao || "Produto #" + item.produto_id.slice(0,4)}
                                    </td>
                                    <td className="py-2 px-4 text-center text-sm text-[var(--layout-text-muted)]">{item.quantidade}</td>
                                    <td className="py-2 px-4 text-right text-sm text-[var(--layout-text-muted)]">R$ {Number(item.valor_unitario).toFixed(2)}</td>
                                    <td className="py-2 px-4 text-right text-sm font-bold text-[var(--layout-text-muted)]">R$ {Number(item.total).toFixed(2)}</td>
                                    <td className="py-2 px-4 text-center text-xs">
                                      <span className={`px-2 py-0.5 rounded ${item.status === 'cancelado' ? 'bg-red-500 text-white' : 'bg-green-500/20 text-green-500'}`}>
                                        {item.status === 'cancelado' ? 'CANCELADO' : 'ATIVO'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-4 text-center flex justify-center gap-2">
                                      {item.status !== 'cancelado' && (
                                        <>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}
                                            className="p-1 text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                            title="Editar Item"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleCancelClick(item); }}
                                            className="p-1 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                            title="Cancelar Item"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Sub-Modals */}
      <EditItemModal 
        isOpen={editModalOpen} 
        onClose={() => setEditModalOpen(false)} 
        item={selectedItem}
        onSave={handleEditSave}
      />

      <CancelItemConfirmation 
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        item={selectedItem}
        onConfirm={handleCancelConfirm}
      />

      <AdminPasswordModal 
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onConfirm={handlePasswordConfirm}
        actionType={pendingAction?.type}
      />
    </div>
  );
};

export default SalesHistoryModal;
