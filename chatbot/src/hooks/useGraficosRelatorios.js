import { useMemo } from 'react';
import { format, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const useGraficosRelatorios = (vendas, itens) => {
  const chartData = useMemo(() => {
    if (!vendas || !vendas.length) {
      return {
        vendasPorDia: [],
        formasPagamento: [],
        lucroVsCusto: []
      };
    }

    // 1. Vendas por Dia
    const vendasPorDiaMap = {};
    vendas.forEach(venda => {
      const vendaDate = venda.data_hora || venda.data_criacao;
      if (!vendaDate) return;
      const dateKey = format(parseISO(vendaDate), 'dd/MM', { locale: ptBR });
      vendasPorDiaMap[dateKey] = (vendasPorDiaMap[dateKey] || 0) + (Number(venda.total) || 0);
    });

    // Convert to array and sort by date (simplified assuming input is already somewhat ordered or relying on string sort for dd/MM might be tricky across years, but for 30 days it's usually ok-ish. Better to sort by timestamp)
    // To do it properly: group by full date YYYY-MM-DD then format for display
    const vendasPorDiaRaw = {};
    vendas.forEach(venda => {
        const vendaDate = venda.data_hora || venda.data_criacao;
        if (!vendaDate) return;
        const fullDate = vendaDate.split('T')[0]; // YYYY-MM-DD
        vendasPorDiaRaw[fullDate] = (vendasPorDiaRaw[fullDate] || 0) + (Number(venda.total) || 0);
    });
    
    const vendasPorDia = Object.keys(vendasPorDiaRaw)
        .sort()
        .map(date => ({
            name: format(parseISO(date), 'dd/MM'),
            value: vendasPorDiaRaw[date]
        }));


    // 2. Formas de Pagamento
    const formasPagamentoMap = {};
    vendas.forEach(venda => {
      const forma = venda.forma_pagamento || 'Outros';
      formasPagamentoMap[forma] = (formasPagamentoMap[forma] || 0) + 1; // Count
    });

    const formasPagamento = Object.keys(formasPagamentoMap).map(key => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: formasPagamentoMap[key]
    }));

    // 3. Lucro vs Custo Total
    const totalVendas = vendas.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
    const totalCusto = itens.reduce((acc, i) => acc + ((Number(i.valor_custo) || 0) * (Number(i.quantidade) || 0)), 0);
    const totalLucro = totalVendas - totalCusto;

    const lucroVsCusto = [
      { name: 'Custo', value: totalCusto },
      { name: 'Lucro', value: totalLucro }
    ];

    return {
      vendasPorDia,
      formasPagamento,
      lucroVsCusto
    };
  }, [vendas, itens]);

  return chartData;
};
