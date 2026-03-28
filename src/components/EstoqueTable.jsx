import React from 'react';

const EstoqueTable = ({ produtos }) => {
  const getStatusStyles = (produto) => {
    const qtd = parseFloat(produto.quantidadeEstoque) || 0;
    const minimo = parseFloat(produto.estoqueMinimo) || 0;

    if (qtd <= 0) return {
      badge: 'bg-[#EF4444] text-white',
      text: 'ZERADO'
    };
    if (qtd < minimo) return {
      badge: 'bg-[#FFA500] text-[#1a2332]',
      text: 'BAIXO'
    };
    return {
      badge: 'bg-[#00d084] text-[#1a2332]',
      text: 'OK'
    };
  };

  return (
    <div className="bg-[#1a2332] rounded-lg overflow-hidden shadow-xl border border-gray-700">
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="bg-[#1a2332] border-b border-gray-700">
              <th className="py-4 px-6 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">CÓDIGO</th>
              <th className="py-4 px-6 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">DESCRIÇÃO</th>
              <th className="py-4 px-6 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">CATEGORIA</th>
              <th className="py-4 px-6 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">UNID.</th>
              <th className="py-4 px-6 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">ESTOQUE</th>
              <th className="py-4 px-6 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">MÍNIMO</th>
              <th className="py-4 px-6 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">UNIDADE VALOR.</th>
              <th className="py-4 px-6 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">VALOR TOTAL</th>
              <th className="py-4 px-6 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {produtos.map((produto) => {
               const qtd = parseFloat(produto.quantidadeEstoque) || 0;
               const valor = parseFloat(produto.valorVenda) || 0;
               const total = qtd * valor;
               const status = getStatusStyles(produto);
               
               return (
                <tr key={produto.id} className="hover:bg-[#2a3a4a]/50 transition-colors duration-150">
                  <td className="py-4 px-6 text-sm text-gray-400 font-mono">{produto.codigo}</td>
                  <td className="py-4 px-6 text-sm text-white font-medium">{produto.descricao}</td>
                  <td className="py-4 px-6 text-sm text-gray-400">{produto.categoria}</td>
                  <td className="py-4 px-6 text-sm text-gray-400 text-center">{produto.unidade}</td>
                  <td className="py-4 px-6 text-sm font-bold text-center text-[#00d084]">
                    {qtd}
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-500 text-center">{produto.estoqueMinimo}</td>
                  <td className="py-4 px-6 text-sm text-white text-right">
                    R$ {valor.toFixed(2)}
                  </td>
                  <td className="py-4 px-6 text-sm text-white text-right font-medium">
                    R$ {total.toFixed(2)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${status.badge}`}>
                      {status.text}
                    </span>
                  </td>
                </tr>
               );
            })}
            {produtos.length === 0 && (
              <tr>
                <td colSpan="9" className="py-12 text-center text-gray-500 bg-[#1a2332]">
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-lg font-medium">Nenhum produto encontrado</p>
                    <p className="text-sm">Tente ajustar seus filtros de busca</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EstoqueTable;