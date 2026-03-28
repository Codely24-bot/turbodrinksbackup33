import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Bot,
  Clock,
  List,
  MapPin,
  MessageSquare,
  PackageSearch,
  PhoneCall,
  QrCode,
  Shapes,
  ShoppingBag,
  TerminalSquare,
} from 'lucide-react';
import ModuleShell from '@/components/delivery/ModuleShell';
import PanelCard from '@/components/delivery/PanelCard';
import { Button } from '@/components/ui/button';
import { useDeliveryHub } from '@/hooks/useDeliveryHub';
import { deliveryFormatting } from '@/services/deliveryHubService';

const exampleCode = `window.chatbotApi.getProdutos()

window.chatbotApi.buscarProduto("coca cola")

window.chatbotApi.getProdutoPorId("123")

window.chatbotApi.getBairrosEntrega()

window.chatbotApi.getTaxaEntrega("Centro")

window.chatbotApi.getHorarioFuncionamento()

window.chatbotApi.getEnderecoLoja()

window.chatbotApi.criarPedido({
  cliente: "João",
  itens: [
    { id: "123", produto: "Coca Cola", quantidade: 2, preco_unitario: 4.5 }
  ],
  forma_pagamento: "PIX",
  valor_total: 9,
  endereco: "Rua Exemplo 123",
  bairro: "Centro",
  data: new Date().toISOString()
})`;

const buildBotUrls = (rawUrl, nonce) => {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return {
      baseUrl: '',
      botQrImageUrl: '',
      botQrPageUrl: '',
      botBairrosUrl: '',
      botCatalogUrl: '',
      botConfigUrl: '',
      isQrDirect: false,
    };
  }

  const noTrailingSlash = trimmed.replace(/\/+$/, '');
  const qrPngRegex = /\/qr\.png(?:\?.*)?$/i;
  const qrPageRegex = /\/qr(?:\?.*)?$/i;
  const isQrDirect = qrPngRegex.test(noTrailingSlash);
  const isQrPage = !isQrDirect && qrPageRegex.test(noTrailingSlash);
  const baseUrl = isQrDirect
    ? noTrailingSlash.replace(qrPngRegex, '')
    : isQrPage
      ? noTrailingSlash.replace(qrPageRegex, '')
      : noTrailingSlash;
  const qrImageBase = isQrDirect ? noTrailingSlash : `${baseUrl}/qr.png`;
  const botQrImageUrl = qrImageBase.includes('?')
    ? `${qrImageBase}&t=${nonce}`
    : `${qrImageBase}?t=${nonce}`;

  return {
    baseUrl,
    botQrImageUrl,
    botQrPageUrl: `${baseUrl}/qr`,
    botBairrosUrl: `${baseUrl}/bairros`,
    botCatalogUrl: `${baseUrl}/catalogo`,
    botConfigUrl: `${baseUrl}/config`,
    isQrDirect,
  };
};

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const parseMeasure = (value) => {
  const text = normalizeText(value);
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(ml|l|lt|litro|litros|g|kg)/);
  if (!match) return {};
  const raw = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(raw)) return {};
  const unit = match[2];
  if (unit === 'ml') return { volumeMl: Math.round(raw) };
  if (unit === 'l' || unit === 'lt' || unit === 'litro' || unit === 'litros') {
    return { volumeMl: Math.round(raw * 1000) };
  }
  if (unit === 'g') return { pesoKg: Math.round((raw / 1000) * 100) / 100 };
  if (unit === 'kg') return { pesoKg: Math.round(raw * 100) / 100 };
  return {};
};

const guessCatalogCategory = (product) => {
  const base = normalizeText(`${product?.categoria || ''} ${product?.descricao || ''}`);
  if (!base) return 'outros';
  if (base.includes('gelo')) return 'gelo';
  if (base.includes('cerveja') || base.includes('chopp')) return 'cerveja';
  if (
    base.includes('destil') ||
    base.includes('whisky') ||
    base.includes('vodka') ||
    base.includes('gin') ||
    base.includes('tequila') ||
    base.includes('rum') ||
    base.includes('cachaca')
  )
    return 'destilado';
  if (
    base.includes('refrigerante') ||
    base.includes('refri') ||
    base.includes('suco') ||
    base.includes('agua') ||
    base.includes('energ')
  )
    return 'nao alcool';
  if (base.includes('carvao')) return 'carvao';
  return base.split(' ')[0] || 'outros';
};

const buildCatalogItems = (products = []) =>
  products
    .filter((product) => product && product.ativo !== false)
    .map((product) => {
      const measure = parseMeasure(`${product?.descricao || ''} ${product?.unidade || ''}`);
      return {
        id: product.id,
        nome: product.descricao,
        categoria: guessCatalogCategory(product),
        unidade: product.unidade || '',
        preco: Number(product.valor_venda || 0),
        estoque: Number(product.estoque || 0),
        ativo: product.ativo !== false,
        ...measure,
      };
    });

const buildAiDefaults = (value = {}) => ({
  enabled: Boolean(value.enabled),
  mode: value.mode || 'fallback',
  provider: value.provider || 'custom',
  endpoint: value.endpoint || '',
  authType: value.authType || 'bearer',
  headerName: value.headerName || 'Authorization',
  headerValue: value.headerValue || '',
  payloadKey: value.payloadKey || 'message',
  responsePath: value.responsePath || '',
  apiKey: value.apiKey || '',
  model: value.model || '',
  temperature: Number.isFinite(Number(value.temperature)) ? Number(value.temperature) : 0.4,
  maxTokens: Number.isFinite(Number(value.maxTokens)) ? Number(value.maxTokens) : 600,
  systemPrompt: value.systemPrompt || '',
});

const ChatbotApiPage = () => {
  const {
    chatbotApi,
    chatbotDefaultResponse,
    snapshot,
    saveBairrosEntrega,
    saveAppSettings,
    saveChatbotAiSettings,
  } = useDeliveryHub();
  const [response, setResponse] = useState(chatbotDefaultResponse);
  const [loadingAction, setLoadingAction] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeEditor, setActiveEditor] = useState('');
  const [bairrosDraft, setBairrosDraft] = useState([]);
  const [appInfoDraft, setAppInfoDraft] = useState(snapshot.settings?.appInfo || {});
  const [savingBairros, setSavingBairros] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [bairrosDirty, setBairrosDirty] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  const [aiDirty, setAiDirty] = useState(false);
  const [aiDraft, setAiDraft] = useState(() => buildAiDefaults(snapshot.settings?.chatbotAi || {}));
  const [botBaseUrl, setBotBaseUrl] = useState(() => {
    return window.localStorage.getItem('fortin_whatsapp_bot_url') || 'http://localhost:3333';
  });
  const [botQrNonce, setBotQrNonce] = useState(Date.now());
  const [syncStatus, setSyncStatus] = useState('');
  const [botBairrosTotal, setBotBairrosTotal] = useState(null);
  const [botOnline, setBotOnline] = useState(null);
  const [botQrError, setBotQrError] = useState(false);
  const [botStatus, setBotStatus] = useState('');
  const [botCatalogTotal, setBotCatalogTotal] = useState(null);
  const autoSyncRef = useRef(false);
  const editorRef = useRef(null);

  useEffect(() => {
    if (!chatbotApi) return undefined;
    window.chatbotApi = chatbotApi;
    return () => {
      delete window.chatbotApi;
    };
  }, [chatbotApi]);

  const runAction = async (name, handler) => {
    try {
      setLoadingAction(name);
      const result = await handler();
      setResponse(result);
    } catch (error) {
      setResponse({
        status: 'error',
        message: error.message || 'Falha ao executar ação.',
      });
    } finally {
      setLoadingAction('');
    }
  };

  const bairrosAtendidos = snapshot.settings?.bairros || [];
  const appInfo = snapshot.settings?.appInfo || {};
  const catalogItems = useMemo(() => {
    const baseProdutos =
      snapshot.publishedProducts?.length > 0 ? snapshot.publishedProducts : snapshot.products;
    return buildCatalogItems(baseProdutos);
  }, [snapshot.publishedProducts, snapshot.products]);

  const menuText = useMemo(
    () =>
      [
        'Menu rapido:',
        '1. Taxa de entrega',
        '2. Bairros atendidos',
        '3. Horario de funcionamento',
        '4. Endereco fisico da loja',
        '5. Falar com atendente',
        'Responda com o numero ou o nome da opcao.',
      ].join('\n'),
    [],
  );

  useEffect(() => {
    setMessages((current) =>
      current.length === 0
        ? [
            {
              id: 'bot-menu',
              role: 'bot',
              content: menuText,
              createdAt: new Date().toISOString(),
            },
          ]
        : current,
    );
  }, [menuText]);

  useEffect(() => {
    window.localStorage.setItem('fortin_whatsapp_bot_url', botBaseUrl);
  }, [botBaseUrl]);

  useEffect(() => {
    setBairrosDraft(snapshot.settings?.bairros || []);
    setBairrosDirty(false);
  }, [snapshot.settings?.bairros]);

  useEffect(() => {
    setAppInfoDraft(snapshot.settings?.appInfo || {});
    setConfigDirty(false);
  }, [snapshot.settings?.appInfo]);

  useEffect(() => {
    setAiDraft(buildAiDefaults(snapshot.settings?.chatbotAi || {}));
    setAiDirty(false);
  }, [snapshot.settings?.chatbotAi]);

  const {
    baseUrl: normalizedBotBaseUrl,
    botQrImageUrl,
    botQrPageUrl,
    botBairrosUrl,
    botCatalogUrl,
    botConfigUrl,
  } =
    useMemo(() => buildBotUrls(botBaseUrl, botQrNonce), [botBaseUrl, botQrNonce]);
  const isMixedContent =
    typeof window !== 'undefined' &&
    window.location?.protocol === 'https:' &&
    botQrImageUrl.startsWith('http://');

  const fetchBotBairros = async () => {
    const response = await fetch(botBairrosUrl);
    if (!response.ok) {
      throw new Error(`Falha ao ler bairros (${response.status}).`);
    }
    const data = await response.json();
    if (Array.isArray(data?.bairros)) {
      setBotBairrosTotal(data.bairros.length);
    }
  };

  const fetchBotCatalogo = async () => {
    const response = await fetch(botCatalogUrl);
    if (!response.ok) {
      throw new Error(`Falha ao ler catalogo (${response.status}).`);
    }
    const data = await response.json();
    if (Array.isArray(data?.itens)) {
      setBotCatalogTotal(data.itens.length);
    }
  };

  const handleSyncBairros = async ({ silent = false, bairrosOverride } = {}) => {
    try {
      if (!silent) {
        setSyncStatus('Sincronizando bairros...');
      }
      const bairros = Array.isArray(bairrosOverride) ? bairrosOverride : snapshot.settings?.bairros || [];
      const response = await fetch(botBairrosUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bairros }),
      });

      if (!response.ok) {
        throw new Error(`Falha na sincronizacao (${response.status}).`);
      }

      if (!silent) {
        setSyncStatus(`Bairros sincronizados: ${bairros.length}.`);
      }
      await fetchBotBairros();
    } catch (error) {
      if (!silent) {
        setSyncStatus(error.message || 'Falha ao sincronizar bairros.');
      }
      if (silent) {
        throw error;
      }
    }
  };

  const handleSyncCatalogo = async ({ silent = false, catalogoOverride } = {}) => {
    try {
      if (!silent) {
        setSyncStatus('Sincronizando catalogo...');
      }
      const itens = Array.isArray(catalogoOverride) ? catalogoOverride : catalogItems;
      const response = await fetch(botCatalogUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens }),
      });

      if (!response.ok) {
        throw new Error(`Falha na sincronizacao (${response.status}).`);
      }

      if (!silent) {
        setSyncStatus(`Catalogo sincronizado: ${itens.length} itens.`);
      }
      await fetchBotCatalogo();
    } catch (error) {
      if (!silent) {
        setSyncStatus(error.message || 'Falha ao sincronizar catalogo.');
      }
      if (silent) {
        throw error;
      }
    }
  };

  const handleSyncConfig = async ({ silent = false, appInfoOverride } = {}) => {
    try {
      if (!silent) {
        setSyncStatus('Sincronizando horario e endereco...');
      }
      const appInfo = appInfoOverride || snapshot.settings?.appInfo || {};
      const aiConfig = buildAiDefaults(aiDraft);
      const response = await fetch(botConfigUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horarioFuncionamento: appInfo.horarioFuncionamento || '',
          enderecoLoja: appInfo.enderecoLoja || '',
          ai: aiConfig,
        }),
      });

      if (!response.ok) {
        throw new Error(`Falha na sincronizacao (${response.status}).`);
      }

      if (!silent) {
        setSyncStatus('Horario e endereco sincronizados.');
      }
    } catch (error) {
      if (!silent) {
        setSyncStatus(error.message || 'Falha ao sincronizar configuracoes.');
      }
      if (silent) {
        throw error;
      }
    }
  };

  const handleSyncAi = async ({ silent = false, aiOverride } = {}) => {
    try {
      if (!silent) {
        setSyncStatus('Sincronizando IA...');
      }
      const aiConfig = buildAiDefaults(aiOverride || aiDraft);
      const response = await fetch(botConfigUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai: aiConfig }),
      });

      if (!response.ok) {
        throw new Error(`Falha na sincronizacao (${response.status}).`);
      }

      if (!silent) {
        setSyncStatus('IA sincronizada com sucesso.');
      }
    } catch (error) {
      if (!silent) {
        setSyncStatus(error.message || 'Falha ao sincronizar IA.');
      }
      if (silent) {
        throw error;
      }
    }
  };

  const buildCleanBairros = () =>
    bairrosDraft
      .map((item) => ({
        ...item,
        nome: String(item?.nome || '').trim(),
      }))
      .filter((item) => item.nome)
      .map((item) => ({
        id: item.id || buildBairroId(item.nome),
        nome: item.nome,
        taxaEntrega: Number(item.taxaEntrega || 0),
        tempoMedio: String(item.tempoMedio || '').trim(),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));

  const saveBairrosOnly = async () => {
    const cleaned = buildCleanBairros();
    await saveBairrosEntrega(cleaned);
    setBairrosDirty(false);
    return cleaned;
  };

  const saveConfigOnly = async () => {
    await saveAppSettings(appInfoDraft);
    setConfigDirty(false);
  };

  const saveAiOnly = async () => {
    const cleaned = buildAiDefaults(aiDraft);
    await saveChatbotAiSettings(cleaned);
    setAiDirty(false);
    return cleaned;
  };

  const handleSyncAll = async ({ silent = false, includeDrafts = false } = {}) => {
    try {
      if (!silent) {
        setSyncStatus('Sincronizando dados do robo...');
      }
      let bairrosOverride;
      let appInfoOverride;
      let aiOverride;
      if (includeDrafts) {
        if (bairrosDirty) {
          bairrosOverride = await saveBairrosOnly();
        }
        if (configDirty) {
          await saveConfigOnly();
          appInfoOverride = appInfoDraft;
        }
        if (aiDirty) {
          aiOverride = await saveAiOnly();
        }
      }
      await handleSyncBairros({ silent: true, bairrosOverride });
      await handleSyncConfig({ silent: true, appInfoOverride });
      await handleSyncCatalogo({ silent: true });
      await handleSyncAi({ silent: true, aiOverride });
      if (!silent) {
        setSyncStatus('Dados do robo sincronizados com sucesso.');
      }
    } catch (error) {
      if (!silent) {
        setSyncStatus(error.message || 'Falha ao sincronizar o robo.');
      }
    }
  };

  const fetchBotStatus = async () => {
    if (!normalizedBotBaseUrl) return null;
    const response = await fetch(normalizedBotBaseUrl);
    if (!response.ok) {
      throw new Error(`Falha ao ler status (${response.status}).`);
    }
    const data = await response.json();
    const status = typeof data?.status === 'string' ? data.status : '';
    setBotStatus(status);
    setBotOnline(status ? status === 'conectado' : null);
    return status;
  };

  useEffect(() => {
    if (!normalizedBotBaseUrl || !botOnline) return;
    handleSyncBairros({ silent: true }).catch(() => {});
  }, [normalizedBotBaseUrl, botOnline, snapshot.settings?.bairros?.length]);

  useEffect(() => {
    if (!normalizedBotBaseUrl || !botOnline) return;
    handleSyncCatalogo({ silent: true }).catch(() => {});
  }, [normalizedBotBaseUrl, botOnline, snapshot.publishedProducts?.length, snapshot.products?.length]);

  useEffect(() => {
    if (!normalizedBotBaseUrl) return;
    fetchBotBairros().catch(() => {});
    fetchBotCatalogo().catch(() => {});
  }, [normalizedBotBaseUrl, botQrNonce]);

  useEffect(() => {
    if (!normalizedBotBaseUrl) return undefined;
    let alive = true;
    const pollStatus = () => {
      fetchBotStatus().catch(() => {
        if (alive) {
          setBotOnline(null);
          setBotStatus('');
        }
      });
    };
    pollStatus();
    const interval = setInterval(pollStatus, 6000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [normalizedBotBaseUrl]);

  useEffect(() => {
    if (!botOnline || autoSyncRef.current) return;
    autoSyncRef.current = true;
    handleSyncAll({ silent: false, includeDrafts: true });
  }, [botOnline]);

  useEffect(() => {
    if (botOnline === false) {
      autoSyncRef.current = false;
    }
  }, [botOnline]);

  useEffect(() => {
    autoSyncRef.current = false;
  }, [botQrNonce, normalizedBotBaseUrl]);

  useEffect(() => {
    setBotQrError(false);
  }, [botQrImageUrl]);

  const botStatusLabel =
    botStatus === 'conectado'
      ? 'online'
      : botStatus === 'qr_disponivel'
        ? 'QR disponivel'
        : botStatus === 'aguardando_qr'
          ? 'aguardando QR'
          : botStatus
            ? botStatus
            : 'verificando...';

  const normalizeText = (value) =>
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const buildBairroId = (value) =>
    normalizeText(value)
      .trim()
      .replace(/\s+/g, '-');

  const formatBairros = (items) => {
    if (!items.length) return 'Nenhum bairro cadastrado no painel.';
    return items
      .map(
        (bairro) =>
          `- ${bairro.nome} | Taxa: ${deliveryFormatting.formatCurrency(bairro.taxaEntrega)} | Tempo: ${bairro.tempoMedio}`,
      )
      .join('\n');
  };

  const buildBotReply = (text) => {
    const normalized = normalizeText(text);
    const matchedBairro = bairrosAtendidos.find((bairro) =>
      normalized.includes(normalizeText(bairro.nome)),
    );

    if (!normalized || normalized.includes('menu')) {
      return menuText;
    }

    if (normalized.startsWith('1') || normalized.includes('taxa')) {
      if (matchedBairro) {
        return `Taxa de entrega para ${matchedBairro.nome}: ${deliveryFormatting.formatCurrency(
          matchedBairro.taxaEntrega,
        )}.`;
      }
      return ['Taxas por bairro:', formatBairros(bairrosAtendidos)].join('\n');
    }

    if (normalized.startsWith('2') || normalized.includes('bairro')) {
      return ['Bairros atendidos:', formatBairros(bairrosAtendidos)].join('\n');
    }

    if (normalized.startsWith('3') || normalized.includes('horario') || normalized.includes('funcionamento')) {
      return appInfo.horarioFuncionamento
        ? `Horario de funcionamento: ${appInfo.horarioFuncionamento}.`
        : 'Horario de funcionamento nao configurado.';
    }

    if (normalized.startsWith('4') || normalized.includes('endereco')) {
      return appInfo.enderecoLoja
        ? `Endereco fisico da loja: ${appInfo.enderecoLoja}.`
        : 'Endereco da loja nao configurado.';
    }

    if (normalized.startsWith('5') || normalized.includes('atendente') || normalized.includes('humano')) {
      return 'Um atendente vai falar com voce. Envie seu nome e telefone para agilizar.';
    }

    return ['Nao entendi sua mensagem.', menuText].join('\n');
  };

  const pushMessage = (role, content) => {
    setMessages((current) => [
      ...current,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role,
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const handleSendMessage = (value) => {
    const text = String(value ?? messageInput).trim();
    if (!text) return;
    pushMessage('user', text);
    setMessageInput('');
    const reply = buildBotReply(text);
    pushMessage('bot', reply);
  };

  const menuActions = [
    { key: 'menu', label: 'Menu', icon: MessageSquare },
    { key: 'taxa', label: 'Taxa de entrega', icon: Bot },
    { key: 'bairros', label: 'Bairros atendidos', icon: MapPin },
    { key: 'horario', label: 'Horario', icon: Clock },
    { key: 'endereco', label: 'Endereco da loja', icon: MapPin },
    { key: 'atendente', label: 'Falar com atendente', icon: PhoneCall },
  ];

  const handleQuickMessage = (key) => {
    switch (key) {
      case 'menu':
        handleSendMessage('menu');
        break;
      case 'taxa':
        handleSendMessage('taxa de entrega');
        break;
      case 'bairros':
        handleSendMessage('bairros atendidos');
        break;
      case 'horario':
        handleSendMessage('horario de funcionamento');
        break;
      case 'endereco':
        handleSendMessage('endereco fisico da loja');
        break;
      case 'atendente':
        handleSendMessage('falar com atendente');
        break;
      default:
        handleSendMessage(key);
    }
  };

  const sampleProduct = snapshot.products.find((item) =>
    item.descricao.toLowerCase().includes('coca cola'),
  );

  const handleToggleEditor = (key) => {
    setActiveEditor((current) => {
      const next = current === key ? '' : key;
      if (next) {
        setTimeout(() => {
          editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
      }
      return next;
    });
  };

  const handleAddBairro = () => {
    setBairrosDraft((current) => [
      ...current,
      { id: '', nome: '', taxaEntrega: '', tempoMedio: '' },
    ]);
    setBairrosDirty(true);
  };

  const handleUpdateBairro = (index, patch) => {
    setBairrosDraft((current) =>
      current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
    setBairrosDirty(true);
  };

  const handleRemoveBairro = (index) => {
    setBairrosDraft((current) => current.filter((_, idx) => idx !== index));
    setBairrosDirty(true);
  };

  const handleSaveBairros = async () => {
    setSavingBairros(true);
    try {
      const cleaned = await saveBairrosOnly();
      await handleSyncBairros({ silent: false, bairrosOverride: cleaned });
    } catch (error) {
      setSyncStatus(error.message || 'Falha ao salvar bairros.');
    } finally {
      setSavingBairros(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await saveConfigOnly();
      await handleSyncConfig({ silent: false, appInfoOverride: appInfoDraft });
    } catch (error) {
      setSyncStatus(error.message || 'Falha ao salvar configuracoes.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveAi = async () => {
    setSavingAi(true);
    try {
      const cleaned = await saveAiOnly();
      await handleSyncAi({ silent: false, aiOverride: cleaned });
    } catch (error) {
      setSyncStatus(error.message || 'Falha ao salvar IA.');
    } finally {
      setSavingAi(false);
    }
  };

  const handleSyncBairrosFromDrafts = async () => {
    try {
      let bairrosOverride;
      if (bairrosDirty) {
        bairrosOverride = await saveBairrosOnly();
      }
      await handleSyncBairros({ silent: false, bairrosOverride });
    } catch (error) {
      setSyncStatus(error.message || 'Falha ao sincronizar bairros.');
    }
  };

  const handleSyncConfigFromDrafts = async () => {
    try {
      let appInfoOverride;
      if (configDirty) {
        await saveConfigOnly();
        appInfoOverride = appInfoDraft;
      }
      await handleSyncConfig({ silent: false, appInfoOverride });
    } catch (error) {
      setSyncStatus(error.message || 'Falha ao sincronizar configuracoes.');
    }
  };

  const handleSyncAiFromDrafts = async () => {
    try {
      let aiOverride;
      if (aiDirty) {
        aiOverride = await saveAiOnly();
      }
      await handleSyncAi({ silent: false, aiOverride });
    } catch (error) {
      setSyncStatus(error.message || 'Falha ao sincronizar IA.');
    }
  };

  const quickActions = [
    {
      key: 'produtos',
      label: 'Listar produtos',
      icon: List,
      action: () => chatbotApi.getProdutos(),
    },
    {
      key: 'buscar-coca',
      label: 'Buscar Coca Cola',
      icon: PackageSearch,
      action: () => chatbotApi.buscarProduto('coca cola'),
    },
    {
      key: 'categorias',
      label: 'Listar categorias',
      icon: Shapes,
      action: () => chatbotApi.getCategorias(),
    },
    {
      key: 'pedidos',
      label: 'Listar pedidos',
      icon: ShoppingBag,
      action: () => chatbotApi.getPedidos(),
    },
    {
      key: 'bairros',
      label: 'Listar bairros',
      icon: MapPin,
      action: () => chatbotApi.getBairrosEntrega(),
    },
    {
      key: 'taxa',
      label: 'Taxa por bairro',
      icon: Bot,
      action: () => chatbotApi.getTaxaEntrega(bairrosAtendidos[0]?.nome || ''),
    },
    {
      key: 'horario',
      label: 'Horario de funcionamento',
      icon: Clock,
      action: () => chatbotApi.getHorarioFuncionamento(),
    },
    {
      key: 'endereco',
      label: 'Endereco da loja',
      icon: MapPin,
      action: () => chatbotApi.getEnderecoLoja(),
    },
    {
      key: 'pedido-teste',
      label: 'Criar pedido teste',
      icon: Bot,
      action: () =>
        chatbotApi.criarPedido({
          cliente: 'João',
          telefone: '(31) 99999-0000',
          itens: [
            {
              id: sampleProduct?.id || snapshot.products[0]?.id || '123',
              produto: sampleProduct?.descricao || snapshot.products[0]?.descricao || 'Coca Cola',
              quantidade: 2,
              preco_unitario: Number(sampleProduct?.valor_venda || snapshot.products[0]?.valor_venda || 4.5),
            },
          ],
          forma_pagamento: 'PIX',
          valor_total: Number(sampleProduct?.valor_venda || snapshot.products[0]?.valor_venda || 4.5) * 2,
          endereco: 'Rua Exemplo 123',
          bairro: 'Centro',
          data: new Date().toISOString(),
        }),
    },
  ];

  return (
    <ModuleShell
      title="Chatbot API"
      subtitle="Teste os endpoints simulados para integração com chatbot"
    >
      <Helmet>
        <title>Chatbot API - FORTIN ERP PRO</title>
      </Helmet>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <PanelCard
          title="Agente de IA"
          subtitle="Respostas automaticas integradas ao painel de delivery e personalizacao do app."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {menuActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.key}
                    type="button"
                    onClick={() => handleQuickMessage(action.key)}
                    className="bg-[var(--layout-surface-2)] text-white hover:bg-[var(--layout-border)]"
                  >
                    <Icon className="mr-2 h-4 w-4 text-[var(--layout-accent)]" />
                    {action.label}
                  </Button>
                );
              })}
            </div>

            <div className="min-h-[280px] space-y-3 rounded-xl border border-[var(--layout-border)] bg-[var(--layout-bg)] p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'bg-[var(--layout-accent)] text-white'
                        : 'bg-[var(--layout-surface-2)] text-gray-100'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                placeholder="Digite a mensagem do cliente..."
                className="flex-1 rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-4 py-3 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
              />
              <Button
                type="button"
                onClick={() => handleSendMessage()}
                className="bg-[var(--layout-accent)] text-white hover:bg-[var(--layout-accent-strong)]"
              >
                Enviar mensagem
              </Button>
            </div>

            <div
              ref={editorRef}
              className="rounded-xl border border-[var(--layout-border)] bg-[var(--layout-bg)] p-4"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                Editar dados do robo
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    handleToggleEditor('bairros');
                    handleSyncBairrosFromDrafts();
                  }}
                  className={`${
                    activeEditor === 'bairros'
                      ? 'bg-[var(--layout-accent)] text-white'
                      : 'bg-[var(--layout-surface-2)] text-white hover:bg-[var(--layout-border)]'
                  }`}
                >
                  Taxa de entrega
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    handleToggleEditor('bairros');
                    handleSyncBairrosFromDrafts();
                  }}
                  className={`${
                    activeEditor === 'bairros'
                      ? 'bg-[var(--layout-accent)] text-white'
                      : 'bg-[var(--layout-surface-2)] text-white hover:bg-[var(--layout-border)]'
                  }`}
                >
                  Bairros atendidos
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    handleToggleEditor('config');
                    handleSyncConfigFromDrafts();
                  }}
                  className={`${
                    activeEditor === 'config'
                      ? 'bg-[var(--layout-accent)] text-white'
                      : 'bg-[var(--layout-surface-2)] text-white hover:bg-[var(--layout-border)]'
                  }`}
                >
                  Horario de funcionamento
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    handleToggleEditor('config');
                    handleSyncConfigFromDrafts();
                  }}
                  className={`${
                    activeEditor === 'config'
                      ? 'bg-[var(--layout-accent)] text-white'
                      : 'bg-[var(--layout-surface-2)] text-white hover:bg-[var(--layout-border)]'
                  }`}
                >
                  Endereco fisico da loja
                </Button>
              </div>

              {activeEditor === 'bairros' ? (
                <div className="mt-4 space-y-3">
                  {bairrosDraft.length === 0 ? (
                    <div className="text-sm text-[var(--layout-text-muted)]">
                      Nenhum bairro cadastrado.
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    {bairrosDraft.map((bairro, index) => (
                      <div
                        key={`${bairro.id || 'novo'}-${index}`}
                        className="grid gap-3 rounded-lg border border-[var(--layout-border)] bg-[var(--layout-surface-2)] p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
                      >
                        <input
                          value={bairro.nome || ''}
                          onChange={(event) => handleUpdateBairro(index, { nome: event.target.value })}
                          placeholder="Nome do bairro"
                          className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                        />
                        <input
                          value={bairro.taxaEntrega ?? ''}
                          onChange={(event) => handleUpdateBairro(index, { taxaEntrega: event.target.value })}
                          placeholder="Taxa"
                          className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                        />
                        <input
                          value={bairro.tempoMedio ?? ''}
                          onChange={(event) => handleUpdateBairro(index, { tempoMedio: event.target.value })}
                          placeholder="Tempo"
                          className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                        />
                        <Button
                          type="button"
                          onClick={() => handleRemoveBairro(index)}
                          className="bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                        >
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={handleAddBairro}
                      className="bg-[var(--layout-surface-2)] text-white hover:bg-[var(--layout-border)]"
                    >
                      Adicionar bairro
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveBairros}
                      className="bg-emerald-500 text-white hover:bg-emerald-400"
                    >
                      {savingBairros ? 'Salvando...' : 'Salvar bairros'}
                    </Button>
                  </div>
                </div>
              ) : null}

              {activeEditor === 'config' ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-2 block text-sm text-[var(--layout-text-muted)]">
                      Horario de funcionamento
                    </label>
                    <textarea
                      value={appInfoDraft.horarioFuncionamento || ''}
                      onChange={(event) => {
                        setConfigDirty(true);
                        setAppInfoDraft((current) => ({
                          ...current,
                          horarioFuncionamento: event.target.value,
                        }));
                      }}
                      rows={4}
                      className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-[var(--layout-text-muted)]">
                      Endereco fisico da loja
                    </label>
                    <textarea
                      value={appInfoDraft.enderecoLoja || ''}
                      onChange={(event) => {
                        setConfigDirty(true);
                        setAppInfoDraft((current) => ({
                          ...current,
                          enderecoLoja: event.target.value,
                        }));
                      }}
                      rows={3}
                      className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleSaveConfig}
                    className="bg-sky-500 text-white hover:bg-sky-400"
                  >
                    {savingConfig ? 'Salvando...' : 'Salvar configuracoes'}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </PanelCard>

        <PanelCard
          title="Conectar WhatsApp"
          subtitle="Use o QR real do bot WhatsApp (whatsapp-web.js) para autenticar."
        >
          <div className="flex flex-col items-center gap-4 rounded-xl border border-[var(--layout-border)] bg-[var(--layout-bg)] p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--layout-surface-2)]">
              <QrCode className="h-6 w-6 text-[var(--layout-accent)]" />
            </div>
            <div className="text-sm text-[var(--layout-text-muted)]">
              Escaneie este QR no WhatsApp Web para conectar.
            </div>
            <div className="w-full rounded-xl border border-[var(--layout-border)] bg-[var(--layout-surface-2)] p-4 text-left">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                URL do bot WhatsApp
              </label>
              <input
                value={botBaseUrl}
                onChange={(event) => setBotBaseUrl(event.target.value)}
                placeholder="http://localhost:3333"
                className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
              />
              <div className="mt-2 text-xs text-[var(--layout-text-muted)]">
                Exemplo: `http://localhost:3333`, `http://localhost:3001/qr` ou `http://localhost:3001/qr.png`.
              </div>
            </div>

            <div className="relative h-48 w-48 rounded-xl border border-[var(--layout-border)] bg-white p-2">
              <div className="relative h-full w-full">
                <img
                  src={botQrImageUrl}
                  alt="QR code WhatsApp"
                  className="h-full w-full rounded-lg object-contain"
                  onError={() => setBotQrError(true)}
                  onLoad={() => setBotQrError(false)}
                />
                <img
                  src="/qr-overlay.svg"
                  alt="QR code sobreposto"
                  className="pointer-events-none absolute inset-0 h-full w-full rounded-lg object-contain opacity-0"
                />
              </div>
            </div>
            {botQrError ? (
              <div className="text-xs text-rose-300">
                Nao foi possivel carregar o QR. Verifique se o link responde uma imagem PNG.
              </div>
            ) : null}
            {isMixedContent ? (
              <div className="text-xs text-amber-300">
                Seu painel esta em HTTPS e o QR esta em HTTP. O navegador pode bloquear a imagem.
              </div>
            ) : null}

            <Button
              type="button"
              onClick={() => setBotQrNonce(Date.now())}
              className="bg-[var(--layout-surface-2)] text-white hover:bg-[var(--layout-border)]"
            >
              Atualizar QR code
            </Button>

            <Button
              type="button"
              onClick={() => window.open(botQrPageUrl, '_blank', 'noopener,noreferrer')}
              className="bg-[var(--layout-accent)] text-white hover:bg-[var(--layout-accent-strong)]"
            >
              Abrir painel do QR
            </Button>

            <div className="w-full rounded-xl border border-[var(--layout-border)] bg-[var(--layout-bg)] p-4 text-left">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                Personalizar robo
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => handleToggleEditor('bairros')}
                  className={`${
                    activeEditor === 'bairros'
                      ? 'bg-[var(--layout-accent)] text-white'
                      : 'bg-emerald-500 text-white hover:bg-emerald-400'
                  }`}
                >
                  Taxa de entrega
                </Button>
                <Button
                  type="button"
                  onClick={() => handleToggleEditor('bairros')}
                  className={`${
                    activeEditor === 'bairros'
                      ? 'bg-[var(--layout-accent)] text-white'
                      : 'bg-emerald-500 text-white hover:bg-emerald-400'
                  }`}
                >
                  Bairros atendidos
                </Button>
                <Button
                  type="button"
                  onClick={() => handleToggleEditor('config')}
                  className={`${
                    activeEditor === 'config'
                      ? 'bg-[var(--layout-accent)] text-white'
                      : 'bg-sky-500 text-white hover:bg-sky-400'
                  }`}
                >
                  Horario de funcionamento
                </Button>
                <Button
                  type="button"
                  onClick={() => handleToggleEditor('config')}
                  className={`${
                    activeEditor === 'config'
                      ? 'bg-[var(--layout-accent)] text-white'
                      : 'bg-sky-500 text-white hover:bg-sky-400'
                  }`}
                >
                  Endereco fisico da loja
                </Button>
                <Button
                  type="button"
                  onClick={() => handleQuickMessage('atendente')}
                  className="bg-[var(--layout-surface-2)] text-white hover:bg-[var(--layout-border)]"
                >
                  Falar com atendente
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSyncAll({ includeDrafts: true })}
                  className="bg-[var(--layout-accent)] text-white hover:bg-[var(--layout-accent-strong)]"
                >
                  Sincronizar tudo
                </Button>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => fetchBotBairros().catch(() => setBotBairrosTotal(null))}
              className="bg-[var(--layout-surface-2)] text-white hover:bg-[var(--layout-border)]"
            >
              Recarregar bairros do bot
            </Button>
            <div className="text-xs text-[var(--layout-text-muted)]">
              {botBairrosTotal === null
                ? 'Bairros no bot: carregando...'
                : `Bairros no bot: ${botBairrosTotal}`}
            </div>
            <div
              className={`text-xs font-semibold ${
                botOnline === null
                  ? 'text-[var(--layout-text-muted)]'
                  : botOnline
                    ? 'text-emerald-300'
                    : 'text-rose-300'
              }`}
            >
              {botOnline === null
                ? 'Status do bot: verificando...'
                : botOnline
                  ? 'Status do bot: online'
                  : `Status do bot: ${botStatusLabel}`}
            </div>
            {syncStatus ? (
              <div className="text-xs text-[var(--layout-text-muted)]">{syncStatus}</div>
            ) : null}
          </div>
        </PanelCard>

        <PanelCard
          title="IA e Catálogo"
          subtitle="Configure o agente de IA e sincronize o estoque com o bot."
        >
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--layout-border)] bg-[var(--layout-bg)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                Agente de IA
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border border-[var(--layout-border)] bg-[var(--layout-surface-2)] px-3 py-3">
                  <span className="text-sm text-[var(--layout-text-muted)]">IA ativa</span>
                  <input
                    type="checkbox"
                    checked={aiDraft.enabled}
                    onChange={(event) => {
                      setAiDirty(true);
                      setAiDraft((current) => ({ ...current, enabled: event.target.checked }));
                    }}
                    className="h-5 w-5 accent-[var(--layout-accent)]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                    Modo da IA
                  </label>
                  <select
                    value={aiDraft.mode}
                    onChange={(event) => {
                      setAiDirty(true);
                      setAiDraft((current) => ({ ...current, mode: event.target.value }));
                    }}
                    className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                  >
                    <option value="fallback">Somente quando não entender</option>
                    <option value="always">Responder tudo</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                    Provedor
                  </label>
                  <select
                    value={aiDraft.provider}
                    onChange={(event) => {
                      setAiDirty(true);
                      setAiDraft((current) => ({ ...current, provider: event.target.value }));
                    }}
                    className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                  >
                    <option value="custom">API personalizada</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                    Temperatura
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={aiDraft.temperature}
                    onChange={(event) => {
                      setAiDirty(true);
                      setAiDraft((current) => ({ ...current, temperature: event.target.value }));
                    }}
                    className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                  />
                </div>
              </div>

              {aiDraft.provider === 'custom' ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                      Endpoint da IA
                    </label>
                    <input
                      value={aiDraft.endpoint}
                      onChange={(event) => {
                        setAiDirty(true);
                        setAiDraft((current) => ({ ...current, endpoint: event.target.value }));
                      }}
                      placeholder="https://sua-api.com/agent"
                      className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                      Tipo de Auth
                    </label>
                    <select
                      value={aiDraft.authType}
                      onChange={(event) => {
                        setAiDirty(true);
                        setAiDraft((current) => ({ ...current, authType: event.target.value }));
                      }}
                      className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                    >
                      <option value="bearer">Bearer</option>
                      <option value="header">Header personalizado</option>
                      <option value="basic">Basic</option>
                      <option value="none">Sem auth</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                      Token / Valor do Header
                    </label>
                    <input
                      value={aiDraft.headerValue}
                      onChange={(event) => {
                        setAiDirty(true);
                        setAiDraft((current) => ({ ...current, headerValue: event.target.value }));
                      }}
                      placeholder="token ou senha"
                      className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                    />
                  </div>
                  {aiDraft.authType === 'header' ? (
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                        Nome do Header
                      </label>
                      <input
                        value={aiDraft.headerName}
                        onChange={(event) => {
                          setAiDirty(true);
                          setAiDraft((current) => ({ ...current, headerName: event.target.value }));
                        }}
                        placeholder="x-api-key"
                        className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                      />
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                      Campo da mensagem
                    </label>
                    <input
                      value={aiDraft.payloadKey}
                      onChange={(event) => {
                        setAiDirty(true);
                        setAiDraft((current) => ({ ...current, payloadKey: event.target.value }));
                      }}
                      placeholder="message"
                      className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                      Caminho da resposta
                    </label>
                    <input
                      value={aiDraft.responsePath}
                      onChange={(event) => {
                        setAiDirty(true);
                        setAiDraft((current) => ({ ...current, responsePath: event.target.value }));
                      }}
                      placeholder="reply ou data.answer"
                      className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={aiDraft.apiKey}
                      onChange={(event) => {
                        setAiDirty(true);
                        setAiDraft((current) => ({ ...current, apiKey: event.target.value }));
                      }}
                      placeholder="chave da API"
                      className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                      Modelo
                    </label>
                    <input
                      value={aiDraft.model}
                      onChange={(event) => {
                        setAiDirty(true);
                        setAiDraft((current) => ({ ...current, model: event.target.value }));
                      }}
                      placeholder={aiDraft.provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini'}
                      className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                  Prompt do sistema (opcional)
                </label>
                <textarea
                  value={aiDraft.systemPrompt}
                  onChange={(event) => {
                    setAiDirty(true);
                    setAiDraft((current) => ({ ...current, systemPrompt: event.target.value }));
                  }}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleSaveAi}
                  className="bg-[var(--layout-accent)] text-white hover:bg-[var(--layout-accent-strong)]"
                >
                  {savingAi ? 'Salvando...' : 'Salvar IA'}
                </Button>
                <Button
                  type="button"
                  onClick={handleSyncAiFromDrafts}
                  className="bg-[var(--layout-surface-2)] text-white hover:bg-[var(--layout-border)]"
                >
                  Sincronizar IA
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--layout-border)] bg-[var(--layout-bg)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
                Catálogo do bot
              </div>
              <div className="mt-2 text-sm text-[var(--layout-text-muted)]">
                Itens prontos para sincronizar: {catalogItems.length}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => handleSyncCatalogo({ silent: false })}
                  className="bg-[var(--layout-accent)] text-white hover:bg-[var(--layout-accent-strong)]"
                >
                  Sincronizar catálogo
                </Button>
                <Button
                  type="button"
                  onClick={() => fetchBotCatalogo().catch(() => setBotCatalogTotal(null))}
                  className="bg-[var(--layout-surface-2)] text-white hover:bg-[var(--layout-border)]"
                >
                  Recarregar catálogo do bot
                </Button>
              </div>
              <div className="mt-2 text-xs text-[var(--layout-text-muted)]">
                {botCatalogTotal === null
                  ? 'Itens no bot: carregando...'
                  : `Itens no bot: ${botCatalogTotal}`}
              </div>
            </div>
          </div>
        </PanelCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <PanelCard
          title="Ações rápidas"
          subtitle="Simule integrações com WhatsApp, Telegram ou bot próprio usando os dados atuais do ERP."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.key}
                  onClick={() => runAction(item.key, item.action)}
                  className="justify-start bg-[var(--layout-surface-2)] py-6 text-left text-white hover:bg-[var(--layout-border)]"
                >
                  <Icon className="mr-2 h-4 w-4 text-[var(--layout-accent)]" />
                  {loadingAction === item.key ? 'Executando...' : item.label}
                </Button>
              );
            })}
          </div>
        </PanelCard>

        <PanelCard
          title="Fontes conectadas"
          subtitle="A API simulada lê dados do ERP e do hub de pedidos delivery."
        >
          <div className="space-y-3 text-sm text-[var(--layout-text-muted)]">
            <div className="flex items-center justify-between rounded-lg bg-[var(--layout-surface-2)] px-4 py-3">
              <span>Produtos</span>
              <span>{snapshot.products.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--layout-surface-2)] px-4 py-3">
              <span>Categorias</span>
              <span>{snapshot.categories.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--layout-surface-2)] px-4 py-3">
              <span>Pedidos</span>
              <span>{snapshot.orders.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--layout-surface-2)] px-4 py-3">
              <span>Clientes</span>
              <span>{snapshot.people.length}</span>
            </div>
          </div>
        </PanelCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <PanelCard
          title="Resposta JSON"
          subtitle="Retorno atual do endpoint simulado"
          className="min-h-[420px]"
        >
          <div className="rounded-xl border border-[var(--layout-border)] bg-[var(--layout-bg)] p-4">
            <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-sm leading-6 text-[#7dd3fc]">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        </PanelCard>

        <PanelCard
          title="Exemplos de uso"
          subtitle="Métodos disponíveis em window.chatbotApi"
          actions={
            <div className="rounded-lg border border-[var(--layout-accent)]/30 bg-[var(--layout-accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--layout-accent)]">
              window.chatbotApi ativo
            </div>
          }
        >
          <div className="rounded-xl border border-[var(--layout-border)] bg-[var(--layout-bg)] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--layout-text-muted)]">
              <TerminalSquare className="h-4 w-4 text-[var(--layout-accent)]" />
              Console / integração externa
            </div>
            <pre className="overflow-auto whitespace-pre-wrap font-mono text-sm leading-6 text-gray-200">
              {exampleCode}
            </pre>
          </div>
        </PanelCard>
      </div>
    </ModuleShell>
  );
};

export default ChatbotApiPage;
