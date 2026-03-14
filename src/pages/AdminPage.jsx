import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ChartColumn,
  ClipboardList,
  ImageUp,
  LogOut,
  MapPinned,
  MessageCircle,
  Package,
  Percent,
  RefreshCcw,
  QrCode,
  Smartphone,
  Users
} from "lucide-react";
import { api, socket } from "../api";
import BrandLogo from "../components/BrandLogo";
import MetricCard from "../components/MetricCard";
import { STATUS_STEPS } from "../components/StatusTimeline";

const TOKEN_KEY = "turbo_admin_token";

const tabs = [
  { key: "orders", label: "Pedidos", icon: ClipboardList },
  { key: "products", label: "Produtos", icon: Package },
  { key: "promotions", label: "Promocoes", icon: Percent },
  { key: "customers", label: "Clientes", icon: Users },
  { key: "operations", label: "Operacao", icon: ChartColumn }
];

const imageByCategory = {
  Cervejas: "/products/beer.svg",
  Refrigerantes: "/products/soda.svg",
  Energeticos: "/products/energy.svg",
  Aguas: "/products/water.svg",
  Sucos: "/products/juice.svg",
  Destilados: "/products/spirit.svg",
  "Combos e promocoes": "/products/combo.svg"
};

const defaultProductForm = () => ({
  name: "",
  category: "Cervejas",
  volume: "",
  purchasePrice: "",
  salePrice: "",
  stock: 0,
  active: true,
  featured: false,
  badge: "",
  description: "",
  image: "/products/beer.svg"
});
const getProductFormState = (product = {}) => ({
  ...defaultProductForm(),
  ...product,
  purchasePrice: product.purchasePrice ?? product.originalPrice ?? "",
  salePrice: product.salePrice ?? product.price ?? ""
});

const defaultPromotionForm = {
  type: "daily",
  title: "",
  description: "",
  code: "",
  discountType: "fixed",
  discountValue: 0,
  minimumOrder: 0,
  neighborhood: "",
  active: true,
  highlight: ""
};

const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
const formatDate = (value) => new Date(value).toLocaleString("pt-BR");
const defaultProductImages = new Set(Object.values(imageByCategory));
const getCategoryImage = (category) => imageByCategory[category] || "/products/combo.svg";
const isDefaultProductImage = (image) => defaultProductImages.has(image);
const getProductImageHint = (image) =>
  image?.startsWith("data:image/png")
    ? "PNG personalizado pronto para salvar."
    : "Usando a imagem padrao da categoria.";

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem PNG."));
    reader.readAsDataURL(file);
  });

const getWhatsAppMeta = (status) => {
  if (!status?.enabled) {
    return {
      label: "Desativado",
      hint: "Ative o modulo para usar automacao",
      tone: "is-disabled",
      badgeClass: "is-disabled"
    };
  }

  if (status.connected) {
    return {
      label: "Conectado",
      hint: "Pronto para receber e enviar mensagens",
      tone: "is-online",
      badgeClass: "is-online"
    };
  }

  if (status.hasQr) {
    return {
      label: "QR disponivel",
      hint: "Escaneie para reconectar o bot",
      tone: "is-pending",
      badgeClass: "is-pending"
    };
  }

  return {
    label: "Aguardando conexao",
    hint: "Gerando QR ou reiniciando sessao",
    tone: "is-pending",
    badgeClass: "is-pending"
  };
};

function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [loginForm, setLoginForm] = useState({ username: "admin", password: "123456" });
  const [activeTab, setActiveTab] = useState("orders");
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [reports, setReports] = useState(null);
  const [productForm, setProductForm] = useState(defaultProductForm);
  const [promotionForm, setPromotionForm] = useState(defaultPromotionForm);
  const [editingProductId, setEditingProductId] = useState("");
  const [editingPromotionId, setEditingPromotionId] = useState("");
  const [feeRows, setFeeRows] = useState([]);

  const refreshWhatsAppStatus = async (silent = false) => {
    try {
      const status = await api.getWhatsAppStatus();
      setDashboard((current) => (current ? { ...current, whatsapp: status } : current));
      if (!silent) {
        setMessage("Status do WhatsApp atualizado.");
      }
    } catch (error) {
      if (!silent) {
        setMessage(error.message);
      }
    }
  };

  const loadData = async (currentToken = token, silent = false) => {
    if (!currentToken) {
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    const [dashboardPayload, ordersPayload, customersPayload, reportsPayload] = await Promise.all([
      api.getDashboard(currentToken),
      api.getOrders(currentToken),
      api.getCustomers(currentToken),
      api.getReports(currentToken)
    ]);

    setDashboard(dashboardPayload);
    setOrders(ordersPayload);
    setCustomers(customersPayload);
    setReports(reportsPayload);
    setFeeRows(
      Object.entries(dashboardPayload.deliveryFees || {}).map(([name, value]) => ({
        name,
        value
      }))
    );

    if (!silent) {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let mounted = true;

    const boot = async () => {
      try {
        await loadData(token);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setLoading(false);
        setMessage(error.message);
        if (String(error.message).toLowerCase().includes("autorizado")) {
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
        }
      }
    };

    boot();
    socket.emit("admin:subscribe", token);

    const refresh = async () => {
      if (!mounted) {
        return;
      }
      try {
        await loadData(token, true);
      } catch (error) {
        if (mounted) {
          setMessage(error.message);
        }
      }
    };

    socket.on("dashboard:update", refresh);
    socket.on("order:updated", refresh);

    const whatsappInterval = window.setInterval(() => {
      refreshWhatsAppStatus(true);
    }, 15000);

    return () => {
      mounted = false;
      socket.off("dashboard:update", refresh);
      socket.off("order:updated", refresh);
      window.clearInterval(whatsappInterval);
    };
  }, [token]);

  const runAction = async (action, successMessage) => {
    setSaving(true);
    setMessage("");
    try {
      await action();
      await loadData(token);
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setMessage("");
    try {
      const payload = await api.adminLogin(loginForm);
      localStorage.setItem(TOKEN_KEY, payload.token);
      setToken(payload.token);
    } catch (error) {
      setLoading(false);
      setMessage(error.message);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setDashboard(null);
    setOrders([]);
    setCustomers([]);
    setReports(null);
    setMessage("");
  };

  if (!token) {
    return (
      <div className="page-shell centered admin-login">
        <div className="login-card">
          <BrandLogo
            subtitle="Loja, pedidos e WhatsApp em tempo real"
            variant="login"
            className="login-brand"
          />
          <span className="eyebrow">Painel da distribuidora</span>
          <h1>Operacao em tempo real</h1>
          <p>Controle pedidos, clientes, estoque e automacao do WhatsApp em um unico lugar.</p>
          <div className="field-grid single">
            <label>
              Usuario
              <input
                value={loginForm.username}
                onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
          </div>
          <button type="button" className="button button-primary button-block" onClick={handleLogin} disabled={loading}>
            {loading ? "Entrando..." : "Entrar no painel"}
          </button>
          <Link to="/" className="button button-outline button-block">
            Voltar para loja
          </Link>
          {message ? <div className="toast-inline">{message}</div> : null}
        </div>
      </div>
    );
  }

  if (loading || !dashboard || !reports) {
    return (
      <div className="page-shell admin">
        <header className="admin-header">
          <div className="admin-brand">
            <BrandLogo subtitle="Painel operacional" variant="admin" to="/" />
            <div>
              <span className="eyebrow">Dashboard operacional</span>
              <h1>Turbo Drinks Admin</h1>
            </div>
          </div>
        </header>
        <div className="loading-card admin-loading">
          <span className="eyebrow">Carregando painel</span>
          <h2>Sincronizando operacao</h2>
        </div>
      </div>
    );
  }

  const categories = [...new Set(dashboard.products.map((product) => product.category))];
  const whatsappStatus = dashboard.whatsapp;
  const whatsappMeta = getWhatsAppMeta(whatsappStatus);
  const deliveryBoard = orders.filter((order) => order.status === "out_for_delivery");

  const saveProduct = async () => {
    const ok = await runAction(
      () =>
        editingProductId
          ? api.updateProduct(token, editingProductId, productForm)
          : api.createProduct(token, productForm),
      editingProductId ? "Produto atualizado." : "Produto cadastrado."
    );

    if (ok) {
      setProductForm(defaultProductForm());
      setEditingProductId("");
    }
  };

  const savePromotion = async () => {
    const ok = await runAction(
      () =>
        editingPromotionId
          ? api.updatePromotion(token, editingPromotionId, promotionForm)
          : api.createPromotion(token, promotionForm),
      editingPromotionId ? "Promocao atualizada." : "Promocao criada."
    );

    if (ok) {
      setPromotionForm(defaultPromotionForm);
      setEditingPromotionId("");
    }
  };

  const saveFees = () =>
    runAction(
      () =>
        api.updateFees(
          token,
          Object.fromEntries(
            feeRows.filter((row) => row.name.trim()).map((row) => [row.name, Number(row.value || 0)])
          )
        ),
      "Taxas atualizadas."
    );

  const handleProductCategoryChange = (category) => {
    setProductForm((current) => ({
      ...current,
      category,
      image:
        !current.image || isDefaultProductImage(current.image)
          ? getCategoryImage(category)
          : current.image
    }));
  };

  const handleProductImageUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
      setMessage("Envie somente imagens PNG para o produto.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("A imagem PNG deve ter no maximo 2 MB.");
      event.target.value = "";
      return;
    }

    try {
      const imageDataUrl = await readFileAsDataUrl(file);

      if (!imageDataUrl.startsWith("data:image/png")) {
        throw new Error("O arquivo enviado nao e um PNG valido.");
      }

      setProductForm((current) => ({
        ...current,
        image: imageDataUrl
      }));
      setMessage(`Imagem PNG pronta para salvar: ${file.name}`);
    } catch (error) {
      setMessage(error.message || "Falha ao carregar a imagem PNG.");
    } finally {
      event.target.value = "";
    }
  };

  const resetProductImage = () => {
    setProductForm((current) => ({
      ...current,
      image: getCategoryImage(current.category)
    }));
    setMessage("Imagem padrao da categoria restaurada.");
  };

  return (
    <div className="page-shell admin">
      <header className="admin-header">
        <div className="admin-brand">
          <BrandLogo subtitle="Painel operacional" variant="admin" to="/" />
          <div>
            <span className="eyebrow">Dashboard operacional</span>
            <h1>Turbo Drinks Admin</h1>
          </div>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="button button-soft" onClick={() => loadData(token)}>
            <RefreshCcw size={16} />
            Atualizar
          </button>
          <Link to="/" className="button button-outline">
            Ver loja
          </Link>
          <button type="button" className="button button-muted" onClick={logout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard label="Vendas do dia" value={formatCurrency(dashboard.kpis.salesToday)} accent="sunrise" hint={`${dashboard.kpis.ordersToday} pedidos`} />
        <MetricCard label="Ticket medio" value={formatCurrency(dashboard.kpis.avgTicket)} accent="forest" hint="Media mensal" />
        <MetricCard label="Semana" value={formatCurrency(dashboard.kpis.weeklyRevenue)} accent="night" hint="Ultimos 7 dias" />
        <MetricCard label="WhatsApp" value={whatsappMeta.label} accent="ruby" hint={whatsappMeta.hint} />
      </section>

      <section className={`admin-card whatsapp-overview ${whatsappMeta.tone}`}>
        <div className="whatsapp-overview-head">
          <div>
            <span className="eyebrow">Central do WhatsApp</span>
            <h2>Conexao e automacao do bot</h2>
            <p>
              Acompanhe a sessao do WhatsApp, confira erros recentes e abra o QR de reconexao sem sair do painel.
            </p>
          </div>
          <span className={`status-pill ${whatsappMeta.badgeClass}`}>{whatsappMeta.label}</span>
        </div>

        <div className="whatsapp-overview-grid">
          <div className="whatsapp-status-card">
            <span>Estado atual</span>
            <strong>{whatsappMeta.hint}</strong>
            <small>
              Ultima atualizacao: {whatsappStatus.updatedAt ? formatDate(whatsappStatus.updatedAt) : "ainda sem sincronizacao"}
            </small>
          </div>
          <div className="whatsapp-status-card">
            <span>QR de reconexao</span>
            <strong>{whatsappStatus.hasQr ? "Disponivel para leitura" : whatsappStatus.connected ? "Nao necessario" : "Aguardando geracao"}</strong>
            <small>{whatsappStatus.qrPagePath}</small>
          </div>
          <div className={`whatsapp-status-card ${whatsappStatus.lastError ? "has-error" : ""}`}>
            <span>Ultimo erro</span>
            <strong>{whatsappStatus.lastError || "Nenhum erro recente"}</strong>
            <small>{whatsappStatus.lastDisconnectReason || "Sessao estavel"}</small>
          </div>
        </div>

        <div className="card-actions">
          <a href="/api/whatsapp/qr" target="_blank" rel="noreferrer" className="button button-primary">
            <QrCode size={16} />
            {whatsappStatus.connected ? "Abrir QR / reconectar" : "Abrir QR do WhatsApp"}
          </a>
          <button type="button" className="button button-outline" onClick={() => refreshWhatsAppStatus()}>
            <RefreshCcw size={16} />
            Atualizar status
          </button>
        </div>

        <div className={`promo-note whatsapp-note ${whatsappStatus.lastError ? "has-error" : ""}`}>
          {whatsappStatus.lastError ? <AlertTriangle size={18} /> : <Smartphone size={18} />}
          <p>
            {whatsappStatus.lastError
              ? `O bot registrou um erro recente: ${whatsappStatus.lastError}`
              : "O bot esta pronto para receber mensagens dos clientes e disparar as atualizacoes dos pedidos automaticamente."}
          </p>
        </div>
      </section>

      <nav className="tab-row">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              type="button"
              key={tab.key}
              className={`tab-button ${activeTab === tab.key ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "orders" ? (
        <section className="order-list">
          {orders.map((order) => (
            <article key={order.id} className="admin-card order-card">
              <div className="order-topline">
                <div>
                  <span className="eyebrow">Pedido #{order.number}</span>
                  <h3>{order.customer.name}</h3>
                  <p>{order.customer.phone} - {order.customer.address}</p>
                </div>
                <div className="order-summary">
                  <span className="status-pill">{STATUS_STEPS.find((step) => step.key === order.status)?.label || order.status}</span>
                  <strong>{formatCurrency(order.total)}</strong>
                </div>
              </div>
              <div className="chips-list">
                {order.items.map((item) => (
                  <span key={`${item.productId}-${item.name}`} className="chip light">
                    {item.quantity}x {item.name}
                  </span>
                ))}
              </div>
              <div className="status-actions">
                {STATUS_STEPS.map((step) => (
                  <button
                    type="button"
                    key={step.key}
                    className={`button button-status ${order.status === step.key ? "is-current" : ""}`}
                    disabled={saving || order.status === step.key}
                    onClick={() => runAction(() => api.updateOrderStatus(token, order.id, step.key), "Status atualizado e cliente notificado.")}
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {activeTab === "products" ? (
        <section className="admin-grid">
          <article className="admin-card form-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Cadastro</span>
                <h2>{editingProductId ? "Editar produto" : "Novo produto"}</h2>
              </div>
            </div>
            <div className="field-grid">
              <label>
                Nome
                <input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                Categoria
                <select value={productForm.category} onChange={(event) => handleProductCategoryChange(event.target.value)}>
                  {categories.map((category) => <option value={category} key={category}>{category}</option>)}
                </select>
              </label>
              <label>
                Volume
                <input value={productForm.volume} onChange={(event) => setProductForm((current) => ({ ...current, volume: event.target.value }))} />
              </label>
              <label>
                Estoque
                <input type="number" value={productForm.stock} onChange={(event) => setProductForm((current) => ({ ...current, stock: Number(event.target.value) }))} />
              </label>
              <label>
                Preco de compra
                <input type="number" step="0.01" value={productForm.purchasePrice} onChange={(event) => setProductForm((current) => ({ ...current, purchasePrice: event.target.value }))} />
              </label>
              <label>
                Preco de venda
                <input type="number" step="0.01" value={productForm.salePrice} onChange={(event) => setProductForm((current) => ({ ...current, salePrice: event.target.value }))} />
              </label>
              <label className="field-span">
                Descricao
                <textarea rows="3" value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <div className="field-span image-upload-field">
                <span className="field-label">Imagem do produto</span>
                <div className="product-image-upload">
                  <div className="product-image-preview">
                    <img src={productForm.image} alt={productForm.name || "Preview do produto"} />
                  </div>
                  <div className="product-image-meta">
                    <strong>{editingProductId ? "Editar imagem atual" : "Definir imagem do produto"}</strong>
                    <span>{getProductImageHint(productForm.image)}</span>
                    <small>Aceita somente arquivo PNG com ate 2 MB.</small>
                    <input
                      id="product-image-upload"
                      className="file-input-hidden"
                      type="file"
                      accept="image/png,.png"
                      onChange={handleProductImageUpload}
                    />
                    <div className="card-actions">
                      <label htmlFor="product-image-upload" className="button button-outline button-upload">
                        <ImageUp size={16} />
                        Enviar PNG
                      </label>
                      <button type="button" className="button button-soft" onClick={resetProductImage}>
                        Usar imagem padrao
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button type="button" className="button button-primary button-block" disabled={saving} onClick={saveProduct}>
              {saving ? "Salvando..." : editingProductId ? "Atualizar produto" : "Cadastrar produto"}
            </button>
          </article>
          <div className="list-column">
            {dashboard.products.map((product) => (
              <article key={product.id} className="admin-card product-admin-card">
                <img src={product.image} alt={product.name} />
                <div>
                  <strong>{product.name}</strong>
                  <span>{product.category} - {product.volume}</span>
                  <small>
                    Venda {formatCurrency(product.salePrice)} - compra {formatCurrency(product.purchasePrice)} - estoque {product.stock}
                  </small>
                </div>
                <div className="card-actions">
                  <button type="button" className="button button-soft" onClick={() => { setActiveTab("products"); setEditingProductId(product.id); setProductForm(getProductFormState(product)); setMessage(""); }}>Editar</button>
                  <button type="button" className="button button-outline" onClick={() => runAction(() => api.toggleProduct(token, product.id), product.active ? "Produto pausado." : "Produto ativado.")}>{product.active ? "Pausar" : "Ativar"}</button>
                  <button type="button" className="button button-muted" onClick={() => runAction(() => api.deleteProduct(token, product.id), "Produto removido.")}>Remover</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "promotions" ? (
        <section className="admin-grid">
          <article className="admin-card form-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Campanhas</span>
                <h2>{editingPromotionId ? "Editar promocao" : "Nova promocao"}</h2>
              </div>
            </div>
            <div className="field-grid">
              <label>
                Tipo
                <select value={promotionForm.type} onChange={(event) => setPromotionForm((current) => ({ ...current, type: event.target.value }))}>
                  <option value="daily">Promocao do dia</option>
                  <option value="shipping">Frete gratis</option>
                  <option value="coupon">Cupom</option>
                  <option value="combo">Combo</option>
                </select>
              </label>
              <label>
                Titulo
                <input value={promotionForm.title} onChange={(event) => setPromotionForm((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label className="field-span">
                Descricao
                <textarea rows="3" value={promotionForm.description} onChange={(event) => setPromotionForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <label>
                Codigo
                <input value={promotionForm.code} onChange={(event) => setPromotionForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} />
              </label>
              <label>
                Valor
                <input type="number" step="0.01" value={promotionForm.discountValue} onChange={(event) => setPromotionForm((current) => ({ ...current, discountValue: Number(event.target.value) }))} />
              </label>
            </div>
            <button type="button" className="button button-primary button-block" disabled={saving} onClick={savePromotion}>
              {saving ? "Salvando..." : editingPromotionId ? "Atualizar promocao" : "Criar promocao"}
            </button>
          </article>
          <div className="list-column">
            {dashboard.promotions.map((promotion) => (
              <article key={promotion.id} className="admin-card promotion-card">
                <div>
                  <span className="eyebrow">{promotion.type}</span>
                  <strong>{promotion.title}</strong>
                  <p>{promotion.description}</p>
                </div>
                <div className="card-actions">
                  <button type="button" className="button button-soft" onClick={() => { setActiveTab("promotions"); setEditingPromotionId(promotion.id); setPromotionForm({ ...promotion }); }}>Editar</button>
                  <button type="button" className="button button-muted" onClick={() => runAction(() => api.deletePromotion(token, promotion.id), "Promocao removida.")}>Excluir</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "customers" ? (
        <section className="list-column">
          {customers.map((customer) => (
            <article key={customer.id} className="admin-card customer-card">
              <div className="customer-head">
                <div>
                  <span className="eyebrow">Cliente recorrente</span>
                  <h2>{customer.name}</h2>
                </div>
                <strong>{formatCurrency(customer.totalSpent)}</strong>
              </div>
              <div className="summary-list two-columns">
                <div><span>Telefone</span><strong>{customer.phone}</strong></div>
                <div><span>Bairro</span><strong>{customer.neighborhood}</strong></div>
                <div><span>Endereco</span><strong>{customer.address}</strong></div>
                <div><span>Pedidos</span><strong>{customer.previousOrders.length}</strong></div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {activeTab === "operations" ? (
        <section className="admin-grid reports-grid">
          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Relatorios</span>
                <h2>Resumo do desempenho</h2>
              </div>
            </div>
            <div className="summary-list">
              <div><span>Pedidos do dia</span><strong>{dashboard.kpis.ordersToday}</strong></div>
              <div><span>Faturamento semanal</span><strong>{formatCurrency(reports.weeklyRevenue)}</strong></div>
              <div><span>Faturamento mensal</span><strong>{formatCurrency(reports.monthlyRevenue)}</strong></div>
              <div><span>Entregas na rua</span><strong>{deliveryBoard.length}</strong></div>
            </div>
            <div className="rank-list">
              {reports.topProducts.map((product) => (
                <div key={product.productId} className="rank-row">
                  <strong>{product.name}</strong>
                  <span>{product.quantity} un. - {formatCurrency(product.revenue)}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Taxas de entrega</span>
                <h2>Bairros atendidos</h2>
              </div>
            </div>
            <div className="fee-list">
              {feeRows.map((row, index) => (
                <div key={`${row.name}-${index}`} className="fee-row">
                  <input value={row.name} onChange={(event) => setFeeRows((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))} />
                  <input type="number" step="0.01" value={row.value} onChange={(event) => setFeeRows((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, value: Number(event.target.value) } : entry))} />
                </div>
              ))}
            </div>
            <button type="button" className="button button-primary button-block" disabled={saving} onClick={saveFees}>Salvar taxas</button>
          </article>

          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">WhatsApp</span>
                <h2>Automacao do bot</h2>
              </div>
              <span className={`status-pill ${whatsappMeta.badgeClass}`}>{whatsappMeta.label}</span>
            </div>
            <div className="summary-list">
              <div><span>Ultima atualizacao</span><strong>{whatsappStatus.updatedAt ? formatDate(whatsappStatus.updatedAt) : "-"}</strong></div>
              <div><span>QR disponivel</span><strong>{whatsappStatus.hasQr ? "Sim" : "Nao"}</strong></div>
              <div><span>Erro recente</span><strong>{whatsappStatus.lastError || "Nenhum erro registrado"}</strong></div>
              <div><span>Entregas em rota</span><strong>{deliveryBoard.length}</strong></div>
            </div>
            <div className="card-actions">
              <a href="/api/whatsapp/qr" target="_blank" rel="noreferrer" className="button button-primary">
                <MessageCircle size={16} />
                Abrir QR do WhatsApp
              </a>
              <button type="button" className="button button-outline" onClick={() => refreshWhatsAppStatus()}>
                <MapPinned size={16} />
                Atualizar modulo
              </button>
            </div>
            <div className="promo-note">
              <Smartphone size={18} />
              <p>O bot recebe mensagens, informa bairros e taxas e envia automaticamente os updates de pedido ao cliente.</p>
            </div>
          </article>
        </section>
      ) : null}

      {message ? <div className="toast-message admin-toast">{message}</div> : null}
    </div>
  );
}

export default AdminPage;
