import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export const useRelatorioDashboard = (startDate, endDate) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vendas, setVendas] = useState([]);
  const [itens, setItens] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Adjust date range for query (start of day to end of day)
      const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date(0);
      const end = endDate ? new Date(`${endDate}T23:59:59`) : new Date();
      const startIso = start.toISOString();
      const endIso = end.toISOString();

      // Fetch Vendas
      let vendasQuery = supabase
        .from('vendas')
        .select(`
          *,
          cliente:cliente_id (nome),
          vendedor:vendedor_id (nome)
        `)
        .eq('user_id', user.id)
        .eq('status', 'concluido');

      vendasQuery = vendasQuery.or(`and(data_criacao.gte.${startIso},data_criacao.lte.${endIso}),and(data_hora.gte.${startIso},data_hora.lte.${endIso})`);

      const { data: vendasData, error: vendasError } = await vendasQuery
        .order('data_hora', { ascending: false });

      if (vendasError) throw vendasError;

      // Fetch Itens related to these vendas
      const vendaIds = vendasData.map(v => v.id);
      let itensData = [];
      
      if (vendaIds.length > 0) {
        const { data, error: itensError } = await supabase
          .from('itens_venda')
          .select(`
            *,
            produto:produto_id (codigo, descricao, categoria)
          `)
          .eq('user_id', user.id)
          .in('venda_id', vendaIds);
          
        if (itensError) throw itensError;
        itensData = data;
      }

      // Fetch all products for reference (needed for stock/general analysis)
      const { data: produtosData, error: produtosError } = await supabase
        .from('produtos')
        .select('*')
        .eq('user_id', user.id);

      if (produtosError) throw produtosError;

      setVendas(vendasData);
      setItens(itensData);
      setProdutos(produtosData);
    } catch (err) {
      console.error("Error fetching report data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived Metrics
  const metrics = useMemo(() => {
    const totalVendas = vendas.length;
    const valorBruto = vendas.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    
    // Calculate total cost from items
    const totalCusto = itens.reduce((acc, curr) => {
      return acc + ((Number(curr.valor_custo) || 0) * (Number(curr.quantidade) || 0));
    }, 0);

    const lucroTotal = valorBruto - totalCusto;
    const ticketMedio = totalVendas > 0 ? valorBruto / totalVendas : 0;

    // Top/Bottom Products Analysis
    const productStats = {};
    itens.forEach(item => {
      const prodId = item.produto_id;
      if (!productStats[prodId]) {
        productStats[prodId] = {
          id: prodId,
          codigo: item.produto?.codigo || 'N/A',
          descricao: item.produto?.descricao || 'Produto Removido',
          quantidade: 0,
          valorTotal: 0,
          custoTotal: 0
        };
      }
      productStats[prodId].quantidade += Number(item.quantidade) || 0;
      productStats[prodId].valorTotal += Number(item.total) || 0;
      productStats[prodId].custoTotal += (Number(item.valor_custo) || 0) * (Number(item.quantidade) || 0);
    });

    const sortedProducts = Object.values(productStats).map(p => ({
      ...p,
      lucro: p.valorTotal - p.custoTotal
    }));

    const maisVendidos = [...sortedProducts].sort((a, b) => b.quantidade - a.quantidade).slice(0, 5);
    const menosVendidos = [...sortedProducts].sort((a, b) => a.quantidade - b.quantidade).slice(0, 5);

    // Sales History with Profit
    const historicoVendas = vendas.slice(0, 10).map(venda => {
      const vendaItens = itens.filter(i => i.venda_id === venda.id);
      const custoVenda = vendaItens.reduce((acc, i) => acc + ((Number(i.valor_custo) || 0) * (Number(i.quantidade) || 0)), 0);
      return {
        ...venda,
        data_hora: venda.data_hora || venda.data_criacao,
        lucro: (Number(venda.total) || 0) - custoVenda,
        cliente_nome: venda.cliente?.nome || 'Consumidor Final',
        vendedor_nome: venda.vendedor?.nome || 'N/A'
      };
    });

    return {
      totalVendas,
      valorBruto,
      lucroTotal,
      ticketMedio,
      maisVendidos,
      menosVendidos,
      historicoVendas
    };
  }, [vendas, itens]);

  return {
    loading,
    error,
    refresh: fetchData,
    ...metrics,
    vendasRaw: vendas // Exporting raw data for charts
  };
};
