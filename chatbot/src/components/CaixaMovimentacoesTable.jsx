import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUpCircle, ArrowDownCircle, MinusCircle, DollarSign, Calendar } from 'lucide-react';

const CaixaMovimentacoesTable = ({ movimentacoes = [] }) => {
  const sortedMovimentacoes = [...movimentacoes].sort((a, b) => 
    new Date(b.data_movimentacao) - new Date(a.data_movimentacao)
  );

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (sortedMovimentacoes.length === 0) {
    return (
      <div className="p-8 text-center bg-[var(--layout-bg)] rounded-lg border border-[var(--layout-border)]">
        <div className="inline-flex items-center justify-center p-4 bg-[var(--layout-surface-2)] rounded-full mb-3">
          <Calendar className="w-6 h-6 text-[var(--layout-text-muted)]" />
        </div>
        <p className="text-[var(--layout-text-muted)]">Nenhuma movimentação registrada.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--layout-border)] shadow-xl bg-[var(--layout-bg)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--layout-surface-2)] text-xs uppercase text-[var(--layout-text-muted)] font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4 text-left">Data/Hora</th>
              <th className="px-6 py-4 text-left">Tipo</th>
              <th className="px-6 py-4 text-left">Descrição</th>
              <th className="px-6 py-4 text-right">Valor</th>
              <th className="px-6 py-4 text-right">Saldo Anterior</th>
              <th className="px-6 py-4 text-right">Saldo Novo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sortedMovimentacoes.map((mov) => {
              let typeConfig = {
                valueColor: 'text-[var(--layout-text-muted)]',
                badgeClass: 'bg-[var(--layout-border)] text-white',
                icon: null,
                sign: ''
              };

              switch (mov.tipo) {
                case 'suprimento':
                  typeConfig = {
                    valueColor: 'text-[var(--layout-accent)]',
                    badgeClass: 'bg-[var(--layout-accent)] text-[var(--layout-bg)]',
                    icon: <ArrowUpCircle className="w-4 h-4" />,
                    sign: '+'
                  };
                  break;
                case 'retirada':
                  typeConfig = {
                    valueColor: 'text-[#EF4444]',
                    badgeClass: 'bg-[#EF4444] text-white',
                    icon: <ArrowDownCircle className="w-4 h-4" />,
                    sign: '-'
                  };
                  break;
                case 'venda':
                  typeConfig = {
                    valueColor: 'text-[#3B82F6]',
                    badgeClass: 'bg-[#3B82F6] text-white',
                    icon: <DollarSign className="w-4 h-4" />,
                    sign: '+'
                  };
                  break;
                default:
                  typeConfig = {
                    valueColor: 'text-[var(--layout-text-muted)]',
                    badgeClass: 'bg-[var(--layout-border)] text-white',
                    icon: <MinusCircle className="w-4 h-4" />,
                    sign: ''
                  };
              }

              return (
                <tr key={mov.id} className="hover:bg-white/5 transition-colors odd:bg-[var(--layout-surface-2)]/60 even:bg-[var(--layout-bg)]">
                  <td className="px-6 py-4 text-[var(--layout-text-muted)] font-mono whitespace-nowrap">
                    {format(new Date(mov.data_movimentacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 font-bold uppercase text-xs px-2.5 py-1 rounded-full ${typeConfig.badgeClass}`}>
                      {typeConfig.icon}
                      {mov.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[var(--layout-text-muted)] max-w-xs truncate" title={mov.descricao}>
                    {mov.descricao || '-'}
                  </td>
                  <td className={`px-6 py-4 text-right font-mono font-bold ${typeConfig.valueColor}`}>
                    {typeConfig.sign} {formatCurrency(mov.valor)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-[var(--layout-text-muted)]">
                    {formatCurrency(mov.saldo_anterior)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-white font-bold">
                    {formatCurrency(mov.saldo_novo)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CaixaMovimentacoesTable;
