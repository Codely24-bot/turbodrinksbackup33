import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, History, Search } from 'lucide-react';

const TableSection = ({ title, icon: Icon, children }) => (
  <div className="bg-[var(--layout-surface-2)] rounded-lg border border-[var(--layout-border)] overflow-hidden flex flex-col h-full">
    <div className="p-4 border-b border-[var(--layout-border)] bg-[var(--layout-bg)] flex items-center gap-2">
      <Icon className="w-5 h-5 text-[var(--layout-accent)]" />
      <h3 className="font-bold text-white">{title}</h3>
    </div>
    <div className="overflow-x-auto flex-1 custom-scrollbar">
      {children}
    </div>
  </div>
);

const ProductTable = ({ products, type }) => (
  <table className="w-full text-sm">
    <thead className="bg-[var(--layout-bg)] text-[var(--layout-text-muted)]">
      <tr>
        <th className="py-2 px-4 text-left font-medium">Produto</th>
        <th className="py-2 px-4 text-center font-medium">Qtd</th>
        <th className="py-2 px-4 text-right font-medium">Total</th>
        <th className="py-2 px-4 text-right font-medium">Lucro</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-[var(--layout-border)]">
      {products.length === 0 ? (
        <tr><td colSpan="4" className="py-8 text-center text-[var(--layout-text-muted)]">Sem dados</td></tr>
      ) : (
        products.map((p, i) => (
          <tr key={i} className="hover:bg-[var(--layout-bg)]/60 transition-colors">
            <td className="py-3 px-4">
              <div className="text-white font-medium">{p.descricao}</div>
              <div className="text-xs text-[var(--layout-text-muted)]">{p.codigo}</div>
            </td>
            <td className={`py-3 px-4 text-center font-bold ${type === 'top' ? 'text-[var(--layout-accent)]' : 'text-yellow-500'}`}>
              {p.quantidade}
            </td>
            <td className="py-3 px-4 text-right text-[var(--layout-text-muted)]">
              R$ {p.valorTotal.toFixed(2)}
            </td>
            <td className="py-3 px-4 text-right text-blue-400">
              R$ {p.lucro.toFixed(2)}
            </td>
          </tr>
        ))
      )}
    </tbody>
  </table>
);

const RelatorioTabelas = ({ maisVendidos, menosVendidos, historicoVendas }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const filteredHistory = historicoVendas.filter(v => 
    v.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vendedor_nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TableSection title="Mais Vendidos (Top 5)" icon={ArrowUpRight}>
          <ProductTable products={maisVendidos} type="top" />
        </TableSection>
        
        <TableSection title="Menos Vendidos (Bottom 5)" icon={ArrowDownRight}>
          <ProductTable products={menosVendidos} type="bottom" />
        </TableSection>
      </div>

      <div className="bg-[var(--layout-surface-2)] rounded-lg border border-[var(--layout-border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--layout-border)] bg-[var(--layout-bg)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--layout-accent)]" />
            <h3 className="font-bold text-white">Histórico Recente</h3>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--layout-text-muted)]" />
            <input 
              type="text"
              placeholder="Buscar cliente ou vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[var(--layout-bg)] text-sm text-white rounded-md pl-9 pr-3 py-2 border border-[var(--layout-border)] focus:border-[var(--layout-accent)] outline-none w-full sm:w-64"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--layout-bg)] text-[var(--layout-text-muted)]">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Data/Hora</th>
                <th className="py-3 px-4 text-left font-medium">Cliente</th>
                <th className="py-3 px-4 text-left font-medium">Vendedor</th>
                <th className="py-3 px-4 text-left font-medium">Pagamento</th>
                <th className="py-3 px-4 text-right font-medium">Total</th>
                <th className="py-3 px-4 text-right font-medium">Lucro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--layout-border)]">
              {paginatedHistory.length === 0 ? (
                <tr><td colSpan="6" className="py-8 text-center text-[var(--layout-text-muted)]">Nenhuma venda encontrada</td></tr>
              ) : (
                paginatedHistory.map((venda) => (
                  <tr key={venda.id} className="hover:bg-[var(--layout-bg)]/60 transition-colors">
                    <td className="py-3 px-4 text-[var(--layout-text-muted)]">
                      {new Date(venda.data_hora || venda.data_criacao).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-white font-medium">{venda.cliente_nome}</td>
                    <td className="py-3 px-4 text-[var(--layout-text-muted)]">{venda.vendedor_nome}</td>
                    <td className="py-3 px-4 text-[var(--layout-text-muted)] capitalize">{venda.forma_pagamento}</td>
                    <td className="py-3 px-4 text-right text-[var(--layout-accent)] font-bold">
                      R$ {Number(venda.total).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-400">
                      R$ {venda.lucro.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-[var(--layout-border)] flex justify-center gap-2">
             <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded bg-[var(--layout-bg)] text-[var(--layout-text-muted)] disabled:opacity-50 hover:bg-[var(--layout-surface-2)]"
            >
              Anterior
            </button>
            <span className="text-[var(--layout-text-muted)] py-1">Página {page} de {totalPages}</span>
            <button 
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded bg-[var(--layout-bg)] text-[var(--layout-text-muted)] disabled:opacity-50 hover:bg-[var(--layout-surface-2)]"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RelatorioTabelas;
