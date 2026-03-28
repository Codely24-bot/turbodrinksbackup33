import React, { useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const ComboInsumoTable = ({ insumos, onRemove }) => {
  const { toast } = useToast();
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  const handleRemove = (id) => {
    if (confirmRemoveId === id) {
      onRemove(id);
      setConfirmRemoveId(null);
      toast({
        title: "Insumo removido",
        className: "bg-red-500 text-white border-none"
      });
    } else {
      setConfirmRemoveId(id);
      setTimeout(() => setConfirmRemoveId(null), 3000);
    }
  };

  if (!insumos || insumos.length === 0) {
    return (
      <div className="text-center p-6 bg-[#2d3e52] rounded-lg border border-gray-600 border-dashed">
        <p className="text-gray-400">Nenhum insumo adicionado a este combo.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#2d3e52] text-gray-300 uppercase font-medium">
          <tr>
            <th className="px-4 py-3">Produto</th>
            <th className="px-4 py-3 text-center">Qtd.</th>
            <th className="px-4 py-3 text-center">Unidade</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700 bg-[#1a2332]">
          {insumos.map((insumo, index) => (
            <tr key={insumo.id || index} className="hover:bg-[#2a3a4a] transition-colors">
              <td className="px-4 py-3 text-white font-medium">
                {insumo.produto?.descricao || insumo.nomeProduto || 'Produto Desconhecido'}
              </td>
              <td className="px-4 py-3 text-center text-white">
                {insumo.quantidade}
              </td>
              <td className="px-4 py-3 text-center text-gray-400">
                {insumo.unidade_medida}
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemove(insumo.insumo_id)}
                  className={`
                    h-8 px-2 
                    ${confirmRemoveId === insumo.insumo_id 
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                    }
                  `}
                >
                  {confirmRemoveId === insumo.insumo_id ? 'Confirmar?' : <Trash2 className="w-4 h-4" />}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComboInsumoTable;