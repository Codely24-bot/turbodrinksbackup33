import React, { useState } from 'react';
import { Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const FuncionariosTable = ({ funcionarios, onEdit, onDelete }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(funcionarios.length / itemsPerPage);
  const currentData = funcionarios.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="bg-[var(--layout-bg)] rounded-lg border border-[var(--layout-border)] overflow-hidden flex flex-col h-full shadow-xl">
      <div className="overflow-auto flex-1 custom-scrollbar">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[var(--layout-surface-2)] sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider">Nome</th>
              <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider">Email</th>
              <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider">Telefone</th>
              <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider">Cargo</th>
              <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider">Admissão</th>
              <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider">Status</th>
              <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--layout-border)]">
            {currentData.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-[var(--layout-text-muted)]">
                  Nenhum funcionário encontrado.
                </td>
              </tr>
            ) : (
              currentData.map((func) => (
                <tr key={func.id} className="hover:bg-[var(--layout-surface-2)]/30 transition-colors">
                  <td className="py-4 px-4 text-white font-medium text-sm">{func.nome}</td>
                  <td className="py-4 px-4 text-[var(--layout-text-muted)] text-sm">{func.email}</td>
                  <td className="py-4 px-4 text-[var(--layout-text-muted)] text-sm">{func.telefone || '-'}</td>
                  <td className="py-4 px-4 text-[var(--layout-text-muted)] text-sm">{func.cargo}</td>
                  <td className="py-4 px-4 text-[var(--layout-text-muted)] text-sm">
                    {func.data_admissao ? format(new Date(func.data_admissao), 'dd/MM/yyyy') : '-'}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      func.status === 'ativo' 
                        ? 'bg-[var(--layout-accent)]/10 text-[var(--layout-accent)]' 
                        : 'bg-gray-500/10 text-[var(--layout-text-muted)]'
                    }`}>
                      {func.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center flex justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                      onClick={() => onEdit(func)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      onClick={() => onDelete(func)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:text-white hover:bg-[var(--layout-border)]"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FuncionariosTable;
