import { supabase } from '@/lib/customSupabaseClient';

const storageKey = (userId, suffix) => `fortin_${suffix}_${userId}`;
const DELIVERY_EVENT = 'fortin-delivery-updated';
const SETTINGS_TABLE = 'delivery_settings';

const defaultSettings = {
  publishAllProducts: true,
  publishedProductIds: [],
  pausedProductIds: [],
  bairros: [
    { id: 'centro', nome: 'Centro', taxaEntrega: 5, tempoMedio: '20-30 min' },
    { id: 'industrial', nome: 'Industrial', taxaEntrega: 7, tempoMedio: '30-40 min' },
  ],
  appInfo: {
    appUrl: '',
    nomeAplicativo: 'FORTIN Delivery',
    sourceProdutos: 'produtos_erp',
    destinoPedidos: 'pedidos_delivery',
    cadastroClientes: 'clientes',
    horarioFuncionamento: 'Seg a Dom • 08:00 às 22:00',
    enderecoLoja: 'Rua da Loja, 123 - Centro',
    corPrimaria: '#ff4d42',
    corSecundaria: '#4b2e1f',
    logoUrl: '',
  },
  lastOrderNumber: 1000,
};

const mergeSettings = (value = {}) => ({
  ...defaultSettings,
  ...value,
  appInfo: {
    ...defaultSettings.appInfo,
    ...(value.appInfo || {}),
  },
});

const defaultResponse = {
  status: 'ready',
  message: 'Clique em uma ação para testar a API simulada.',
};

const parseStorage = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error('Erro ao ler localStorage do delivery:', error);
    return fallback;
  }
};

const emitDeliveryUpdate = () => {
  window.dispatchEvent(new CustomEvent(DELIVERY_EVENT));
};

const getStoredSettings = (userId) => {
  const key = storageKey(userId, 'delivery_settings');
  const value = parseStorage(localStorage.getItem(key), null);
  if (value) {
    return mergeSettings(value);
  }
  const fallback = mergeSettings({});
  localStorage.setItem(key, JSON.stringify(fallback));
  return fallback;
};

const setStoredSettings = (userId, settings) => {
  localStorage.setItem(storageKey(userId, 'delivery_settings'), JSON.stringify(settings));
  emitDeliveryUpdate();
  return settings;
};

const loadRemoteSettings = async (userId) => {
  try {
    const { data, error } = await supabase
      .from(SETTINGS_TABLE)
      .select('settings')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (data?.settings) {
      const merged = mergeSettings(data.settings);
      localStorage.setItem(storageKey(userId, 'delivery_settings'), JSON.stringify(merged));
      return merged;
    }
  } catch (error) {
    console.warn('Falha ao carregar configuracoes do delivery do banco:', error);
  }

  return getStoredSettings(userId);
};

const persistSettings = async (userId, settings) => {
  try {
    const { error } = await supabase
      .from(SETTINGS_TABLE)
      .upsert(
        {
          user_id: userId,
          settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (error) throw error;
  } catch (error) {
    console.warn('Falha ao salvar configuracoes do delivery no banco:', error);
  }
};

const saveSettings = async (userId, settings) => {
  const stored = setStoredSettings(userId, settings);
  await persistSettings(userId, stored);
  return stored;
};

const getProductVisibility = (settings, productId) => {
  const publishedIds = settings?.publishedProductIds || [];
  const pausedIds = settings?.pausedProductIds || [];
  const useAllProducts = (settings?.publishAllProducts ?? true) && publishedIds.length === 0;
  const isPublished = useAllProducts ? true : publishedIds.includes(productId);
  const isPaused = isPublished && pausedIds.includes(productId);

  return { isPublished, isPaused };
};

const getStoredOrders = (userId) => {
  return parseStorage(localStorage.getItem(storageKey(userId, 'delivery_orders')), []);
};

const setStoredOrders = (userId, orders) => {
  localStorage.setItem(storageKey(userId, 'delivery_orders'), JSON.stringify(orders));
  emitDeliveryUpdate();
  return orders;
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const stockSnapshotForOrder = (products, items) => {
  const missing = items
    .map((item) => {
      const product = products.find((entry) => String(entry.id) === String(item.id));
      const available = Number(product?.estoque || 0);
      const requested = Number(item.quantidade || 0);
      if (available >= requested) return null;

      return {
        id: item.id,
        produto: item.produto,
        requested,
        available,
        shortBy: requested - available,
      };
    })
    .filter(Boolean);

  return {
    ok: missing.length === 0,
    missing,
    checkedAt: new Date().toISOString(),
  };
};

const buildOrderTotals = (items) =>
  items.reduce((total, item) => total + Number(item.preco_unitario || 0) * Number(item.quantidade || 0), 0);

const nextOrderNumber = (settings) => Number(settings.lastOrderNumber || 1000) + 1;
const getLocalDateKey = (dateValue) => {
  const date = new Date(dateValue || Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getStorePanelOrders = (orders = []) => orders.filter((order) => order.origem === 'app');

export const getDeliveryEventName = () => DELIVERY_EVENT;
export const getChatbotDefaultResponse = () => defaultResponse;
export const readStoredDeliveryOrders = (userId) => getStoredOrders(userId);

export const fetchErpCollections = async (userId) => {
  const [productsResult, peopleResult, motoboysResult, salesResult] = await Promise.all([
    supabase
      .from('produtos')
      .select('id,codigo,descricao,categoria,valor_venda,estoque,ativo,tipo,unidade')
      .eq('user_id', userId)
      .eq('ativo', true)
      .order('descricao', { ascending: true }),
    supabase
      .from('pessoas')
      .select('id,nome,telefone,endereco,cidade,estado')
      .eq('user_id', userId)
      .order('nome', { ascending: true }),
    supabase
      .from('motoboys')
      .select('id,nome,telefone,status')
      .eq('user_id', userId)
      .eq('status', 'ativo')
      .order('nome', { ascending: true }),
    supabase
      .from('vendas')
      .select('id,numero_venda,cliente_id,total,status,tipo_venda,forma_pagamento,data_criacao,endereco_entrega')
      .eq('user_id', userId)
      .order('data_criacao', { ascending: false })
      .limit(50),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (peopleResult.error) throw peopleResult.error;
  if (motoboysResult.error) throw motoboysResult.error;
  if (salesResult.error) throw salesResult.error;

  const settings = await loadRemoteSettings(userId);
  const orders = getStoredOrders(userId);

  return {
    products: productsResult.data || [],
    people: peopleResult.data || [],
    motoboys: motoboysResult.data || [],
    sales: salesResult.data || [],
    orders,
    settings,
  };
};

export const syncDeliverySnapshot = async (userId) => {
  const snapshot = await fetchErpCollections(userId);
  return {
    ...snapshot,
    categories: [...new Set(snapshot.products.map((item) => item.categoria).filter(Boolean))].sort(),
    publishedProducts: snapshot.products.filter((item) => {
      const visibility = getProductVisibility(snapshot.settings, item.id);
      return visibility.isPublished && !visibility.isPaused;
    }),
  };
};

export const togglePublishedProduct = async (userId, productId, allProductIds = []) => {
  const settings = getStoredSettings(userId);
  const publishedIds = settings.publishedProductIds || [];
  const useAllProducts = (settings.publishAllProducts ?? true) && publishedIds.length === 0;
  const nextIds = useAllProducts
    ? allProductIds.filter((id) => id !== productId)
    : publishedIds.includes(productId)
      ? publishedIds.filter((id) => id !== productId)
      : [...publishedIds, productId];
  const nextPausedIds = nextIds.includes(productId)
    ? settings.pausedProductIds || []
    : (settings.pausedProductIds || []).filter((id) => id !== productId);

  return saveSettings(userId, {
    ...settings,
    publishAllProducts: false,
    publishedProductIds: nextIds,
    pausedProductIds: nextPausedIds,
  });
};

export const togglePausedProduct = async (userId, productId) => {
  const settings = getStoredSettings(userId);
  const visibility = getProductVisibility(settings, productId);
  if (!visibility.isPublished) {
    return settings;
  }

  const pausedIds = settings.pausedProductIds || [];
  const nextPausedIds = visibility.isPaused
    ? pausedIds.filter((id) => id !== productId)
    : [...pausedIds, productId];

  return saveSettings(userId, {
    ...settings,
    pausedProductIds: nextPausedIds,
  });
};

export const saveBairrosEntrega = async (userId, bairros) => {
  const settings = getStoredSettings(userId);
  return saveSettings(userId, {
    ...settings,
    bairros,
  });
};

export const saveAppSettings = async (userId, appInfo) => {
  const settings = getStoredSettings(userId);
  return saveSettings(userId, {
    ...settings,
    appInfo: {
      ...settings.appInfo,
      ...appInfo,
    },
  });
};

export const createOrReuseClient = async (userId, clientData) => {
  const phone = (clientData.telefone || '').trim();
  const name = (clientData.nome || '').trim();

  const { data: existing, error: existingError } = await supabase
    .from('pessoas')
    .select('id,nome,telefone,endereco,cidade,estado')
    .eq('user_id', userId)
    .eq('telefone', phone)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from('pessoas')
    .insert([
      {
        user_id: userId,
        nome: name,
        telefone: phone,
        endereco: clientData.endereco || '',
        cidade: clientData.bairro || '',
        estado: clientData.estado || '',
      },
    ])
    .select('id,nome,telefone,endereco,cidade,estado')
    .single();

  if (error) throw error;
  return data;
};

export const createDeliveryOrder = async (userId, payload) => {
  const settings = getStoredSettings(userId);
  const collections = await fetchErpCollections(userId);
  const customer = payload.persistClient
    ? await createOrReuseClient(userId, payload.cliente)
    : null;

  const numero = nextOrderNumber(settings);
  const items = payload.itens.map((item) => ({
    id: item.id,
    produto: item.produto,
    categoria: item.categoria || 'Sem categoria',
    quantidade: Number(item.quantidade || 0),
    preco_unitario: Number(item.preco_unitario || 0),
  }));
  const subtotalProdutos = buildOrderTotals(items);
  const taxaEntrega = Number(
    payload.taxa_entrega || Math.max(0, Number(payload.valor_total || subtotalProdutos) - subtotalProdutos),
  );

  const order = {
    id: `DLV-${numero}`,
    numero,
    origem: payload.origem || 'app',
    clienteId: customer?.id || payload.cliente.id || null,
    cliente: payload.cliente.nome,
    telefone: payload.cliente.telefone || '',
    endereco: payload.endereco,
    bairro: payload.bairro,
    forma_pagamento: payload.forma_pagamento,
    precisaTroco: Boolean(payload.precisa_troco),
    trocoPara: Number(payload.troco_para || 0),
    total: Number(payload.valor_total || buildOrderTotals(items)),
    subtotalProdutos,
    taxaEntrega,
    status: 'Novo pedido',
    itens: items,
    observacoes: payload.observacoes || '',
    motoboyId: null,
    motoboyNome: null,
    createdAt: payload.data || new Date().toISOString(),
    stockCheck: stockSnapshotForOrder(collections.products, items),
    reservedAt: null,
    finalizedAt: null,
    stockCommitted: false,
  };

  setStoredOrders(userId, [order, ...collections.orders]);
  await saveSettings(userId, {
    ...settings,
    lastOrderNumber: numero,
  });

  return order;
};

export const updateDeliveryOrder = async (userId, orderId, updater) => {
  const orders = getStoredOrders(userId);
  const order = orders.find((entry) => entry.id === orderId);
  if (!order) throw new Error('Pedido não encontrado.');

  const updated = typeof updater === 'function' ? updater(order) : { ...order, ...updater };
  setStoredOrders(
    userId,
    orders.map((entry) => (entry.id === orderId ? updated : entry)),
  );
  return updated;
};

export const assignOrderToMotoboy = async (userId, orderId, motoboy) =>
  updateDeliveryOrder(userId, orderId, (order) => ({
    ...order,
    motoboyId: motoboy?.id || null,
    motoboyNome: motoboy?.nome || null,
  }));

export const reserveOrderStock = async (userId, orderId) => {
  const collections = await fetchErpCollections(userId);
  const order = collections.orders.find((entry) => entry.id === orderId);
  if (!order) throw new Error('Pedido não encontrado.');

  const stockCheck = stockSnapshotForOrder(collections.products, order.itens);
  if (!stockCheck.ok) {
    throw new Error(
      `Estoque insuficiente para ${stockCheck.missing.map((item) => item.produto).join(', ')}.`,
    );
  }

  return updateDeliveryOrder(userId, orderId, {
    ...order,
    stockCheck,
    status: 'Em preparação',
    reservedAt: new Date().toISOString(),
  });
};

export const advanceDeliveryOrderStatus = async (userId, orderId, nextStatus) =>
  updateDeliveryOrder(userId, orderId, {
    ...(getStoredOrders(userId).find((entry) => entry.id === orderId) || {}),
    status: nextStatus,
  });

export const finalizeDeliveryOrder = async (userId, orderId) => {
  const collections = await fetchErpCollections(userId);
  const order = collections.orders.find((entry) => entry.id === orderId);
  if (!order) throw new Error('Pedido não encontrado.');
  if (order.stockCommitted) return order;

  const stockCheck = stockSnapshotForOrder(collections.products, order.itens);
  if (!stockCheck.ok) {
    throw new Error(
      `Estoque insuficiente para ${stockCheck.missing.map((item) => item.produto).join(', ')}.`,
    );
  }

  for (const item of order.itens) {
    const product = collections.products.find((entry) => String(entry.id) === String(item.id));
    if (!product) continue;

    const nextStock = Math.max(0, Number(product.estoque || 0) - Number(item.quantidade || 0));
    const { error } = await supabase.from('produtos').update({ estoque: nextStock }).eq('id', item.id);
    if (error) throw error;
  }

  return updateDeliveryOrder(userId, orderId, {
    ...order,
    stockCheck,
    status: 'Entregue',
    finalizedAt: new Date().toISOString(),
    stockCommitted: true,
  });
};

export const buildDashboardMetrics = ({ orders = [], products = [], people = [], settings = defaultSettings }) => {
  const today = new Date().toISOString().slice(0, 10);
  const ordersToday = orders.filter((order) => String(order.createdAt || '').slice(0, 10) === today);
  const bairros = settings?.bairros || [];

  return {
    pedidosHoje: ordersToday.length,
    valorHoje: ordersToday.reduce((sum, order) => sum + Number(order.total || 0), 0),
    emPreparacao: orders.filter((order) => order.status === 'Em preparação').length,
    entregues: orders.filter((order) => order.status === 'Entregue').length,
    produtosPublicados: products.filter((item) => {
      const visibility = getProductVisibility(settings, item.id);
      return visibility.isPublished && !visibility.isPaused;
    }).length,
    clientesCadastrados: people.length,
    bairrosAtendidos: bairros.length,
    pedidosRecebidos: orders.length,
  };
};

export const buildSalesChartData = (orders) => {
  const hourMap = new Map();

  orders.forEach((order) => {
    const date = new Date(order.createdAt || Date.now());
    const label = `${String(date.getHours()).padStart(2, '0')}:00`;
    const current = hourMap.get(label) || { hora: label, pedidos: 0, valor: 0 };
    current.pedidos += 1;
    current.valor += Number(order.total || 0);
    hourMap.set(label, current);
  });

  return [...hourMap.values()].sort((a, b) => a.hora.localeCompare(b.hora));
};

export const buildClientsFromOrders = (people = [], orders = []) =>
  people.map((person) => {
    const relatedOrders = orders.filter((order) => String(order.clienteId) === String(person.id));
    return {
      id: person.id,
      nome: person.nome,
      telefone: person.telefone || '-',
      endereco: person.endereco || '-',
      bairro: person.cidade || '-',
      totalPedidos: relatedOrders.length,
    };
  });

export const createChatbotApi = (userId) => ({
  async getProdutos() {
    const snapshot = await syncDeliverySnapshot(userId);
    return {
      status: 'success',
      total: snapshot.products.length,
      produtos: snapshot.products,
    };
  },
  async buscarProduto(termo) {
    const snapshot = await syncDeliverySnapshot(userId);
    const search = String(termo || '').toLowerCase();
    const produtos = snapshot.products.filter((item) =>
      item.descricao.toLowerCase().includes(search),
    );
    return {
      status: 'success',
      termo,
      resultados: produtos,
    };
  },
  async getProdutoPorId(id) {
    const snapshot = await syncDeliverySnapshot(userId);
    return {
      status: 'success',
      produto: snapshot.products.find((item) => String(item.id) === String(id)) || null,
    };
  },
  async getCategorias() {
    const snapshot = await syncDeliverySnapshot(userId);
    return {
      status: 'success',
      categorias: snapshot.categories,
    };
  },
  async getPedidos() {
    const snapshot = await syncDeliverySnapshot(userId);
    return {
      status: 'success',
      total: snapshot.orders.length,
      pedidos: snapshot.orders,
    };
  },
  async criarPedido(payload) {
    const order = await createDeliveryOrder(userId, {
      origem: 'chatbot',
      persistClient: true,
      cliente: {
        nome: payload.cliente,
        telefone: payload.telefone || '',
        endereco: payload.endereco,
        bairro: payload.bairro,
      },
      itens: payload.itens,
      forma_pagamento: payload.forma_pagamento,
      valor_total: payload.valor_total,
      endereco: payload.endereco,
      bairro: payload.bairro,
      data: payload.data,
      observacoes: 'Pedido criado via Chatbot API',
    });

    return {
      status: 'success',
      message: `Pedido ${order.numero} criado com sucesso.`,
      pedido: order,
    };
  },
});

export const formatOrderForPrint = (order) => {
  const itensTotal = order.itens.reduce(
    (sum, item) => sum + Number(item.preco_unitario || 0) * Number(item.quantidade || 0),
    0,
  );
  const taxaEntrega = Number(order.taxaEntrega ?? Math.max(0, Number(order.total || 0) - itensTotal));

  return {
    venda: {
      id: order.id,
      numero_venda: order.numero,
      data_criacao: order.createdAt,
      subtotal: Number(order.subtotalProdutos ?? itensTotal),
      desconto: 0,
      acrescimo: 0,
      taxa_entrega: taxaEntrega,
      precisa_troco: Boolean(order.precisaTroco),
      troco_para: Number(order.trocoPara || 0),
      total: order.total,
      tipo_venda: 'delivery',
      endereco_entrega: `${order.endereco} - ${order.bairro}`,
      observacoes_entrega: order.observacoes,
    },
    itens: order.itens.map((item) => ({
      descricao: item.produto,
      quantidade: item.quantidade,
      precoUnitario: item.preco_unitario,
      total: Number(item.preco_unitario) * Number(item.quantidade),
    })),
    pagamentos: [
      {
        method: order.forma_pagamento || 'pix',
        value: order.total,
      },
    ],
    cliente: {
      nome: order.cliente,
      telefone: order.telefone,
    },
    motoboy: order.motoboyNome ? { nome: order.motoboyNome } : null,
  };
};

export const getDeliverySummaries = ({ orders = [], products = [], people = [], settings = defaultSettings }) => ({
  metrics: buildDashboardMetrics({ orders, products, people, settings }),
  chartData: buildSalesChartData(orders),
  clientesApp: buildClientsFromOrders(people, orders),
});

export const getOrderStatusTone = (status) => {
  switch (status) {
    case 'Novo pedido':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    case 'Em preparação':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'Saiu para entrega':
      return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
    case 'Entregue':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'Cancelado':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    default:
      return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }
};

export const deliveryFormatting = {
  formatCurrency,
};
