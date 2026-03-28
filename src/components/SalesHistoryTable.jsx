import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  ChevronDown, 
  ChevronUp, 
  Edit2, 
  Trash2, 
  ShoppingBag, 
  Truck, 
  MapPin, 
  CreditCard 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SalesHistoryTable = ({ sales, onEdit, onDelete }) => {
  const [expandedRow, setExpandedRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const toggleRow = (saleId) => {
    setExpandedRow(expandedRow === saleId ? null : saleId);
  };

  const totalPages = Math.ceil(sales.length / itemsPerPage);
  const currentSales = sales.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  return (
    <div className="bg-[var(--layout-bg)] rounded-lg border border-[var(--layout-border)] overflow-hidden flex flex-col h-full">
      <div className="overflow-auto flex-1 custom-scrollbar">
        <table className="w-full min-w-[960px]">
          <thead className="bg-[var(--layout-surface-2)] sticky top-0 z-10 shadow-md">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">Pedido</th>
              <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">Data/Hora</th>
              <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">Tipo</th>
              <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">Cliente</th>
              <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase">Itens</th>
              <th className="py-3 px-4 text-right text-xs font-bold text-[var(--layout-text-muted)] uppercase">Total</th>
              <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase">Status</th>
              <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--layout-border)]">
            {currentSales.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-12 text-center text-[var(--layout-text-muted)]">
                  Nenhuma venda encontrada para os filtros selecionados.
                </td>
              </tr>
            ) : (
              currentSales.map((sale) => (
                <React.Fragment key={sale.id}>
                  <tr 
                    onClick={() => toggleRow(sale.id)}
                    className={`cursor-pointer transition-colors ${
                      expandedRow === sale.id ? 'bg-[var(--layout-surface-2)]/50' : 'hover:bg-[var(--layout-surface-2)]/30'
                    }`}
                  >
                    <td className="py-4 px-4 text-white font-mono text-sm">
                      #{sale.numero_venda || String(sale.id).slice(0, 8)}
                    </td>
                    <td className="py-4 px-4 text-[var(--layout-text-muted)] text-sm">
                      {format(new Date(sale.data_criacao || sale.data_hora), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                        sale.tipo_venda === 'delivery' 
                          ? 'bg-[#FF8C00]/10 text-[#FF8C00]' 
                          : 'bg-[#3B82F6]/10 text-[#3B82F6]'
                      }`}>
                        {sale.tipo_venda === 'delivery' ? <Truck className="w-3 h-3" /> : <ShoppingBag className="w-3 h-3" />}
                        {sale.tipo_venda === 'delivery' ? 'DELIVERY' : 'LOJA'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-white text-sm">
                      {sale.cliente?.nome || <span className="text-[var(--layout-text-muted)] italic">Não identificado</span>}
                    </td>
                    <td className="py-4 px-4 text-center text-[var(--layout-text-muted)] text-sm">
                      {sale.itens?.length || 0}
                    </td>
                    <td className="py-4 px-4 text-right text-[var(--layout-accent)] font-bold text-sm">
                      R$ {Number(sale.total).toFixed(2)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        sale.status === 'cancelado' 
                          ? 'bg-[#EF4444]/10 text-[#EF4444]' 
                          : 'bg-[var(--layout-accent)]/10 text-[var(--layout-accent)]'
                      }`}>
                        {sale.status === 'cancelado' ? 'CANCELADA' : 'COMPLETA'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                        onClick={(e) => { e.stopPropagation(); onEdit(sale); }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        onClick={(e) => { e.stopPropagation(); onDelete(sale); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      {expandedRow === sale.id ? (
                        <ChevronUp className="w-5 h-5 text-[var(--layout-text-muted)]" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[var(--layout-text-muted)]" />
                      )}
                    </td>
                  </tr>
                  
                  {expandedRow === sale.id && (
                    <tr className="bg-[var(--layout-surface-2)]">
                      <td colSpan="8" className="p-4 border-t border-b border-[var(--layout-border)]">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {/* Items List */}
                          <div className="lg:col-span-2 bg-[var(--layout-bg)] rounded border border-[var(--layout-border)] p-3">
                            <h4 className="text-[var(--layout-text-muted)] text-xs font-bold uppercase mb-2">Itens do Pedido</h4>
                            <div className="max-h-40 overflow-y-auto custom-scrollbar">
                              <table className="w-full text-sm">
                                <tbody>
                                  {sale.itens?.map((item, idx) => (
                                    <tr key={idx} className="border-b border-[var(--layout-border)] last:border-0">
                                      <td className="py-1 text-white">{item.quantidade}x</td>
                                      <td className="py-1 text-[var(--layout-text-muted)] w-full px-2">{item.produto?.descricao || 'Produto'}</td>
                                      <td className="py-1 text-right text-[var(--layout-text-muted)]">R$ {Number(item.total).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Payment & Delivery Info */}
                          <div className="space-y-4">
                            <div className="bg-[var(--layout-bg)] rounded border border-[var(--layout-border)] p-3">
                              <h4 className="text-[var(--layout-text-muted)] text-xs font-bold uppercase mb-2 flex items-center gap-2">
                                <CreditCard className="w-3 h-3" /> Pagamento
                              </h4>
                              {sale.pagamentos?.map((pag, idx) => (
                                <div key={idx} className="flex justify-between text-sm mb-1">
                                  <span className="text-white capitalize">{pag.forma_pagamento}</span>
                                  <span className="text-[var(--layout-accent)] font-bold">R$ {Number(pag.valor).toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="border-t border-[var(--layout-border)] mt-2 pt-2 text-xs text-[var(--layout-text-muted)]">
                                <div>Subtotal: R$ {Number(sale.subtotal).toFixed(2)}</div>
                                <div>Desconto: R$ {Number(sale.desconto).toFixed(2)}</div>
                              </div>
                            </div>

                            {sale.tipo_venda === 'delivery' && (
                              <div className="bg-[var(--layout-bg)] rounded border border-[var(--layout-border)] p-3">
                                <h4 className="text-[var(--layout-text-muted)] text-xs font-bold uppercase mb-2 flex items-center gap-2">
                                  <MapPin className="w-3 h-3" /> Entrega
                                </h4>
                                <p className="text-sm text-white">{sale.endereco_entrega}</p>
                                {sale.observacoes_entrega && (
                                  <p className="text-xs text-[var(--layout-text-muted)] mt-1 italic">Obs: {sale.observacoes_entrega}</p>
                                )}
                              </div>
                            )}
                            
                            {sale.observacoes && (
                               <div className="bg-[var(--layout-bg)] rounded border border-[var(--layout-border)] p-3">
                                <h4 className="text-[var(--layout-text-muted)] text-xs font-bold uppercase mb-2">Observações da Venda</h4>
                                <p className="text-sm text-[var(--layout-text-muted)] italic">{sale.observacoes}</p>
                              </div>
                            )}
                          </div>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-[var(--layout-border)] bg-[var(--layout-surface-2)] flex justify-between items-center">
          <span className="text-sm text-[var(--layout-text-muted)]">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:text-white hover:bg-[var(--layout-border)]"
            >
              Anterior
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:text-white hover:bg-[var(--layout-border)]"
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistoryTable;
