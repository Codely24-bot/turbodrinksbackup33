import React, { useState, useEffect } from 'react';
import { 
  MoreVertical, CheckCircle, Edit, Trash2, ArrowUpDown, 
  Calendar, User, DollarSign, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';

const ContasAReceberTable = ({ 
  data = [], 
  loading = false, 
  onMarkAsPaid, 
  onEdit, 
  onDelete 
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'asc' });

  // Debug logging
  useEffect(() => {
    if (data && data.length > 0) {
      console.log(`📊 ContasAReceberTable: Rendering ${data.length} rows.`);
    } else if (!loading) {
      console.log("📊 ContasAReceberTable: Received empty data array.");
    }
  }, [data, loading]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...(data || [])].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-[var(--layout-text-muted)] bg-[var(--layout-bg)] rounded-xl border border-[var(--layout-border)]">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--layout-accent)] mb-3" />
        <p>Carregando contas a receber...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-[var(--layout-text-muted)] border border-[var(--layout-border)] border-dashed rounded-xl bg-[var(--layout-bg)]/50">
        <AlertCircle className="w-12 h-12 mb-3 opacity-50 text-[var(--layout-text-muted)]" />
        <p className="font-medium text-[var(--layout-text-muted)]">Nenhuma conta encontrada</p>
        <p className="text-sm mt-1">Tente ajustar os filtros ou registre uma venda com pagamento "Fiado".</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto bg-[var(--layout-bg)] rounded-xl border border-[var(--layout-border)] shadow-xl">
      <table className="w-full min-w-[720px] text-left border-collapse">
        <thead className="bg-[var(--layout-surface-2)] text-[var(--layout-text-muted)] text-xs uppercase font-bold tracking-wider">
          <tr>
            <th className="p-4 cursor-pointer hover:bg-[var(--layout-border)] transition-colors" onClick={() => handleSort('data_vencimento')}>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Vencimento
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              </div>
            </th>
            <th className="p-4 cursor-pointer hover:bg-[var(--layout-border)] transition-colors" onClick={() => handleSort('cliente_id')}>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" /> Cliente
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              </div>
            </th>
            <th className="p-4 text-right cursor-pointer hover:bg-[var(--layout-border)] transition-colors" onClick={() => handleSort('valor')}>
              <div className="flex items-center justify-end gap-2">
                <DollarSign className="w-4 h-4" /> Valor
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              </div>
            </th>
            <th className="p-4 text-center">Status</th>
            <th className="p-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {sortedData.map((item) => {
             const isOverdue = item.status !== 'pago' && item.data_vencimento < new Date().toISOString().split('T')[0];
             
             return (
              <tr key={item.id} className="hover:bg-[var(--layout-surface-2)] transition-colors group">
                <td className="p-4 text-sm font-mono text-[var(--layout-text-muted)]">
                  {new Date(item.data_vencimento).toLocaleDateString('pt-BR')}
                  {item.venda && (
                    <div className="text-[10px] text-[var(--layout-text-muted)] mt-1 flex items-center gap-1">
                      <span className="opacity-75">#{item.venda.numero_venda}</span>
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <div className="font-medium text-white">{item.cliente?.nome || 'Cliente Desconhecido'}</div>
                  {item.cliente?.cpf && <div className="text-xs text-[var(--layout-text-muted)]">{item.cliente.cpf}</div>}
                </td>
                <td className="p-4 text-right font-bold text-[var(--layout-text-muted)]">
                  R$ {parseFloat(item.valor).toFixed(2)}
                </td>
                <td className="p-4 text-center">
                  {item.status === 'pago' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                      PAGO
                    </span>
                  ) : isOverdue ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse">
                      VENCIDO
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                      PENDENTE
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 text-[var(--layout-text-muted)] hover:text-white hover:bg-[var(--layout-border)]">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[var(--layout-bg)] border-[var(--layout-border)] text-[var(--layout-text-muted)]">
                      {item.status !== 'pago' && (
                        <DropdownMenuItem onClick={() => onMarkAsPaid(item)} className="cursor-pointer hover:bg-[var(--layout-surface-2)] focus:bg-[var(--layout-surface-2)] text-[var(--layout-accent)]">
                          <CheckCircle className="mr-2 h-4 w-4" /> Marcar como Pago
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onEdit(item)} className="cursor-pointer hover:bg-[var(--layout-surface-2)] focus:bg-[var(--layout-surface-2)]">
                        <Edit className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(item)} className="cursor-pointer hover:bg-[var(--layout-surface-2)] focus:bg-[var(--layout-surface-2)] text-red-400">
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ContasAReceberTable;
