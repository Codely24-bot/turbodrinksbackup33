import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle, Database } from 'lucide-react';

const DiagnosticPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const runDiagnostics = async () => {
    setLoading(true);
    const results = {
      user: null,
      vendasFiado: [],
      contasReceber: [],
      orphans: [],
      errors: []
    };

    try {
      if (!user) throw new Error("User not authenticated");
      results.user = { id: user.id, email: user.email };

      // 1. Fetch Vendas Fiado
      const { data: vendas, error: vError } = await supabase
        .from('vendas')
        .select('*')
        .eq('user_id', user.id)
        .eq('forma_pagamento', 'fiado')
        .order('data_criacao', { ascending: false })
        .limit(10);
      
      if (vError) results.errors.push(`Vendas Error: ${vError.message}`);
      results.vendasFiado = vendas || [];

      // 2. Fetch Contas Receber
      const { data: contas, error: cError } = await supabase
        .from('contas_receber')
        .select('*, cliente:pessoas(nome)')
        .eq('user_id', user.id)
        .limit(10);

      if (cError) results.errors.push(`Contas Error: ${cError.message}`);
      results.contasReceber = contas || [];

      // 3. Find Orphans (Vendas 'fiado' without contas_receber)
      if (vendas?.length > 0) {
        const vendaIds = vendas.map(v => v.id);
        const { data: linkedContas } = await supabase
          .from('contas_receber')
          .select('venda_id')
          .in('venda_id', vendaIds);
        
        const linkedVendaIds = linkedContas?.map(c => c.venda_id) || [];
        results.orphans = vendas.filter(v => !linkedVendaIds.includes(v.id));
      }

    } catch (err) {
      results.errors.push(`Critical: ${err.message}`);
    } finally {
      setReport(results);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) runDiagnostics();
  }, [user]);

  if (!user) return <div className="p-10 text-white">Please log in to run diagnostics.</div>;

  return (
    <div className="p-8 space-y-6 bg-[var(--layout-bg)] min-h-screen text-gray-200">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
          <Database className="text-blue-400" /> System Diagnostic
        </h1>
        <Button onClick={runDiagnostics} disabled={loading} className="bg-blue-600">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Run Check
        </Button>
      </div>

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vendas Report */}
          <div className="bg-[var(--layout-surface-2)] p-4 rounded-xl border border-[var(--layout-border)]">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span className="text-orange-400">Vendas (Fiado)</span>
              <span className="text-xs bg-gray-700 px-2 py-1 rounded">{report.vendasFiado.length} found</span>
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-xs">
              {report.vendasFiado.length === 0 ? (
                <p className="text-[var(--layout-text-muted)]">No 'fiado' sales found in 'vendas' table.</p>
              ) : (
                report.vendasFiado.map(v => (
                  <div key={v.id} className="p-2 bg-[var(--layout-bg)] rounded flex justify-between">
                    <span>#{v.numero_venda}</span>
                    <span>R$ {v.total}</span>
                    <span>{new Date(v.data_criacao).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Contas Report */}
          <div className="bg-[var(--layout-surface-2)] p-4 rounded-xl border border-[var(--layout-border)]">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span className="text-[var(--layout-accent)]">Contas a Receber</span>
              <span className="text-xs bg-gray-700 px-2 py-1 rounded">{report.contasReceber.length} found</span>
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-xs">
              {report.contasReceber.length === 0 ? (
                <p className="text-[var(--layout-text-muted)]">No entries in 'contas_receber'.</p>
              ) : (
                report.contasReceber.map(c => (
                  <div key={c.id} className="p-2 bg-[var(--layout-bg)] rounded flex justify-between">
                    <span>{c.cliente?.nome || 'Unknown'}</span>
                    <span>R$ {c.valor}</span>
                    <span className={c.status === 'pago' ? 'text-green-400' : 'text-yellow-400'}>{c.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Issues Report */}
          <div className="col-span-1 md:col-span-2 bg-[var(--layout-surface-2)] p-4 rounded-xl border border-[var(--layout-border)]">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              Issues & Integrity
            </h2>
            {report.errors.length === 0 && report.orphans.length === 0 ? (
              <div className="flex items-center gap-2 text-green-400 p-4 bg-green-400/10 rounded-lg">
                <CheckCircle /> System looks healthy. No data integrity issues found.
              </div>
            ) : (
              <div className="space-y-4">
                {report.orphans.length > 0 && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <h3 className="text-red-400 font-bold flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4" /> 
                      {report.orphans.length} Orphaned Sales Found
                    </h3>
                    <p className="text-sm text-[var(--layout-text-muted)] mb-2">
                      The following sales are marked as 'fiado' but have NO corresponding entry in the 'contas_receber' table.
                      This means they won't show up on the Accounts Receivable page.
                    </p>
                    <div className="max-h-32 overflow-y-auto bg-black/30 p-2 rounded text-xs font-mono">
                      {report.orphans.map(o => (
                        <div key={o.id}>Sale #{o.numero_venda} (ID: {o.id})</div>
                      ))}
                    </div>
                  </div>
                )}
                {report.errors.map((e, i) => (
                  <div key={i} className="text-red-400 bg-red-900/20 p-2 rounded text-sm">{e}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticPage;
