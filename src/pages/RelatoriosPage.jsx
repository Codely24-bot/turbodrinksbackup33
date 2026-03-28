import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { startOfMonth, endOfMonth, format } from 'date-fns';

// Hooks
import { useRelatorioDashboard } from '@/hooks/useRelatorioDashboard';
import { useRealtimeReports } from '@/hooks/useRealtimeReports';
import { useGraficosRelatorios } from '@/hooks/useGraficosRelatorios';

// Components
import RelatorioFiltros from '@/components/relatorios/RelatorioFiltros';
import RelatorioCards from '@/components/relatorios/RelatorioCards';
import RelatorioTabelas from '@/components/relatorios/RelatorioTabelas';
import RelatorioGraficos from '@/components/relatorios/RelatorioGraficos';

const RelatoriosPage = () => {
  const { toast } = useToast();
  
  // Date State
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  // Data Hook
  const { 
    loading, 
    error, 
    refresh, 
    totalVendas, 
    valorBruto, 
    lucroTotal, 
    ticketMedio, 
    maisVendidos, 
    menosVendidos, 
    historicoVendas,
    vendasRaw
  } = useRelatorioDashboard(startDate, endDate);

  // Realtime Hook
  useRealtimeReports({
    onVendasChange: () => {
      refresh();
      toast({
        title: 'Atualização em tempo real',
        description: 'Novas vendas detectadas. Relatórios atualizados.',
        className: 'bg-[var(--layout-accent)] text-white border-none'
      });
    },
    onItensChange: refresh,
    onProdutosChange: refresh
  });

  // Derived Chart Data (using a separate hook for clarity, but could be inside component)
  // We need 'itens' raw data here ideally, but for now `vendasRaw` is main source. 
  // The hook useRelatorioDashboard internally fetches itens but only exposes aggregates.
  // To make charts work 100% perfectly with cost data, we ideally need raw items too.
  // I updated useRelatorioDashboard to expose vendasRaw. For item costs in charts, 
  // we might need to expose raw items or do the heavy lifting in useRelatorioDashboard.
  // Let's rely on what useRelatorioDashboard provides for now or update it.
  // Actually, useRelatorioDashboard returns `historicoVendas` which has profit per sale calculated.
  // For `useGraficosRelatorios`, we'll need item level data for exact cost sums if we want perfection.
  // I will update the useGraficosRelatorios hook signature to accept `historicoVendas` which already has profit data calculated per sale.
  
  // Re-deriving cost data from historicoVendas for charts might be incomplete if historico is sliced.
  // The `vendasRaw` is full list. But we don't have cost per venda in `vendasRaw` (it's in items).
  // Let's simplify: Pass `vendasRaw` to chart hook, but we need cost.
  // To avoid complexity, I'll update `useRelatorioDashboard` to expose `metrics` including totals used for charts.
  // Actually, `lucroTotal` and `valorBruto` are already calculated.
  // For the bar chart "Lucro vs Custo", we can use `lucroTotal` and `valorBruto - lucroTotal`.
  // For daily sales, we use `vendasRaw`.
  // For payment methods, we use `vendasRaw`.
  
  const chartData = useGraficosRelatorios(vendasRaw, []); 
  // Note: passing empty array for items because I am calculating total Profit/Cost inside the hook 
  // using totals passed from Dashboard hook would be cleaner, but the hook logic I wrote earlier expects raw items.
  // Let's do a quick fix: Use the totals we already have from `useRelatorioDashboard` to override the "Lucro vs Custo" chart data.
  
  const finalChartData = {
    ...chartData,
    lucroVsCusto: [
      { name: 'Custo', value: valorBruto - lucroTotal },
      { name: 'Lucro', value: lucroTotal }
    ]
  };

  const handleReset = () => {
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  };

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[var(--layout-bg)] animate-in fade-in duration-500">
      <Helmet>
        <title>Relatórios - PDV System</title>
        <meta name="description" content="Dashboard de relatórios e análises" />
      </Helmet>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Relatórios Gerenciais</h1>
        <p className="text-[var(--layout-text-muted)]">Análise de desempenho em tempo real</p>
      </div>

      <RelatorioFiltros 
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onFilter={refresh}
        onReset={handleReset}
        loading={loading}
      />

      <RelatorioCards 
        totalVendas={totalVendas}
        valorBruto={valorBruto}
        lucroTotal={lucroTotal}
        ticketMedio={ticketMedio}
        loading={loading}
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-6 text-red-400">
          Erro ao carregar dados: {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RelatorioTabelas 
          maisVendidos={maisVendidos} 
          menosVendidos={menosVendidos} 
          historicoVendas={historicoVendas} 
        />
        
        <RelatorioGraficos 
          vendasPorDia={finalChartData.vendasPorDia}
          formasPagamento={finalChartData.formasPagamento}
          lucroVsCusto={finalChartData.lucroVsCusto}
        />
      </div>
    </div>
  );
};

export default RelatoriosPage;
