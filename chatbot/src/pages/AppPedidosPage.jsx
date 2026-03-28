import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FolderSync,
  LayoutDashboard,
  Link2,
  MapPin,
  Package,
  Settings,
  ShoppingBag,
  Store,
  Users,
} from 'lucide-react';
import ModuleShell from '@/components/delivery/ModuleShell';
import MetricCard from '@/components/delivery/MetricCard';
import PanelCard from '@/components/delivery/PanelCard';
import { Button } from '@/components/ui/button';
import { useDeliveryHub } from '@/hooks/useDeliveryHub';

const buildStoreLink = (rawUrl, storeId) => {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed || !storeId) return '';
  if (trimmed.includes('{storeId}')) {
    return trimmed.replace('{storeId}', encodeURIComponent(storeId));
  }
  if (/[?&]store=/.test(trimmed)) {
    return trimmed;
  }
  const joiner = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${joiner}store=${encodeURIComponent(storeId)}`;
};

const AppPedidosPage = () => {
  const { user, snapshot, summaries, saveAppSettings } = useDeliveryHub();
  const appInfo = snapshot.settings?.appInfo || {};
  const [appUrlDraft, setAppUrlDraft] = useState(appInfo.appUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setAppUrlDraft(appInfo.appUrl || '');
  }, [appInfo.appUrl]);

  const handleOpenExternalApp = () => {
    const storeId = encodeURIComponent(user?.id || '');
    window.open(`/app/pedidos-cliente?store=${storeId}`, '_blank', 'noopener,noreferrer');
  };

  const connectedAppUrl = buildStoreLink(appInfo.appUrl, user?.id || '');
  const hasConnectedApp = Boolean(connectedAppUrl);

  const handleSaveAppUrl = async () => {
    const cleanedUrl = String(appUrlDraft || '').trim();
    if (!cleanedUrl || isSaving) return;
    setIsSaving(true);
    try {
      await saveAppSettings({ appUrl: cleanedUrl });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = async () => {
    if (!connectedAppUrl) return;
    try {
      await navigator.clipboard.writeText(connectedAppUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn('Nao foi possivel copiar o link:', error);
    }
  };

  const handleOpenConnectedApp = () => {
    if (hasConnectedApp) {
      window.open(connectedAppUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    handleOpenExternalApp();
  };

  return (
    <ModuleShell title="App de Pedidos" subtitle="Aplicativo externo para o cliente fazer pedidos e enviar para a loja.">
      <Helmet>
        <title>App de Pedidos - FORTIN ERP PRO</title>
      </Helmet>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Produtos publicados" value={summaries.metrics.produtosPublicados} />
        <MetricCard label="Clientes cadastrados" value={summaries.metrics.clientesCadastrados} />
        <MetricCard label="Bairros atendidos" value={summaries.metrics.bairrosAtendidos} />
        <MetricCard label="Pedidos recebidos" value={summaries.metrics.pedidosRecebidos} />
      </div>

      <PanelCard
        title="Conexao do aplicativo de clientes"
        subtitle="Salve o link online para abrir o app e manter as integracoes ativas."
        className="mt-6"
      >
        <div className="rounded-xl border border-[var(--layout-border)] bg-[var(--layout-surface-2)] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex-1">
              <label className="text-sm text-[var(--layout-text-muted)]">Link online do aplicativo</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-h-[44px] flex-1 items-center gap-2 rounded-xl border border-[var(--layout-border)] bg-[var(--layout-surface)] px-3">
                  <Link2 className="h-4 w-4 text-[var(--layout-accent)]" />
                  <input
                    value={appUrlDraft}
                    onChange={(event) => setAppUrlDraft(event.target.value)}
                    placeholder="https://seuapp.com"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[var(--layout-text-muted)]"
                  />
                </div>
                <Button
                  onClick={handleSaveAppUrl}
                  disabled={!appUrlDraft.trim() || isSaving}
                  className="bg-[var(--layout-accent)] text-white hover:bg-[var(--layout-accent-strong)]"
                >
                  {isSaving ? 'Salvando...' : 'Conectar'}
                </Button>
                <Button variant="outline" onClick={handleOpenConnectedApp}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir app
                </Button>
                <Button variant="outline" onClick={handleCopyLink} disabled={!connectedAppUrl}>
                  {copied ? 'Copiado!' : 'Copiar link'}
                </Button>
              </div>
              <div className="mt-3 flex flex-col gap-1 text-xs text-[var(--layout-text-muted)]">
                <span>ID da loja: <strong className="text-white">{user?.id || '-'}</strong></span>
                <span>Link completo: <strong className="text-white">{connectedAppUrl || 'Informe o link acima'}</strong></span>
                <span>Dica: use {'{storeId}'} no link para substituir automaticamente.</span>
              </div>
              <p className="mt-2 text-xs text-[var(--layout-text-muted)]">
                Use o link do app publicado para abrir, compartilhar e manter horario, produtos e painel de delivery sincronizados.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[var(--layout-border)] bg-[var(--layout-surface)] p-4">
              {hasConnectedApp ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
              <div>
                <div className="text-sm font-semibold text-white">
                  Status: {hasConnectedApp ? 'Conectado' : 'Sem link'}
                </div>
                <div className="text-xs text-[var(--layout-text-muted)]">
                  {hasConnectedApp
                    ? 'Link salvo e pronto para abrir o app online.'
                    : 'Informe o link do app para habilitar a conexao.'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
            <div className="flex items-center justify-between rounded-xl bg-[var(--layout-surface)] px-4 py-3 text-white">
              <span className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[var(--layout-accent)]" />
                Horario de funcionamento
              </span>
              <span className="font-semibold">{appInfo.horarioFuncionamento || 'Nao informado'}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--layout-surface)] px-4 py-3 text-white">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[var(--layout-accent)]" />
                Produtos integrados
              </span>
              <span className="font-semibold">{summaries.metrics.produtosPublicados}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--layout-surface)] px-4 py-3 text-white">
              <span className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-[var(--layout-accent)]" />
                Painel de delivery
              </span>
              <span className="font-semibold">{summaries.metrics.pedidosRecebidos} pedidos</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--layout-surface)] px-4 py-3 text-white">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--layout-accent)]" />
                Clientes integrados
              </span>
              <span className="font-semibold">{summaries.metrics.clientesCadastrados}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--layout-surface)] px-4 py-3 text-white">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--layout-accent)]" />
                Bairros de entrega
              </span>
              <span className="font-semibold">{summaries.metrics.bairrosAtendidos}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--layout-surface)] px-4 py-3 text-white">
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-[var(--layout-accent)]" />
                Configuracoes
              </span>
              <span className="font-semibold">{appInfo.nomeAplicativo || 'FORTIN Delivery'}</span>
            </div>
          </div>
        </div>
      </PanelCard>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <PanelCard title="Acesso ao aplicativo externo" subtitle="Página do app do cliente">
          <div className="rounded-xl border border-[var(--layout-border)] bg-[var(--layout-surface-2)] p-5">
            <div className="flex items-center gap-3 text-white">
              <Store className="h-6 w-6 text-[var(--layout-accent)]" />
              <div>
                <div className="font-semibold">Página do app do cliente</div>
                <div className="text-sm text-[var(--layout-text-muted)]">
                  Usa produtos, clientes e estoque do ERP em tempo real.
                </div>
              </div>
            </div>
            <Button
              onClick={handleOpenConnectedApp}
              className="mt-5 bg-[var(--layout-accent)] text-white hover:bg-[var(--layout-accent-strong)]"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir aplicativo do cliente
            </Button>
          </div>
        </PanelCard>

        <PanelCard title="Fontes de dados" subtitle="Integração entre os sistemas">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-[var(--layout-surface-2)] px-4 py-3 text-white">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[var(--layout-accent)]" />
                Fonte dos produtos
              </span>
              <span className="font-semibold">{snapshot.settings?.appInfo?.sourceProdutos || 'produtos_erp'}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--layout-surface-2)] px-4 py-3 text-white">
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-[var(--layout-accent)]" />
                Destino dos pedidos
              </span>
              <span className="font-semibold">{snapshot.settings?.appInfo?.destinoPedidos || 'pedidos_delivery'}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--layout-surface-2)] px-4 py-3 text-white">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--layout-accent)]" />
                Cadastro de clientes
              </span>
              <span className="font-semibold">{snapshot.settings?.appInfo?.cadastroClientes || 'clientes'}</span>
            </div>
          </div>
        </PanelCard>
      </div>

      <PanelCard title="Fluxo completo" subtitle="Como os pedidos trafegam entre o app e a operação da loja." className="mt-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            'Cliente faz pedido no APP',
            'Pedido aparece automaticamente no Painel da Loja → Pedidos',
            'Loja pode aceitar, imprimir, enviar para motoboy e finalizar',
            'Finalização atualiza estoque automaticamente',
          ].map((step, index) => (
            <div
              key={step}
              className="rounded-xl border border-[var(--layout-border)] bg-[var(--layout-surface-2)] p-4 text-sm text-white"
            >
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--layout-accent)] font-bold text-white">
                {index + 1}
              </div>
              {step}
            </div>
          ))}
        </div>
      </PanelCard>

      <PanelCard title="Resumo operacional" subtitle="Catálogo publicado e pedidos integrados ao hub." className="mt-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--layout-border)] bg-[var(--layout-surface-2)] p-4 text-white">
            <div className="mb-2 flex items-center gap-2 font-semibold text-white">
              <FolderSync className="h-4 w-4 text-[var(--layout-accent)]" />
              Produtos do ERP
            </div>
            <div>{snapshot.publishedProducts.length} publicados no app</div>
          </div>
          <div className="rounded-xl border border-[var(--layout-border)] bg-[var(--layout-surface-2)] p-4 text-white">
            <div className="mb-2 flex items-center gap-2 font-semibold text-white">
              <Users className="h-4 w-4 text-[var(--layout-accent)]" />
              Clientes
            </div>
            <div>{snapshot.people.length} sincronizados com o ERP</div>
          </div>
          <div className="rounded-xl border border-[var(--layout-border)] bg-[var(--layout-surface-2)] p-4 text-white">
            <div className="mb-2 flex items-center gap-2 font-semibold text-white">
              <ShoppingBag className="h-4 w-4 text-[var(--layout-accent)]" />
              Pedidos
            </div>
            <div>{snapshot.orders.length} recebidos pelo hub delivery</div>
          </div>
        </div>
      </PanelCard>
    </ModuleShell>
  );
};

export default AppPedidosPage;
