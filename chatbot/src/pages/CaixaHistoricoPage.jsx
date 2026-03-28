import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Calendar, Filter, Lock, RefreshCw, Unlock, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import AdminPasswordModal from '@/components/AdminPasswordModal';

const CaixaHistoricoPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const totalAberturas = movimentacoes.filter((m) => m.tipo === 'abertura').length;
  const totalFechamentos = movimentacoes.filter((m) => m.tipo === 'fechamento').length;
  const somaSaldoInicial = movimentacoes.reduce((sum, m) => sum + (Number(m.saldo_inicial) || 0), 0);
  const somaSaldoFinal = movimentacoes.reduce((sum, m) => sum + (m.saldo_final == null ? 0 : Number(m.saldo_final) || 0), 0);

  const fetchCaixaMovimentacoes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('caixa_movimentacoes')
        .select('id, tipo, saldo_inicial, saldo_final, observacoes, data_hora, funcionario:funcionarios(nome)')
        .eq('user_id', user.id)
        .gte('data_hora', start.toISOString())
        .lte('data_hora', end.toISOString())
        .order('data_hora', { ascending: false });

      if (error) throw error;
      setMovimentacoes(data || []);
    } catch (err) {
      console.error('Erro ao carregar movimentaÃ§Ãµes do caixa:', err);
    } finally {
      setLoading(false);
    }
  };

  const requestDelete = (mov) => {
    const isCurrentOpen =
      mov.tipo === 'abertura' &&
      movimentacoes.length > 0 &&
      movimentacoes[0]?.tipo === 'abertura' &&
      movimentacoes[0]?.id === mov.id;

    if (isCurrentOpen) {
      toast({
        title: 'AÃ§Ã£o nÃ£o permitida',
        description: 'Feche o caixa antes de apagar a Ãºltima abertura.',
        variant: 'destructive'
      });
      return;
    }

    if (!window.confirm(`Deseja realmente excluir ${mov.tipo}? Esta aÃ§Ã£o Ã© irreversÃ­vel.`)) {
      return;
    }

    setPendingDelete(mov);
    setPasswordModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete || !user) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('caixa_movimentacoes')
        .delete()
        .eq('id', pendingDelete.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'MovimentaÃ§Ã£o excluÃ­da',
        className: 'bg-[#EF4444] text-white border-none'
      });

      setPendingDelete(null);
      await fetchCaixaMovimentacoes();
    } catch (err) {
      console.error('Erro ao excluir movimentaÃ§Ãµes do caixa:', err);
      toast({
        title: 'Erro ao excluir',
        description: err.message || 'NÃ£o foi possÃ­vel excluir a movimentaÃ§Ã£o.',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchCaixaMovimentacoes();
  }, [user]);

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[var(--layout-bg)] animate-in fade-in duration-500">
      <Helmet>
        <title>Caixa - FORTIN ERP PRO</title>
      </Helmet>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Caixa</h1>
          <p className="text-[var(--layout-text-muted)]">Aberturas e fechamentos do caixa</p>
        </div>
        <Button
          onClick={fetchCaixaMovimentacoes}
          className="bg-[var(--layout-surface-2)] hover:bg-[var(--layout-border)] text-white border border-[var(--layout-border)] w-full md:w-auto"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)] mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">PerÃ­odo</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-2 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-2 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
              />
            </div>
          </div>
          <div className="md:col-span-1 flex flex-col sm:flex-row gap-2">
            <Button
              onClick={fetchCaixaMovimentacoes}
              disabled={loading}
              className="flex-1 bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white font-bold"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4 mr-2" />}
              FILTRAR
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Aberturas</span>
          <div className="text-2xl font-bold text-white mt-1">{totalAberturas}</div>
        </div>
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Fechamentos</span>
          <div className="text-2xl font-bold text-white mt-1">{totalFechamentos}</div>
        </div>
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Saldo Inicial (Soma)</span>
          <div className="text-2xl font-bold text-[var(--layout-accent)] mt-1">{formatCurrency(somaSaldoInicial)}</div>
        </div>
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Saldo Final (Soma)</span>
          <div className="text-2xl font-bold text-blue-400 mt-1">{formatCurrency(somaSaldoFinal)}</div>
        </div>
      </div>

      {movimentacoes.length === 0 ? (
        <div className="p-8 text-center bg-[var(--layout-bg)] rounded-lg border border-[var(--layout-border)]">
          <div className="inline-flex items-center justify-center p-4 bg-[var(--layout-surface-2)] rounded-full mb-3">
            <Calendar className="w-6 h-6 text-[var(--layout-text-muted)]" />
          </div>
          <p className="text-[var(--layout-text-muted)]">Nenhuma abertura ou fechamento encontrado.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--layout-border)] shadow-xl bg-[var(--layout-bg)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[var(--layout-surface-2)] text-xs uppercase text-[var(--layout-text-muted)] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left">Data/Hora</th>
                  <th className="px-6 py-4 text-left">Tipo</th>
                  <th className="px-6 py-4 text-left">FuncionÃ¡rio</th>
                  <th className="px-6 py-4 text-right">Saldo Inicial</th>
                  <th className="px-6 py-4 text-right">Saldo Final</th>
                  <th className="px-6 py-4 text-left">ObservaÃ§Ãµes</th>
                  <th className="px-6 py-4 text-center">AÃ§Ãµes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {movimentacoes.map((mov) => {
                  const isOpen = mov.tipo === 'abertura';
                  const typeColor = isOpen ? 'text-[var(--layout-accent)]' : 'text-[#EF4444]';
                  const typeBg = isOpen ? 'bg-[var(--layout-accent)]/10' : 'bg-[#EF4444]/10';
                  const Icon = isOpen ? Unlock : Lock;

                  return (
                    <tr key={mov.id} className="hover:bg-white/5 transition-colors odd:bg-[var(--layout-surface-2)]/60 even:bg-[var(--layout-bg)]">
                      <td className="px-6 py-4 text-[var(--layout-text-muted)] font-mono whitespace-nowrap">
                        {mov.data_hora ? format(new Date(mov.data_hora), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 font-bold uppercase text-xs px-2.5 py-1 rounded-full ${typeBg} ${typeColor}`}>
                          <Icon className="w-4 h-4" />
                          {mov.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--layout-text-muted)]">
                        {mov.funcionario?.nome || '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[var(--layout-text-muted)]">
                        {formatCurrency(mov.saldo_inicial)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-white font-bold">
                        {mov.saldo_final == null ? '-' : formatCurrency(mov.saldo_final)}
                      </td>
                      <td className="px-6 py-4 text-[var(--layout-text-muted)] max-w-xs truncate" title={mov.observacoes}>
                        {mov.observacoes || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => requestDelete(mov)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          title={`Excluir ${mov.tipo}`}
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdminPasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        actionType="cancel"
        actionLabel={pendingDelete ? `Excluir ${pendingDelete.tipo}` : 'Excluir movimentaÃ§Ã£o'}
      />
    </div>
  );
};

export default CaixaHistoricoPage;

