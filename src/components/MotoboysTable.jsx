import React, { useState } from 'react';
import { Edit, Trash2, ChevronLeft, ChevronRight, Bike } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MotoboysTable = ({ motoboys, onEdit, onDelete }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(motoboys.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMotoboys = motoboys.slice(startIndex, startIndex + itemsPerPage);

  const formatPhone = (phone) => {
    if (!phone) return '-';
    // Simple formatter if not strictly enforced in DB
    return phone; 
  };

  return (
    <div className="bg-[var(--layout-bg)] rounded-lg shadow-lg border border-[var(--layout-border)] flex flex-col h-full">
      <div className="overflow-x-auto custom-scrollbar flex-1">
        <table className="w-full min-w-[900px] text-left border-collapse">
          <thead className="bg-[var(--layout-surface-2)] sticky top-0 z-10">
            <tr>
              <th className="p-4 text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider border-b border-[var(--layout-border)]">Nome / CPF</th>
              <th className="p-4 text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider border-b border-[var(--layout-border)]">Contato</th>
              <th className="p-4 text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider border-b border-[var(--layout-border)]">Veículo / Placa</th>
              <th className="p-4 text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider border-b border-[var(--layout-border)] text-center">Comissão</th>
              <th className="p-4 text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider border-b border-[var(--layout-border)] text-center">Status</th>
              <th className="p-4 text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider border-b border-[var(--layout-border)] text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--layout-border)]">
            {paginatedMotoboys.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-[var(--layout-text-muted)]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Bike className="w-8 h-8 opacity-20" />
                    <p>Nenhum motoboy encontrado</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedMotoboys.map((moto) => (
                <tr 
                  key={moto.id} 
                  className="hover:bg-[var(--layout-surface-2)] transition-colors group"
                >
                  <td className="p-4">
                    <div className="font-medium text-white">{moto.nome}</div>
                    <div className="text-xs text-[var(--layout-text-muted)] font-mono">{moto.cpf}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-[var(--layout-text-muted)]">{formatPhone(moto.telefone)}</div>
                    {moto.email && <div className="text-xs text-[var(--layout-text-muted)]">{moto.email}</div>}
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-[var(--layout-text-muted)] flex items-center gap-1">
                      <Bike className="w-3 h-3 text-[var(--layout-accent)]" />
                      {moto.veiculo}
                    </div>
                    <div className="text-xs text-[var(--layout-text-muted)] font-mono uppercase bg-black/20 px-1 rounded inline-block mt-1 border border-[var(--layout-border)]">
                      {moto.placa}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="text-sm text-[var(--layout-accent)] font-bold">{moto.comissao_percentual}%</div>
                    {moto.comissao_fixa > 0 && (
                      <div className="text-xs text-[var(--layout-text-muted)]">
                        + R$ {Number(moto.comissao_fixa).toFixed(2)}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      moto.status === 'ativo' 
                        ? 'bg-[var(--layout-accent)]/20 text-[var(--layout-accent)] border border-[var(--layout-accent)]/30' 
                        : 'bg-[var(--layout-border)] text-[var(--layout-text-muted)] border border-[var(--layout-border)]'
                    }`}>
                      {moto.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(moto)}
                        className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(moto)}
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-[var(--layout-border)] flex items-center justify-between bg-[var(--layout-surface-2)] rounded-b-lg">
          <span className="text-xs text-[var(--layout-text-muted)]">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0 border-[var(--layout-border)] bg-transparent text-[var(--layout-text-muted)] hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0 border-[var(--layout-border)] bg-transparent text-[var(--layout-text-muted)] hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MotoboysTable;
