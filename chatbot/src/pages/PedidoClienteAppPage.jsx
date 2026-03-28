import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  ArrowLeft,
  Bike,
  Clock3,
  MapPin,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PanelCard from '@/components/delivery/PanelCard';
import { supabase } from '@/lib/customSupabaseClient';
import { getDeliveryEventName, getOrderStatusTone } from '@/services/deliveryHubService';
import { createDeliveryOrder, deliveryFormatting, fetchErpCollections } from '@/services/deliveryHubService';
import { buildApiUrl, fetchAppSnapshotFromApi } from '@/services/appClientApi';

const orderSteps = ['Novo pedido', 'Em preparação', 'Saiu para entrega', 'Entregue'];
const flowSteps = [
  { key: 'produtos', label: 'Produtos' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'status', label: 'Status' },
];

const PedidoClienteAppPage = () => {
  const [storeId, setStoreId] = useState('');
  const [apiParam, setApiParam] = useState('');
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [settings, setSettings] = useState(null);
  const [cart, setCart] = useState([]);
  const [message, setMessage] = useState('');
  const [lastOrderId, setLastOrderId] = useState('');
  const [lastOrderStatus, setLastOrderStatus] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentStep, setCurrentStep] = useState('produtos');
  const [customer, setCustomer] = useState({
    nome: '',
    telefone: '',
    endereco: '',
    numero: '',
    cep: '',
    bairro: '',
    formaPagamento: 'PIX',
    precisaTroco: 'nao',
    trocoPara: '',
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStoreId(params.get('store') || '');
    setApiParam(params.get('api') || '');
  }, []);

  const apiUrl = useMemo(() => buildApiUrl(apiParam, storeId), [apiParam, storeId]);

  useEffect(() => {
    const load = async () => {
      if (!storeId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (apiUrl) {
          const snapshot = await fetchAppSnapshotFromApi(apiUrl);
          const publishedIds = snapshot.settings?.publishedProductIds || [];
          const pausedIds = snapshot.settings?.pausedProductIds || [];
          const useAllProducts = (snapshot.settings?.publishAllProducts ?? true) && publishedIds.length === 0;
          const normalizedCatalog = snapshot.products
            .filter((item) => (useAllProducts ? true : publishedIds.includes(item.id)))
            .filter((item) => !pausedIds.includes(item.id))
            .map((item) => ({
              ...item,
              estoque: Number(item.estoque || 0),
              categoria: item.categoria || 'Geral',
            }));

          setCatalog(normalizedCatalog);
          setSettings(snapshot.settings);
          setLastSyncAt(new Date().toLocaleTimeString('pt-BR'));
          return;
        }

        const snapshot = await fetchErpCollections(storeId);
        const publishedIds = snapshot.settings?.publishedProductIds || [];
        const pausedIds = snapshot.settings?.pausedProductIds || [];
        const useAllProducts = (snapshot.settings?.publishAllProducts ?? true) && publishedIds.length === 0;
        const normalizedCatalog = snapshot.products
          .filter((item) => (useAllProducts ? true : publishedIds.includes(item.id)))
          .filter((item) => !pausedIds.includes(item.id))
          .map((item) => ({
            ...item,
            estoque: Number(item.estoque || 0),
            categoria: item.categoria || 'Geral',
          }));

        setCatalog(normalizedCatalog);
        setSettings(snapshot.settings);
        setLastSyncAt(new Date().toLocaleTimeString('pt-BR'));

        if (lastOrderId) {
          const currentOrder = (snapshot.orders || []).find((item) => item.id === lastOrderId);
          if (currentOrder) {
            setLastOrderStatus(currentOrder.status);
          }
        }
      } catch (error) {
        console.error('Falha ao carregar dados do app:', error);
        setMessage(error?.message || 'Erro ao carregar dados do app.');
      } finally {
        setLoading(false);
      }
    };

    load();

    const refresh = () => load();
    const eventName = getDeliveryEventName();
    const channel = !apiUrl && storeId
      ? supabase
          .channel(`app-cliente-catalogo-${storeId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'produtos', filter: `user_id=eq.${storeId}` },
            refresh,
          )
          .subscribe()
      : null;
    const intervalId = apiUrl ? setInterval(refresh, 60000) : null;

    window.addEventListener(eventName, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(eventName, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      if (channel) channel.unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
  }, [lastOrderId, storeId, apiUrl]);

  const bairrosAtendidos = settings?.bairros || [];

  const subtotalProdutos = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantidade * item.preco_unitario, 0),
    [cart],
  );

  const taxaEntrega = Number(
    bairrosAtendidos.find((item) => item.nome === customer.bairro)?.taxaEntrega || 0,
  );

  const totalPedido = subtotalProdutos + taxaEntrega;

  const cartQuantityByProduct = useMemo(
    () =>
      cart.reduce((accumulator, item) => {
        accumulator[item.id] = (accumulator[item.id] || 0) + item.quantidade;
        return accumulator;
      }, {}),
    [cart],
  );

  const visibleCatalog = useMemo(
    () => catalog,
    [catalog],
  );

  const categories = useMemo(
    () => ['Todos', ...new Set(visibleCatalog.map((item) => item.categoria).filter(Boolean))],
    [visibleCatalog],
  );

  const filteredCatalog = useMemo(() => {
    return visibleCatalog.filter((product) => {
      const matchesCategory = selectedCategory === 'Todos' || product.categoria === selectedCategory;
      const matchesSearch =
        searchTerm.trim() === '' ||
        product.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.categoria.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchTerm, selectedCategory, visibleCatalog]);

  const groupedCatalog = useMemo(() => {
    return filteredCatalog.reduce((accumulator, product) => {
      const category = product.categoria || 'Geral';
      if (!accumulator[category]) accumulator[category] = [];
      accumulator[category].push(product);
      return accumulator;
    }, {});
  }, [filteredCatalog]);

  const addToCart = (product) => {
    const currentInCart = cartQuantityByProduct[product.id] || 0;
    const availableStock = Number(product.estoque || 0);
    if (availableStock <= currentInCart) return;

    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantidade: item.quantidade + 1 } : item,
        );
      }

      return [
        ...current,
        {
          id: product.id,
          produto: product.descricao,
          categoria: product.categoria || 'Geral',
          quantidade: 1,
          preco_unitario: Number(product.valor_venda || 0),
        },
      ];
    });
  };

  const updateQuantity = (productId, quantity) => {
    const product = catalog.find((item) => item.id === productId);
    const availableStock = Number(product?.estoque || 0);

    if (quantity <= 0) {
      setCart((current) => current.filter((item) => item.id !== productId));
      return;
    }
    if (quantity > availableStock) return;

    setCart((current) =>
      current.map((item) => (item.id === productId ? { ...item, quantidade: quantity } : item)),
    );
  };

  const handleGoToEntrega = () => {
    if (cart.length === 0) {
      setMessage('Escolha pelo menos um item antes de continuar.');
      return;
    }
    setMessage('');
    setCurrentStep('entrega');
  };

  const handleSubmit = async () => {
    if (!storeId || cart.length === 0) return;

    if (!customer.nome || !customer.endereco || !customer.numero || !customer.cep || !customer.telefone) {
      setMessage('Preencha nome, endereço, número, CEP e telefone.');
      return;
    }

    if (!customer.bairro) {
      setMessage('Selecione o bairro para calcular a taxa de entrega.');
      return;
    }

    if (
      customer.formaPagamento === 'Dinheiro' &&
      customer.precisaTroco === 'sim' &&
      Number(customer.trocoPara || 0) < totalPedido
    ) {
      setMessage('Informe um valor de troco igual ou maior que o total do pedido.');
      return;
    }

    try {
      const order = await createDeliveryOrder(storeId, {
        origem: 'app',
        persistClient: true,
        cliente: {
          nome: customer.nome,
          telefone: customer.telefone,
          endereco: `${customer.endereco}, ${customer.numero}`,
          bairro: customer.bairro,
        },
        itens: cart,
        forma_pagamento: customer.formaPagamento,
        precisa_troco: customer.formaPagamento === 'Dinheiro' && customer.precisaTroco === 'sim',
        troco_para:
          customer.formaPagamento === 'Dinheiro' && customer.precisaTroco === 'sim'
            ? Number(customer.trocoPara || 0)
            : 0,
        taxa_entrega: taxaEntrega,
        valor_total: totalPedido,
        endereco: `${customer.endereco}, ${customer.numero} - CEP ${customer.cep}`,
        bairro: customer.bairro,
        observacoes: 'Pedido enviado pelo App de Pedidos',
      });

      setMessage(`Pedido #${order.numero} enviado com sucesso para a loja.`);
      setLastOrderId(order.id);
      setLastOrderStatus(order.status);
      setCurrentStep('status');
      setCart([]);
    } catch (error) {
      setMessage(error.message || 'Não foi possível enviar o pedido.');
    }
  };

  const currentOrderStepIndex = orderSteps.indexOf(lastOrderStatus);
  const timelineStatus = lastOrderStatus || 'Novo pedido';
  const appInfo = settings?.appInfo || {};
  const appName = appInfo.nomeAplicativo || 'FORTIN Delivery';
  const primaryColor = appInfo.corPrimaria || '#ff4d42';
  const secondaryColor = appInfo.corSecundaria || '#4b2e1f';
  const heroBackground = `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`;

  return (
    <div className="min-h-screen bg-[#f4efe8]">
      <Helmet>
        <title>{appName} - FORTIN ERP PRO</title>
      </Helmet>

      <div className="mx-auto min-h-screen max-w-md bg-[#fffaf5] shadow-2xl shadow-black/10">
        <div className="sticky top-0 z-30 overflow-hidden border-b border-[#eadfce] bg-white">
          <div className="px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: primaryColor }}>{appName}</div>
          <div className="relative h-28" style={{ background: heroBackground }}>
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#3b2b1f]">
                  <Store className="mr-1 inline h-3.5 w-3.5" />
                  Loja online
                </div>
                <div className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#3b2b1f]">
                  <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                  {appInfo.horarioFuncionamento || 'Horário não informado'}
                </div>
              </div>
              <div className="rounded-full bg-[#fff3cd] px-3 py-1 text-xs font-semibold text-[#7a4b00]">
                Atualizado {lastSyncAt || '--:--'}
              </div>
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="-mt-6 rounded-3xl border border-[#eadfce] bg-white p-4 shadow-lg">
              <div className="flex items-center gap-3">
                {appInfo.logoUrl ? (
                  <img src={appInfo.logoUrl} alt={appName} className="h-14 w-14 rounded-2xl object-cover shadow-md" />
                ) : null}
                <div>
                  <h1 className="text-2xl font-black text-[#23160f]">{appName}</h1>
                  <p className="mt-1 text-sm text-[#7b6a5d]">Escolha os produtos, informe a entrega e acompanhe o status.</p>
                </div>
              </div>
              {appInfo.enderecoLoja ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[#fcf7f1] px-3 py-2 text-sm text-[#6f5d51]">
                  <MapPin className="h-4 w-4" style={{ color: primaryColor }} />
                  {appInfo.enderecoLoja}
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {flowSteps.map((step, index) => {
                  const active = currentStep === step.key;
                  const completed =
                    (currentStep === 'entrega' && index === 0) ||
                    (currentStep === 'status' && index < 2);
                  return (
                    <div
                      key={step.key}
                      className={`rounded-2xl border px-3 py-2 text-center text-xs font-semibold ${
                        completed
                          ? 'border-[#00b067]/30 bg-[#eef8ef] text-[#00b067]'
                          : 'border-[#eadfce] bg-[#fcf7f1] text-[#8c7b6f]'
                      }`}
                      style={active ? { borderColor: primaryColor, backgroundColor: `${primaryColor}14`, color: primaryColor } : undefined}
                    >
                      {index + 1}. {step.label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-[#7b6a5d]">Carregando catálogo...</div>
        ) : (
          <div className="px-4 pb-28 pt-2">
            {message ? (
              <div className="mb-4 rounded-2xl border border-[#ffcfcc] bg-[#fff0ef] px-4 py-3 text-sm font-medium text-[#c0392b]">
                {message}
              </div>
            ) : null}

            {currentStep === 'produtos' ? (
              <>
                <div className="mb-4 rounded-3xl border border-[#eadfce] bg-white p-4">
                  <div className="flex items-center gap-2 rounded-2xl border border-[#eadfce] bg-[#fcf7f1] px-3 py-3">
                    <Search className="h-4 w-4 text-[#7b6a5d]" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Buscar produtos..."
                      className="w-full bg-transparent text-sm text-[#23160f] outline-none placeholder:text-[#a18c7c]"
                    />
                    <Menu className="h-4 w-4 text-[#7b6a5d]" />
                  </div>
                  <div className="custom-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          selectedCategory === category
                            ? 'bg-white'
                            : 'border-[#eadfce] bg-white text-[#6f5d51]'
                        }`}
                        style={selectedCategory === category ? { borderColor: primaryColor, backgroundColor: `${primaryColor}14`, color: primaryColor } : undefined}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                {Object.keys(groupedCatalog).length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[#d8c9bb] bg-white px-6 py-12 text-center text-sm text-[#8c7b6f]">
                    Nenhum produto encontrado para essa categoria.
                  </div>
                ) : (
                  Object.entries(groupedCatalog).map(([category, products]) => (
                    <section key={category} className="mb-6">
                      <div className="mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" style={{ color: primaryColor }} />
                        <h2 className="text-2xl font-black" style={{ color: primaryColor }}>{category}</h2>
                      </div>
                      <div className="space-y-3">
                        {products.map((product) => {
                          const remaining = Math.max(
                            0,
                            Number(product.estoque || 0) - (cartQuantityByProduct[product.id] || 0),
                          );
                          const inCart = cart.find((item) => item.id === product.id);
                          return (
                            <div key={product.id} className="rounded-3xl border border-[#eadfce] bg-white p-3 shadow-sm">
                              <div className="flex gap-3">
                                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ffe0c2_0%,#f6b47a_100%)] text-center text-xs font-bold text-[#8b4b16]">
                                  {product.descricao}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h3 className="line-clamp-1 text-lg font-bold text-[#23160f]">{product.descricao}</h3>
                                      <p className="mt-1 line-clamp-2 text-sm text-[#8c7b6f]">Produto do ERP disponível no estoque em tempo real.</p>
                                    </div>
                                    {remaining <= 0 ? (
                                      <div className="rounded-lg bg-gray-500 px-2 py-1 text-[10px] font-bold text-white">Sem estoque</div>
                                    ) : remaining <= 3 ? (
                                      <div className="rounded-lg bg-[#ff9f1a] px-2 py-1 text-[10px] font-bold text-white">Últimas</div>
                                    ) : null}
                                  </div>
                                  <div className="mt-3 flex items-center justify-between gap-3">
                                    <div>
                                      <div className="text-2xl font-black" style={{ color: primaryColor }}>
                                        {deliveryFormatting.formatCurrency(product.valor_venda)}
                                      </div>
                                      <div className="text-xs text-[#8c7b6f]">
                                        {remaining <= 0 ? 'Produto indisponível no momento' : remaining <= 3 ? `Últimas ${remaining} unidades` : `Estoque: ${remaining}`}
                                      </div>
                                    </div>
                                    {inCart ? (
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => updateQuantity(product.id, inCart.quantidade - 1)} className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}>
                                          <Minus className="h-4 w-4" />
                                        </button>
                                        <div className="min-w-[24px] text-center text-sm font-bold text-[#23160f]">{inCart.quantidade}</div>
                                        <button onClick={() => addToCart(product)} disabled={remaining <= 0} className="flex h-9 w-9 items-center justify-center rounded-xl text-white disabled:opacity-40" style={{ backgroundColor: primaryColor }}>
                                          <Plus className="h-4 w-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button onClick={() => addToCart(product)} disabled={remaining <= 0} className="flex h-10 w-10 items-center justify-center rounded-xl text-white disabled:opacity-40" style={{ backgroundColor: primaryColor }}>
                                        <Plus className="h-5 w-5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </>
            ) : null}

            {currentStep === 'entrega' ? (
              <>
                <Button onClick={() => setCurrentStep('produtos')} variant="outline" className="mb-4 border-[#eadfce] bg-white text-[#23160f] hover:bg-[#fcf7f1]">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para produtos
                </Button>

                <PanelCard title="Dados para entrega" subtitle="Informe seus dados para concluir o pedido" className="border-[#eadfce] bg-white">
                  <div className="space-y-3">
                    <input value={customer.nome} onChange={(event) => setCustomer((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome" className="w-full rounded-2xl border border-[#eadfce] bg-[#fcf7f1] px-4 py-3 text-[#23160f] outline-none" />
                    <input value={customer.endereco} onChange={(event) => setCustomer((current) => ({ ...current, endereco: event.target.value }))} placeholder="Endereço" className="w-full rounded-2xl border border-[#eadfce] bg-[#fcf7f1] px-4 py-3 text-[#23160f] outline-none" />
                    <div className="grid grid-cols-2 gap-3">
                      <input value={customer.numero} onChange={(event) => setCustomer((current) => ({ ...current, numero: event.target.value }))} placeholder="Número" className="w-full rounded-2xl border border-[#eadfce] bg-[#fcf7f1] px-4 py-3 text-[#23160f] outline-none" />
                      <input value={customer.cep} onChange={(event) => setCustomer((current) => ({ ...current, cep: event.target.value }))} placeholder="CEP" className="w-full rounded-2xl border border-[#eadfce] bg-[#fcf7f1] px-4 py-3 text-[#23160f] outline-none" />
                    </div>
                    <input value={customer.telefone} onChange={(event) => setCustomer((current) => ({ ...current, telefone: event.target.value }))} placeholder="Telefone" className="w-full rounded-2xl border border-[#eadfce] bg-[#fcf7f1] px-4 py-3 text-[#23160f] outline-none" />
                    <select value={customer.bairro} onChange={(event) => setCustomer((current) => ({ ...current, bairro: event.target.value }))} className="w-full rounded-2xl border border-[#eadfce] bg-[#fcf7f1] px-4 py-3 text-[#23160f] outline-none">
                      <option value="">Selecione o bairro</option>
                      {bairrosAtendidos.map((bairro) => (
                        <option key={bairro.id} value={bairro.nome}>
                          {bairro.nome} • taxa {deliveryFormatting.formatCurrency(bairro.taxaEntrega)}
                        </option>
                      ))}
                    </select>
                    <select value={customer.formaPagamento} onChange={(event) => setCustomer((current) => ({ ...current, formaPagamento: event.target.value }))} className="w-full rounded-2xl border border-[#eadfce] bg-[#fcf7f1] px-4 py-3 text-[#23160f] outline-none">
                      <option value="PIX">PIX</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Cartão">Cartão</option>
                    </select>
                    {customer.formaPagamento === 'Dinheiro' ? (
                      <>
                        <select value={customer.precisaTroco} onChange={(event) => setCustomer((current) => ({ ...current, precisaTroco: event.target.value, trocoPara: event.target.value === 'sim' ? current.trocoPara : '' }))} className="w-full rounded-2xl border border-[#eadfce] bg-[#fcf7f1] px-4 py-3 text-[#23160f] outline-none">
                          <option value="nao">Não precisa de troco</option>
                          <option value="sim">Vai precisar de troco</option>
                        </select>
                        {customer.precisaTroco === 'sim' ? (
                          <input type="number" min={totalPedido} step="0.01" value={customer.trocoPara} onChange={(event) => setCustomer((current) => ({ ...current, trocoPara: event.target.value }))} placeholder={`Troco para ${deliveryFormatting.formatCurrency(totalPedido)}`} className="w-full rounded-2xl border border-[#eadfce] bg-[#fcf7f1] px-4 py-3 text-[#23160f] outline-none" />
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </PanelCard>

                <PanelCard title="Resumo do pedido" subtitle="Confira subtotal e taxa de entrega" className="mt-4 border-[#eadfce] bg-white">
                  <div className="space-y-3 rounded-2xl bg-[#fcf7f1] p-4 text-sm">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-[#23160f]">
                        <span>{item.quantidade}x {item.produto}</span>
                        <span>{deliveryFormatting.formatCurrency(item.quantidade * item.preco_unitario)}</span>
                      </div>
                    ))}
                    <div className="border-t border-[#eadfce] pt-3">
                      <div className="flex items-center justify-between text-[#6f5d51]">
                        <span>Subtotal</span>
                        <span>{deliveryFormatting.formatCurrency(subtotalProdutos)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[#6f5d51]">
                        <span>Taxa de entrega</span>
                        <span>{deliveryFormatting.formatCurrency(taxaEntrega)}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-base font-black text-[#23160f]">
                        <span>Total</span>
                        <span>{deliveryFormatting.formatCurrency(totalPedido)}</span>
                      </div>
                    </div>
                  </div>
                </PanelCard>
              </>
            ) : null}

            {currentStep === 'status' ? (
              <>
                {lastOrderStatus === 'Cancelado' ? (
                  <div className="mb-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-700">
                    Seu pedido foi cancelado pela loja. Se precisar, faça um novo pedido ou entre em contato.
                  </div>
                ) : null}

                <PanelCard title="Pedido enviado" subtitle="Acompanhe o andamento em tempo real" className="mb-4 border-[#eadfce] bg-white">
                  <div className="rounded-2xl bg-[#fcf7f1] p-4">
                    <div className="text-sm text-[#8c7b6f]">Pedido</div>
                    <div className="mt-1 text-lg font-black text-[#23160f]">{lastOrderId || 'Aguardando pedido'}</div>
                    <div className="mt-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusTone(timelineStatus)}`}>
                        {lastOrderStatus || 'Novo pedido'}
                      </span>
                    </div>
                  </div>
                </PanelCard>
                <PanelCard title="Status do pedido" subtitle="Etapas do seu pedido" className="border-[#eadfce] bg-white">
                  <div className="space-y-3">
                    {orderSteps.map((step, index) => {
                      const completed = currentOrderStepIndex >= index;
                      const active = timelineStatus === step;
                      return (
                        <div key={step} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${completed ? 'text-white' : 'border-[#d8c9bb] bg-white text-[#a18c7c]'}`}
                              style={completed ? { borderColor: primaryColor, backgroundColor: primaryColor } : undefined}
                            >
                              {index + 1}
                            </div>
                            {index < orderSteps.length - 1 ? <div className={`mt-1 h-8 w-px ${completed ? '' : 'bg-[#e5d8ca]'}`} style={completed ? { backgroundColor: primaryColor } : undefined} /> : null}
                          </div>
                          <div className="pt-1">
                            <div className={`text-sm font-semibold ${active ? 'text-[#23160f]' : completed ? '' : 'text-[#a18c7c]'}`} style={!active && completed ? { color: primaryColor } : undefined}>{step}</div>
                            <div className="text-xs text-[#8c7b6f]">
                              {active ? 'Etapa atual do seu pedido.' : completed ? 'Etapa concluída.' : 'Aguardando atualização da loja.'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </PanelCard>
              </>
            ) : null}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t border-[#eadfce] bg-white/95 px-4 py-3 backdrop-blur">
          {currentStep === 'produtos' ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a18c7c]">Seu pedido</div>
                <div className="text-lg font-black text-[#23160f]">
                  {cart.length} item(ns) • {deliveryFormatting.formatCurrency(subtotalProdutos)}
                </div>
              </div>
              <Button onClick={handleGoToEntrega} disabled={cart.length === 0} className="rounded-2xl px-5 py-6 text-base font-bold text-white disabled:opacity-40" style={{ backgroundColor: primaryColor }}>
                Continuar
              </Button>
            </div>
          ) : null}

          {currentStep === 'entrega' ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a18c7c]">Total do pedido</div>
                <div className="text-lg font-black text-[#23160f]">{deliveryFormatting.formatCurrency(totalPedido)}</div>
                <div className="mt-1 flex items-center gap-3 text-xs text-[#8c7b6f]">
                  <span><MapPin className="mr-1 inline h-3 w-3" />{customer.bairro || 'Escolha o bairro'}</span>
                  <span><Bike className="mr-1 inline h-3 w-3" />{bairrosAtendidos.find((item) => item.nome === customer.bairro)?.tempoMedio || 'Entrega'}</span>
                </div>
              </div>
              <Button onClick={handleSubmit} disabled={cart.length === 0} className="rounded-2xl px-5 py-6 text-base font-bold text-white disabled:opacity-40" style={{ backgroundColor: primaryColor }}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Pedir
              </Button>
            </div>
          ) : null}

          {currentStep === 'status' ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a18c7c]">Status do pedido</div>
                <div className="text-lg font-black text-[#23160f]">{lastOrderId || 'Pedido enviado'}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-[#8c7b6f]">
                  <Clock3 className="h-3 w-3" />
                  Acompanhe as próximas atualizações aqui
                </div>
              </div>
              <Button onClick={() => { setMessage(''); setCurrentStep('produtos'); }} variant="outline" className="rounded-2xl border-[#eadfce] bg-white text-[#23160f] hover:bg-[#fcf7f1]">
                Novo pedido
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PedidoClienteAppPage;
