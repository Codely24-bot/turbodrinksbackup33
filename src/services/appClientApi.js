const DEFAULT_APP_INFO = {
  nomeAplicativo: 'FORTIN Delivery',
  sourceProdutos: 'produtos_erp',
  destinoPedidos: 'pedidos_delivery',
  cadastroClientes: 'clientes',
  horarioFuncionamento: '',
  enderecoLoja: '',
  corPrimaria: '#ff4d42',
  corSecundaria: '#4b2e1f',
  logoUrl: '',
};

const DEFAULT_SETTINGS = {
  publishAllProducts: true,
  publishedProductIds: [],
  pausedProductIds: [],
  bairros: [],
  appInfo: DEFAULT_APP_INFO,
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const normalizeAppInfo = (raw = {}) => ({
  ...DEFAULT_APP_INFO,
  nomeAplicativo: raw.nomeAplicativo ?? raw.nome ?? raw.title ?? raw.appName ?? DEFAULT_APP_INFO.nomeAplicativo,
  sourceProdutos: raw.sourceProdutos ?? raw.source_produtos ?? DEFAULT_APP_INFO.sourceProdutos,
  destinoPedidos: raw.destinoPedidos ?? raw.destino_pedidos ?? DEFAULT_APP_INFO.destinoPedidos,
  cadastroClientes: raw.cadastroClientes ?? raw.cadastro_clientes ?? DEFAULT_APP_INFO.cadastroClientes,
  horarioFuncionamento: raw.horarioFuncionamento ?? raw.horario ?? raw.hours ?? '',
  enderecoLoja: raw.enderecoLoja ?? raw.endereco ?? raw.address ?? '',
  corPrimaria: raw.corPrimaria ?? raw.primaryColor ?? DEFAULT_APP_INFO.corPrimaria,
  corSecundaria: raw.corSecundaria ?? raw.secondaryColor ?? DEFAULT_APP_INFO.corSecundaria,
  logoUrl: raw.logoUrl ?? raw.logo ?? raw.logo_url ?? '',
});

const normalizeSettings = (raw = {}) => {
  const settingsRaw = raw.settings ?? raw.config ?? raw.loja ?? raw;
  const appInfoRaw = settingsRaw.appInfo ?? settingsRaw.app ?? settingsRaw;
  return {
    ...DEFAULT_SETTINGS,
    publishAllProducts:
      settingsRaw.publishAllProducts ?? settingsRaw.publicarTodos ?? DEFAULT_SETTINGS.publishAllProducts,
    publishedProductIds: asArray(
      settingsRaw.publishedProductIds ?? settingsRaw.publicados ?? settingsRaw.publishedIds,
    ),
    pausedProductIds: asArray(settingsRaw.pausedProductIds ?? settingsRaw.pausados ?? settingsRaw.pausedIds),
    bairros: asArray(settingsRaw.bairros ?? settingsRaw.bairrosEntrega ?? settingsRaw.neighborhoods),
    appInfo: normalizeAppInfo(appInfoRaw),
  };
};

const normalizeProduct = (item = {}) => ({
  id: item.id ?? item.product_id ?? item.codigo ?? item.sku ?? item._id,
  descricao: item.descricao ?? item.nome ?? item.name ?? item.title ?? '',
  categoria: item.categoria ?? item.category ?? item.categoria_nome ?? item.categoryName ?? 'Geral',
  valor_venda: item.valor_venda ?? item.preco ?? item.price ?? item.valor ?? 0,
  estoque: item.estoque ?? item.stock ?? item.quantidade ?? item.quantity ?? 0,
  ativo: item.ativo ?? item.active ?? true,
  tipo: item.tipo ?? item.type ?? 'produto',
  unidade: item.unidade ?? item.unit ?? '',
});

export const buildApiUrl = (apiParam, storeId) => {
  const trimmed = String(apiParam || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('{storeId}')) {
    return trimmed.replace('{storeId}', encodeURIComponent(storeId));
  }
  if (/[?&]store=/.test(trimmed)) {
    return trimmed;
  }
  const joiner = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${joiner}store=${encodeURIComponent(storeId)}`;
};

export const fetchAppSnapshotFromApi = async (apiUrl) => {
  if (!apiUrl) {
    throw new Error('API do app nao configurada.');
  }

  const url = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error('Resposta da API nao e JSON valido.');
    }
  }

  if (!response.ok) {
    throw new Error(payload?.message || `API ${response.status}`);
  }

  const root = payload?.data ?? payload ?? {};
  const produtosRaw = root.produtos ?? root.products ?? root.itens ?? [];
  const settings = normalizeSettings(root);
  const products = asArray(produtosRaw)
    .map((item) => normalizeProduct(item))
    .filter((item) => item.id && item.descricao);
  const categoriesRaw = root.categorias ?? root.categories;
  const categories = Array.isArray(categoriesRaw)
    ? categoriesRaw
    : [...new Set(products.map((item) => item.categoria).filter(Boolean))].sort();

  return {
    products,
    settings,
    categories,
  };
};
