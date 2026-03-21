import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  AlertTriangle,
  ChartColumn,
  ClipboardList,
  FolderPlus,
  ImageUp,
  LogOut,
  MapPinned,
  MessageCircle,
  Minus,
  Package,
  Percent,
  Plus,
  Wallet,
  Search,
  RefreshCcw,
  QrCode,
  ShoppingCart,
  Smartphone,
  TicketPercent,
  Trash2,
  Users
} from "lucide-react";
import { api, socket } from "../api";
import { supabase } from "../supabase";
import BrandLogo from "../components/BrandLogo";
import MetricCard from "../components/MetricCard";
import { STATUS_STEPS } from "../components/StatusTimeline";

const TOKEN_KEY = "turbo_admin_token";
const DEFAULT_PAGE_SIZE = 24;
const DEFAULT_ORDER_LIMIT = 50;
const DEFAULT_CUSTOMER_LIMIT = 50;

const tabs = [
  { key: "orders", label: "Pedidos", icon: ClipboardList },
  { key: "pos", label: "PDV", icon: ShoppingCart },
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

const defaultExpenseForm = {
  title: "",
  category: "",
  amount: "",
  date: "",
  note: ""
};

const defaultPayableForm = {
  title: "",
  category: "",
  amount: "",
  dueDate: "",
  note: "",
  status: "pending"
};

const defaultReceivableForm = {
  title: "",
  customerName: "",
  customerPhone: "",
  category: "",
  amount: "",
  dueDate: "",
  note: "",
  status: "pending"
};

const defaultCustomerForm = {
  name: "",
  phone: "",
  address: "",
  neighborhood: "",
  notes: ""
};

const defaultCashOpenForm = {
  openingBalance: "",
  note: ""
};

const defaultCashCloseForm = {
  countedBalance: "",
  note: ""
};

const defaultCashMovementForm = {
  type: "withdrawal",
  amount: "",
  note: ""
};

const defaultRiderForm = {
  name: "",
  phone: "",
  active: true
};

const defaultPosForm = {
  name: "",
  phone: "",
  note: "",
  couponCode: "",
  manualDiscount: "",
  manualDiscountPercent: "",
  manualSurcharge: "",
  manualSurchargePercent: "",
  creditContactName: "",
  creditContactPhone: "",
  creditDueDate: "",
  creditNote: ""
};

const posPaymentOptions = [
  { value: "fiado", label: "Fiado" },
  { value: "pix_key", label: "Chave PIX" },
  { value: "pix_qr", label: "Chave PIX QR Code" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "credit_card", label: "Cartao de Credito" },
  { value: "debit_card", label: "Cartao de Debito" }
];
const paymentLabels = posPaymentOptions.reduce(
  (accumulator, option) => ({ ...accumulator, [option.value]: option.label }),
  { pix: "PIX", cartao: "Cartao", multiple: "Multiplo" }
);

const createPaymentRow = (overrides = {}) => ({
  id: `pay-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  method: "pix_key",
  amount: "",
  ...overrides
});

const createFeeRow = (overrides = {}) => ({
  id: `fee-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  value: "",
  isEditing: false,
  ...overrides
});

const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
const formatDate = (value) => new Date(value).toLocaleString("pt-BR");
const parseAmount = (value) => {
  const normalized = String(value ?? "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
};
const toCents = (value) => Math.round(parseAmount(value) * 100);
const fromCents = (value) => Number((Number(value || 0) / 100).toFixed(2));
const isWithinDays = (dateValue, days) => {
  if (!dateValue) {
    return false;
  }
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  const diffMs = Date.now() - parsed.getTime();
  return diffMs <= days * 24 * 60 * 60 * 1000;
};
const isOverdue = (dateValue) => {
  if (!dateValue) {
    return false;
  }
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime() < today.getTime();
};
const isDueSoon = (dateValue, days = 3) => {
  if (!dateValue) {
    return false;
  }
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  const diffDays = (parsed.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
  return diffDays >= 0 && diffDays <= days;
};
const escapeCsv = (value) => {
  const stringValue = String(value ?? "");
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
};
const downloadCsv = (filename, content) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
const formatDayLabel = (value) =>
  new Date(value).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  });
const clampPercent = (value) => {
  const numeric = parseAmount(value);
  return Math.min(Math.max(numeric, 0), 100);
};
const estimateDiscount = (subtotal, promotions, couponCode) => {
  const coupon = promotions.find(
    (promotion) =>
      promotion.type === "coupon" &&
      promotion.code &&
      promotion.code.toLowerCase() === String(couponCode || "").trim().toLowerCase()
  );

  if (!coupon || subtotal < Number(coupon.minimumOrder || 0)) {
    return 0;
  }

  if (coupon.discountType === "percentage") {
    return Number(((subtotal * Number(coupon.discountValue || 0)) / 100).toFixed(2));
  }

  return Number(Number(coupon.discountValue || 0).toFixed(2));
};

const buildReceiptHtml = ({ order, settings, width }) => {
  const safe = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const storeName = safe(settings?.storeName || "Distribuidora");
  const addressLine = safe(settings?.addressLine || "");
  const city = safe(settings?.city || "");
  const createdAt = safe(new Date(order.createdAt || Date.now()).toLocaleString("pt-BR"));
  const receiptWidth = Number(width) >= 80 ? 80 : 58;

  const itemsHtml = (order.items || [])
    .map(
      (item) => `
        <tr>
          <td>${safe(item.quantity)}x ${safe(item.name)}</td>
          <td class="right">${formatCurrency(item.lineTotal)}</td>
        </tr>
      `
    )
    .join("");

  const paymentsHtml = (order.payments || [])
    .map(
      (payment) => `
        <tr>
          <td>${safe(payment.method)}</td>
          <td class="right">${formatCurrency(payment.amount)}</td>
        </tr>
      `
    )
    .join("");

  const summaryRows = [
    { label: "Subtotal", value: formatCurrency(order.subtotal) },
    order.promoDiscount > 0 && {
      label: "Desconto cupom",
      value: `- ${formatCurrency(order.promoDiscount)}`
    },
    order.manualDiscountPercentAmount > 0 && {
      label: "Desconto %",
      value: `- ${formatCurrency(order.manualDiscountPercentAmount)}`
    },
    order.manualDiscount > 0 && {
      label: "Desconto",
      value: `- ${formatCurrency(order.manualDiscount)}`
    },
    order.manualSurchargePercentAmount > 0 && {
      label: "Acrescimo %",
      value: formatCurrency(order.manualSurchargePercentAmount)
    },
    order.manualSurcharge > 0 && {
      label: "Acrescimo",
      value: formatCurrency(order.manualSurcharge)
    }
  ]
    .filter(Boolean)
    .map(
      (row) => `
        <tr>
          <td>${safe(row.label)}</td>
          <td class="right">${safe(row.value)}</td>
        </tr>
      `
    )
    .join("");

  const changeRow =
    order.changeDue > 0
      ? `<tr><td>Troco</td><td class="right">${formatCurrency(order.changeDue)}</td></tr>`
      : "";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Comprovante PDV</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: "Courier New", monospace; }
      .receipt { width: ${receiptWidth}mm; padding: 8px; }
      h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
      p { margin: 2px 0; font-size: 12px; text-align: center; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      td { padding: 2px 0; vertical-align: top; }
      .right { text-align: right; }
      .divider { border-top: 1px dashed #000; margin: 6px 0; }
      .total { font-weight: bold; font-size: 14px; }
      @media print {
        @page { size: ${receiptWidth}mm auto; margin: 2mm; }
        body { margin: 0; }
      }
    </style>
  </head>
  <body>
    <div class="receipt">
      <h1>${storeName}</h1>
      ${addressLine ? `<p>${addressLine}</p>` : ""}
      ${city ? `<p>${city}</p>` : ""}
      <p>Venda PDV #${safe(order.number)}</p>
      <p>${createdAt}</p>
      <div class="divider"></div>
      <table>
        ${itemsHtml}
      </table>
      <div class="divider"></div>
      <table>
        ${summaryRows}
        <tr class="total">
          <td>Total</td>
          <td class="right">${formatCurrency(order.total)}</td>
        </tr>
      </table>
      <div class="divider"></div>
      <table>
        <tr><td colspan="2">Pagamentos</td></tr>
        ${paymentsHtml}
        ${changeRow}
      </table>
      <div class="divider"></div>
      <p>Obrigado pela preferencia!</p>
    </div>
    <script>
      window.onload = () => {
        window.focus();
        window.print();
        setTimeout(() => window.close(), 300);
      };
    </script>
  </body>
</html>`;
};
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
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [reports, setReports] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [adminProfile, setAdminProfile] = useState(null);
  const [adminConfirmed, setAdminConfirmed] = useState(false);
  const [reportsDays, setReportsDays] = useState(7);
  const [loadError, setLoadError] = useState("");
  const [productForm, setProductForm] = useState(defaultProductForm);
  const [promotionForm, setPromotionForm] = useState(defaultPromotionForm);
  const [categoryName, setCategoryName] = useState("");
  const [expenseForm, setExpenseForm] = useState(defaultExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [payableForm, setPayableForm] = useState(defaultPayableForm);
  const [editingPayableId, setEditingPayableId] = useState("");
  const [receivableForm, setReceivableForm] = useState(defaultReceivableForm);
  const [editingReceivableId, setEditingReceivableId] = useState("");
  const [customerForm, setCustomerForm] = useState(defaultCustomerForm);
  const [cashOpenForm, setCashOpenForm] = useState(defaultCashOpenForm);
  const [cashCloseForm, setCashCloseForm] = useState(defaultCashCloseForm);
  const [cashMovementForm, setCashMovementForm] = useState(defaultCashMovementForm);
  const [riderForm, setRiderForm] = useState(defaultRiderForm);
  const [editingRiderId, setEditingRiderId] = useState("");
  const [showRiders, setShowRiders] = useState(false);
  const [riderPeriodDays, setRiderPeriodDays] = useState(7);
  const [editingProductId, setEditingProductId] = useState("");
  const [editingPromotionId, setEditingPromotionId] = useState("");
  const [feeRows, setFeeRows] = useState([]);
  const [posQuery, setPosQuery] = useState("");
  const [posCategory, setPosCategory] = useState("Todos");
  const [posCart, setPosCart] = useState([]);
  const [posForm, setPosForm] = useState(defaultPosForm);
  const [posPayments, setPosPayments] = useState(() => [createPaymentRow()]);
  const [posSubmitting, setPosSubmitting] = useState(false);
  const [posFeedback, setPosFeedback] = useState("");
  const [posLastOrder, setPosLastOrder] = useState(null);
  const [posPrintWidth, setPosPrintWidth] = useState("58");
  const [showExpenses, setShowExpenses] = useState(false);
  const [showPayables, setShowPayables] = useState(false);
  const [showReceivables, setShowReceivables] = useState(false);
  const [orderLimit, setOrderLimit] = useState(DEFAULT_ORDER_LIMIT);
  const [customerLimit, setCustomerLimit] = useState(DEFAULT_CUSTOMER_LIMIT);
  const [productLimit, setProductLimit] = useState(DEFAULT_ORDER_LIMIT);
  const [promotionLimit, setPromotionLimit] = useState(DEFAULT_ORDER_LIMIT);
  const [visibleOrderCount, setVisibleOrderCount] = useState(DEFAULT_PAGE_SIZE);
  const [visibleCustomerCount, setVisibleCustomerCount] = useState(DEFAULT_PAGE_SIZE);
  const [visibleProductCount, setVisibleProductCount] = useState(DEFAULT_PAGE_SIZE);
  const [visiblePromotionCount, setVisiblePromotionCount] = useState(DEFAULT_PAGE_SIZE);
  const [isRinging, setIsRinging] = useState(false);
  const posPrintedRef = useRef("");
  const soundEnabledRef = useRef(false);
  const orderSoundRef = useRef(null);
  const previousPendingOrderIdsRef = useRef(null);
  const ringingOrderIdsRef = useRef([]);

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

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const audio = new Audio("/audio/ifood-motoboy.mp3");
    audio.loop = true;
    audio.preload = "auto";
    orderSoundRef.current = audio;

    return () => {
      audio.pause();
      audio.currentTime = 0;
      orderSoundRef.current = null;
    };
  }, []);

  const stopOrderRing = () => {
    if (orderSoundRef.current) {
      orderSoundRef.current.pause();
      orderSoundRef.current.currentTime = 0;
    }
    ringingOrderIdsRef.current = [];
    setIsRinging(false);
  };

  const playOrderSound = async (force = false) => {
    if (!force && !soundEnabledRef.current) {
      return;
    }

    try {
      if (orderSoundRef.current) {
        orderSoundRef.current.currentTime = 0;
        await orderSoundRef.current.play();
        setIsRinging(true);
        return;
      }
    } catch (error) {
      setMessage("Nao foi possivel tocar o som. Verifique permissao do navegador.");
    }
  };

  const loadData = async (currentToken = token, silent = false, options = {}) => {
    if (!currentToken) {
      return;
    }

    const {
      includeReports = activeTab === "operations",
      orderFetchLimit = orderLimit,
      customerFetchLimit = customerLimit,
      productFetchLimit = productLimit,
      promotionFetchLimit = promotionLimit
    } = options;

    if (!silent) {
      setLoading(true);
    }

    setLoadError("");

    try {
      const requestEntries = [
        ["dashboard", api.getDashboard(currentToken)],
        ["orders", api.getOrders(currentToken, orderFetchLimit)],
        ["customers", api.getCustomers(currentToken, customerFetchLimit)],
        ["products", api.getProducts(currentToken, productFetchLimit)],
        ["promotions", api.getPromotions(currentToken, promotionFetchLimit)],
        ["profile", api.getAdminProfile(currentToken)]
      ];

      if (includeReports) {
        requestEntries.push(["reports", api.getReports(currentToken, reportsDays)]);
      }

      const settled = await Promise.allSettled(requestEntries.map(([, promise]) => promise));
      const fulfilledCount = settled.filter((entry) => entry.status === "fulfilled").length;

      if (!fulfilledCount) {
        const firstError = settled.find((entry) => entry.status === "rejected");
        throw firstError?.reason || new Error("Falha ao carregar o painel.");
      }

      const payloads = Object.fromEntries(
        requestEntries.map(([key], index) => {
          const result = settled[index];
          return [key, result.status === "fulfilled" ? result.value : null];
        })
      );

      const failedMessages = settled
        .filter((entry) => entry.status === "rejected")
        .map((entry) => entry.reason?.message)
        .filter(Boolean);

      if (payloads.dashboard) {
        setDashboard(payloads.dashboard);
        setFeeRows(
          Object.entries(payloads.dashboard.deliveryFees || {}).map(([name, value]) =>
            createFeeRow({ name, value: String(value ?? ""), isEditing: false })
          )
        );
      }
      if (payloads.orders) {
        setOrders(payloads.orders);
      }
      if (payloads.customers) {
        setCustomers(payloads.customers);
      }
      if (payloads.products) {
        setProducts(payloads.products);
      }
      if (payloads.promotions) {
        setPromotions(payloads.promotions);
      }
      if (payloads.profile) {
        setAdminProfile(payloads.profile?.profile || null);
        setAdminConfirmed(Boolean(payloads.profile?.confirmed));
      }
      if (includeReports && payloads.reports) {
        setReports(payloads.reports);
      }

      if (failedMessages.length) {
        setMessage(`Alguns dados do painel nao carregaram: ${failedMessages[0]}`);
      }
    } catch (error) {
      setLoadError(error.message || "Falha ao carregar o painel.");
      throw error;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadReports = async (currentToken = token, days = reportsDays) => {
    if (!currentToken) {
      return;
    }
    try {
      setReportsLoading(true);
      const reportsPayload = await api.getReports(currentToken, days);
      setReports(reportsPayload);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let mounted = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token || "";
      if (!mounted) {
        return;
      }
      if (accessToken) {
        localStorage.setItem(TOKEN_KEY, accessToken);
        setToken(accessToken);
      }
    };

    syncSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const accessToken = session?.access_token || "";
      if (accessToken) {
        localStorage.setItem(TOKEN_KEY, accessToken);
        setToken(accessToken);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
      }
    });

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!token) {
      previousPendingOrderIdsRef.current = null;
      ringingOrderIdsRef.current = [];
      stopOrderRing();
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

    const handleOrderUpdate = () => {
      refresh();
    };

    socket.on("dashboard:update", refresh);
    socket.on("order:updated", handleOrderUpdate);

    const whatsappInterval = window.setInterval(() => {
      refreshWhatsAppStatus(true);
    }, 15000);

    return () => {
      mounted = false;
      socket.off("dashboard:update", refresh);
      socket.off("order:updated", handleOrderUpdate);
      window.clearInterval(whatsappInterval);
    };
  }, [token]);

  useEffect(() => {
    setVisibleOrderCount(DEFAULT_PAGE_SIZE);
  }, [orders.length]);

  useEffect(() => {
    setVisibleCustomerCount(DEFAULT_PAGE_SIZE);
  }, [customers.length]);

  useEffect(() => {
    setVisibleProductCount(DEFAULT_PAGE_SIZE);
  }, [products.length]);

  useEffect(() => {
    setVisiblePromotionCount(DEFAULT_PAGE_SIZE);
  }, [promotions.length]);

  useEffect(() => {
    if (!token) {
      return;
    }
    if (activeTab === "operations") {
      loadReports(token, reportsDays);
    }
  }, [reportsDays, activeTab, token]);

  useEffect(() => {
    if (token && activeTab === "operations" && !reports) {
      loadReports(token, reportsDays);
    }
  }, [activeTab, token, reports, reportsDays]);

  const runAction = async (action, successMessage) => {
    setSaving(true);
    setMessage("");
    try {
      await action();
      await loadData(token, false, { includeReports: activeTab === "operations" });
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const loadMoreOrders = async () => {
    const nextVisibleCount = visibleOrderCount + DEFAULT_PAGE_SIZE;
    if (nextVisibleCount <= orders.length) {
      setVisibleOrderCount(nextVisibleCount);
      return;
    }

    const nextLimit = Math.min(orderLimit + DEFAULT_ORDER_LIMIT, 500);
    if (nextLimit === orderLimit) {
      setVisibleOrderCount(nextVisibleCount);
      return;
    }

    setOrderLimit(nextLimit);
    await loadData(token, true, {
      includeReports: activeTab === "operations",
      orderFetchLimit: nextLimit,
      customerFetchLimit: customerLimit
    });
    setVisibleOrderCount(nextVisibleCount);
  };

  const loadMoreCustomers = async () => {
    const nextVisibleCount = visibleCustomerCount + DEFAULT_PAGE_SIZE;
    if (nextVisibleCount <= customers.length) {
      setVisibleCustomerCount(nextVisibleCount);
      return;
    }

    const nextLimit = Math.min(customerLimit + DEFAULT_CUSTOMER_LIMIT, 500);
    if (nextLimit === customerLimit) {
      setVisibleCustomerCount(nextVisibleCount);
      return;
    }

    setCustomerLimit(nextLimit);
    await loadData(token, true, {
      includeReports: activeTab === "operations",
      orderFetchLimit: orderLimit,
      customerFetchLimit: nextLimit
    });
    setVisibleCustomerCount(nextVisibleCount);
  };

  const loadMoreProducts = async () => {
    const nextVisibleCount = visibleProductCount + DEFAULT_PAGE_SIZE;
    if (nextVisibleCount <= products.length) {
      setVisibleProductCount(nextVisibleCount);
      return;
    }

    const nextLimit = Math.min(productLimit + DEFAULT_ORDER_LIMIT, 500);
    if (nextLimit === productLimit) {
      setVisibleProductCount(nextVisibleCount);
      return;
    }

    setProductLimit(nextLimit);
    await loadData(token, true, {
      includeReports: activeTab === "operations",
      orderFetchLimit: orderLimit,
      customerFetchLimit: customerLimit,
      productFetchLimit: nextLimit,
      promotionFetchLimit: promotionLimit
    });
    setVisibleProductCount(nextVisibleCount);
  };

  const loadMorePromotions = async () => {
    const nextVisibleCount = visiblePromotionCount + DEFAULT_PAGE_SIZE;
    if (nextVisibleCount <= promotions.length) {
      setVisiblePromotionCount(nextVisibleCount);
      return;
    }

    const nextLimit = Math.min(promotionLimit + DEFAULT_ORDER_LIMIT, 500);
    if (nextLimit === promotionLimit) {
      setVisiblePromotionCount(nextVisibleCount);
      return;
    }

    setPromotionLimit(nextLimit);
    await loadData(token, true, {
      includeReports: activeTab === "operations",
      orderFetchLimit: orderLimit,
      customerFetchLimit: customerLimit,
      productFetchLimit: productLimit,
      promotionFetchLimit: nextLimit
    });
    setVisiblePromotionCount(nextVisibleCount);
  };

  const handleLogin = async () => {
    setLoading(true);
    setMessage("");
    try {
      const identifier = loginForm.username.trim();
      const shouldTrySupabaseFirst = Boolean(supabase && identifier.includes("@"));

      if (shouldTrySupabaseFirst) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: identifier,
          password: loginForm.password
        });

        if (!error && data?.session?.access_token) {
          localStorage.setItem(TOKEN_KEY, data.session.access_token);
          setToken(data.session.access_token);
          return;
        }
      }

      const payload = await api.adminLogin({
        username: identifier,
        password: loginForm.password
      });
      localStorage.setItem(TOKEN_KEY, payload.token);
      setToken(payload.token);
    } catch (error) {
      setLoading(false);
      setMessage(error.message);
    }
  };

  const logout = async () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setDashboard(null);
    setOrders([]);
    setCustomers([]);
    setProducts([]);
    setPromotions([]);
    setReports(null);
    setReportsLoading(false);
    setAdminProfile(null);
    setAdminConfirmed(false);
    setExpenseForm(defaultExpenseForm);
    setEditingExpenseId("");
    setPayableForm(defaultPayableForm);
    setEditingPayableId("");
    setReceivableForm(defaultReceivableForm);
    setEditingReceivableId("");
    setCustomerForm(defaultCustomerForm);
    setCashOpenForm(defaultCashOpenForm);
    setCashCloseForm(defaultCashCloseForm);
    setCashMovementForm(defaultCashMovementForm);
    setRiderForm(defaultRiderForm);
    setEditingRiderId("");
    setSoundEnabled(false);
    setOrderLimit(DEFAULT_ORDER_LIMIT);
    setCustomerLimit(DEFAULT_CUSTOMER_LIMIT);
    setProductLimit(DEFAULT_ORDER_LIMIT);
    setPromotionLimit(DEFAULT_ORDER_LIMIT);
    setVisibleOrderCount(DEFAULT_PAGE_SIZE);
    setVisibleCustomerCount(DEFAULT_PAGE_SIZE);
    setVisibleProductCount(DEFAULT_PAGE_SIZE);
    setVisiblePromotionCount(DEFAULT_PAGE_SIZE);
    setMessage("");
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const productCatalog = products;
  const promotionsCatalog = promotions;
  const visibleOrders = orders.slice(0, visibleOrderCount);
  const visibleCustomers = customers.slice(0, visibleCustomerCount);
  const visibleProducts = productCatalog.slice(0, visibleProductCount);
  const visiblePromotions = promotionsCatalog.slice(0, visiblePromotionCount);
  const reportMetrics = reports ?? {
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    weeklyRevenueDelivery: 0,
    weeklyRevenuePos: 0,
    monthlyRevenueDelivery: 0,
    monthlyRevenuePos: 0,
    avgTicketDelivery: 0,
    avgTicketPos: 0,
    salesTodayDelivery: 0,
    ordersTodayDelivery: 0,
    salesTodayPos: 0,
    ordersTodayPos: 0,
    topProducts: []
  };
  const categories = dashboard?.categories?.length
    ? dashboard.categories
    : [...new Set(productCatalog.map((product) => product.category))];
  const paymentOptions = dashboard?.paymentMethods?.filter((method) => method.active) ?? posPaymentOptions;
  const whatsappStatus = dashboard?.whatsapp ?? {};
  const whatsappMeta = getWhatsAppMeta(whatsappStatus);
  const deliveryBoard = orders.filter((order) => order.status === "out_for_delivery");
  const pendingDeliveryOrders = orders.filter(
    (order) => order.channel !== "pos" && order.status === "received"
  );
  const expenses = dashboard?.expenses ?? [];
  const expensesTotal = expenses.reduce(
    (sum, expense) => sum + parseAmount(expense.amount),
    0
  );
  const stockSummary = dashboard?.stockSummary ?? {
    lowThreshold: 5,
    totalProducts: productCatalog.length,
    totalUnits: productCatalog.reduce((sum, product) => sum + Number(product.stock || 0), 0),
    zeroStockCount: productCatalog.filter((product) => Number(product.stock || 0) <= 0).length,
    lowStockCount: productCatalog.filter((product) => {
      const stock = Number(product.stock || 0);
      return stock > 0 && stock <= 5;
    }).length,
    inventoryValue: productCatalog.reduce(
      (sum, product) => sum + Number(product.purchasePrice || 0) * Number(product.stock || 0),
      0
    )
  };
  const payables = dashboard?.payables ?? [];
  const payablesSummary = dashboard?.payablesSummary ?? {
    total: payables.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    pendingTotal: payables
      .filter((entry) => entry.status !== "paid")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    pendingCount: payables.filter((entry) => entry.status !== "paid").length,
    paidCount: payables.filter((entry) => entry.status === "paid").length
  };
  const receivables = dashboard?.receivables ?? [];
  const receivablesSummary = dashboard?.receivablesSummary ?? {
    total: receivables.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    pendingTotal: receivables
      .filter((entry) => entry.status !== "paid")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    pendingCount: receivables.filter((entry) => entry.status !== "paid").length,
    paidCount: receivables.filter((entry) => entry.status === "paid").length
  };
  const cashRegister = dashboard?.cashRegister ?? { currentSession: null, history: [] };
  const cashSession = cashRegister.currentSession || null;
  const cashHistory = cashRegister.history || [];
  const supportRequests = dashboard?.supportRequests ?? [];
  const pendingSupportRequests = supportRequests.filter((entry) => entry.status !== "resolved");
  const zeroStockProducts = productCatalog.filter((product) => Number(product.stock || 0) <= 0);
  const lowStockProducts = productCatalog.filter((product) => {
    const stock = Number(product.stock || 0);
    return stock > 0 && stock <= Number(stockSummary.lowThreshold || 5);
  });
  const overduePayables = payables.filter((entry) => entry.status !== "paid" && isOverdue(entry.dueDate));
  const dueSoonPayables = payables.filter(
    (entry) => entry.status !== "paid" && !isOverdue(entry.dueDate) && isDueSoon(entry.dueDate)
  );
  const overdueReceivables = receivables.filter(
    (entry) => entry.status !== "paid" && isOverdue(entry.dueDate)
  );
  const dueSoonReceivables = receivables.filter(
    (entry) => entry.status !== "paid" && !isOverdue(entry.dueDate) && isDueSoon(entry.dueDate)
  );
  const riders = dashboard?.riders ?? [];
  const deliveredOrders = orders.filter(
    (order) => order.channel !== "pos" && order.status === "delivered"
  );
  const deliveredOrdersInPeriod = deliveredOrders.filter((order) =>
    isWithinDays(order.createdAt, riderPeriodDays)
  );
  const riderById = riders.reduce((accumulator, rider) => {
    accumulator[rider.id] = rider;
    return accumulator;
  }, {});
  const riderDailyStats = deliveredOrdersInPeriod.reduce((accumulator, order) => {
    const dateKey = new Date(order.createdAt).toISOString().slice(0, 10);
    const current = accumulator[dateKey] || {
      date: dateKey,
      deliveries: 0,
      feesTotal: 0,
      riders: {}
    };
    current.deliveries += 1;
    current.feesTotal += Number(order.deliveryFee || 0);
    if (order.riderId) {
      current.riders[order.riderId] = (current.riders[order.riderId] || 0) + 1;
    }
    accumulator[dateKey] = current;
    return accumulator;
  }, {});
  const riderDailyList = Object.values(riderDailyStats)
    .map((entry) => ({
      ...entry,
      feesTotal: Number(Number(entry.feesTotal || 0).toFixed(2))
    }))
    .sort((left, right) => new Date(right.date) - new Date(left.date));
  const riderStats = riders.map((rider) => {
    const riderOrders = deliveredOrdersInPeriod.filter((order) => order.riderId === rider.id);
    const deliveries = riderOrders.length;
    const feesTotal = riderOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);
    return {
      rider,
      deliveries,
      feesTotal: Number(Number(feesTotal || 0).toFixed(2))
    };
  });

  useEffect(() => {
    if (!soundEnabled) {
      stopOrderRing();
      return undefined;
    }

    const pendingIds = pendingDeliveryOrders.map((order) => order.id);
    const previousIds = previousPendingOrderIdsRef.current;

    if (!previousIds) {
      previousPendingOrderIdsRef.current = pendingIds;
      return undefined;
    }

    const newPendingIds = pendingIds.filter((id) => !previousIds.includes(id));
    if (newPendingIds.length) {
      ringingOrderIdsRef.current = [...new Set([...ringingOrderIdsRef.current, ...newPendingIds])];
      playOrderSound();
    }

    const hasActiveRingingOrder = ringingOrderIdsRef.current.some((id) => pendingIds.includes(id));
    if (!hasActiveRingingOrder) {
      stopOrderRing();
    }

    previousPendingOrderIdsRef.current = pendingIds;

    return () => {
      previousPendingOrderIdsRef.current = pendingIds;
    };
  }, [soundEnabled, pendingDeliveryOrders]);
  const productsById = productCatalog.reduce((accumulator, product) => {
    accumulator[product.id] = product;
    return accumulator;
  }, {});
  const posQuantities = posCart.reduce(
    (accumulator, item) => ({ ...accumulator, [item.id]: item.quantity }),
    {}
  );
  const posCartItems = posCart
    .map((item) => {
      const product = productsById[item.id];
      return product ? { ...product, quantity: item.quantity } : null;
    })
    .filter(Boolean);
  const posSubtotal = posCartItems.reduce(
    (sum, item) => sum + item.salePrice * item.quantity,
    0
  );
  const posPromoDiscount = estimateDiscount(
    posSubtotal,
    promotionsCatalog,
    posForm.couponCode
  );
  const posDiscountBase = Math.max(posSubtotal - posPromoDiscount, 0);
  const posManualDiscount = Math.max(parseAmount(posForm.manualDiscount), 0);
  const posManualDiscountPercent = clampPercent(posForm.manualDiscountPercent);
  const posManualDiscountPercentAmount = Number(
    ((posDiscountBase * posManualDiscountPercent) / 100).toFixed(2)
  );
  const posManualDiscountFixedApplied = Math.min(posManualDiscount, posDiscountBase);
  const posManualDiscountPercentApplied = Math.min(
    posManualDiscountPercentAmount,
    Math.max(posDiscountBase - posManualDiscountFixedApplied, 0)
  );
  const posManualDiscountApplied = posManualDiscountFixedApplied + posManualDiscountPercentApplied;
  const posDiscountTotal = Math.min(posPromoDiscount + posManualDiscountApplied, posSubtotal);
  const posSurchargeBase = Math.max(posSubtotal - posDiscountTotal, 0);
  const posManualSurcharge = Math.max(parseAmount(posForm.manualSurcharge), 0);
  const posManualSurchargePercent = clampPercent(posForm.manualSurchargePercent);
  const posManualSurchargePercentAmount = Number(
    ((posSurchargeBase * posManualSurchargePercent) / 100).toFixed(2)
  );
  const posManualSurchargeTotal = posManualSurcharge + posManualSurchargePercentAmount;
  const posTotal = Math.max(posSubtotal - posDiscountTotal + posManualSurchargeTotal, 0);
  const posPaymentsTotalCents = posPayments.reduce(
    (sum, payment) => sum + toCents(payment.amount),
    0
  );
  const posCreditTotalCents = posPayments.reduce(
    (sum, payment) => (payment.method === "fiado" ? sum + toCents(payment.amount) : sum),
    0
  );
  const posCashTotalCents = posPayments.reduce(
    (sum, payment) => (payment.method === "dinheiro" ? sum + toCents(payment.amount) : sum),
    0
  );
  const posTotalCents = toCents(posTotal);
  const posOverpaymentCents = Math.max(posPaymentsTotalCents - posTotalCents, 0);
  const posRemainingCents = Math.max(posTotalCents - posPaymentsTotalCents, 0);
  const posPaymentsTotal = fromCents(posPaymentsTotalCents);
  const posCreditTotal = fromCents(posCreditTotalCents);
  const posOverpayment = fromCents(posOverpaymentCents);
  const posRemaining = fromCents(posRemainingCents);
  const posInvalidChange = posOverpaymentCents > 0 && posCashTotalCents < posOverpaymentCents;
  const posUsesCredit = posCreditTotalCents > 0;
  const posCreditDetailsReady = Boolean(
    posForm.creditContactName.trim() &&
      posForm.creditContactPhone.trim() &&
      posForm.creditDueDate
  );
  const posCanSubmit =
    posCartItems.length > 0 &&
    posPaymentsTotalCents >= posTotalCents &&
    !posInvalidChange &&
    (!posUsesCredit || posCreditDetailsReady);
  const posFilteredProducts = productCatalog
    .filter((product) => product.active && product.stock > 0)
    .filter((product) => (posCategory === "Todos" ? true : product.category === posCategory))
    .filter((product) =>
      posQuery
        ? `${product.name} ${product.category} ${product.volume}`
            .toLowerCase()
            .includes(posQuery.toLowerCase())
        : true
    );
  const effectiveReportsDays = reports?.periodDays || reportsDays;
  const reportsDailyDelivery = reports?.dailySalesDelivery || [];
  const reportsDailyPos = reports?.dailySalesPos || [];
  const reportsDailyMax = Math.max(
    1,
    ...reportsDailyDelivery.map((entry) => Number(entry.value || 0)),
    ...reportsDailyPos.map((entry) => Number(entry.value || 0))
  );

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
          {!supabase ? (
            <div className="toast-inline">
              Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para acessar.
            </div>
          ) : null}
          <div className="field-grid single">
            <label>
              Email ou usuario
              <input
                type="email"
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
          <Link to="/admin/cadastro" className="button button-outline button-block">
            Criar conta de admin
          </Link>
          <Link to="/" className="button button-outline button-block">
            Voltar para loja
          </Link>
          {message ? <div className="toast-inline">{message}</div> : null}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-shell admin">
        <header className="admin-header">
          <div className="admin-brand">
            <BrandLogo subtitle="Painel operacional" variant="admin" to="/" />
            <div>
              <span className="eyebrow">Dashboard operacional</span>
              <h1 className="admin-store-title">
                {adminProfile?.store_name || "Fortin Delivery Admin"}
              </h1>
              {adminProfile ? (
                <small>Proprietario: {adminProfile.owner_name}</small>
              ) : null}
              <div className="admin-badges">
                <span className={`status-badge ${adminConfirmed ? "is-ok" : "is-warn"}`}>
                  {adminConfirmed ? "Conta confirmada" : "Email nao confirmado"}
                </span>
              </div>
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

  if (!dashboard) {
    return (
      <div className="page-shell admin">
        <header className="admin-header">
          <div className="admin-brand">
            <BrandLogo subtitle="Painel operacional" variant="admin" to="/" />
            <div>
              <span className="eyebrow">Dashboard operacional</span>
              <h1 className="admin-store-title">
                {adminProfile?.store_name || "Fortin Delivery Admin"}
              </h1>
              {adminProfile ? (
                <small>Proprietario: {adminProfile.owner_name}</small>
              ) : null}
              <div className="admin-badges">
                <span className={`status-badge ${adminConfirmed ? "is-ok" : "is-warn"}`}>
                  {adminConfirmed ? "Conta confirmada" : "Email nao confirmado"}
                </span>
              </div>
            </div>
          </div>
          <div className="admin-header-actions">
            <button type="button" className="button button-soft" onClick={() => loadData(token)}>
              <RefreshCcw size={16} />
              Tentar novamente
            </button>
            <Link to="/admin/conta" className="button button-outline">
              Minha conta
            </Link>
            <button type="button" className="button button-muted" onClick={logout}>
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </header>
        <div className="loading-card admin-loading">
          <span className="eyebrow">Painel indisponivel</span>
          <h2>{loadError || "Nao foi possivel carregar os dados do painel."}</h2>
          <p>Verifique se o servidor esta ativo e tente novamente.</p>
        </div>
      </div>
    );
  }

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

  const saveCategory = async () => {
    const name = categoryName.trim();

    if (!name) {
      setMessage("Informe o nome da categoria.");
      return;
    }

    const ok = await runAction(
      () => api.createCategory(token, { name }),
      "Categoria criada."
    );

    if (ok) {
      setCategoryName("");
      setProductForm((current) => ({
        ...current,
        category: current.category || name
      }));
    }
  };

  const saveFees = () =>
    runAction(
      () =>
        api.updateFees(
          token,
          Object.fromEntries(
            feeRows
              .filter((row) => row.name.trim())
              .map((row) => [row.name.trim(), parseAmount(row.value)])
          )
        ),
      "Taxas atualizadas."
    );

  const addFeeRow = () => {
    setFeeRows((current) => [...current, createFeeRow({ isEditing: true })]);
  };

  const editFeeRow = (rowId) => {
    setFeeRows((current) =>
      current.map((entry) =>
        entry.id === rowId ? { ...entry, isEditing: true } : entry
      )
    );
  };

  const stopEditingFeeRow = (rowId) => {
    setFeeRows((current) =>
      current
        .map((entry) =>
          entry.id === rowId ? { ...entry, isEditing: false } : entry
        )
        .filter((entry) => entry.name.trim() || entry.value)
    );
  };

  const removeFeeRow = (rowId) => {
    setFeeRows((current) => current.filter((entry) => entry.id !== rowId));
  };

  const saveCustomer = async () => {
    const payload = {
      name: customerForm.name.trim(),
      phone: customerForm.phone.trim(),
      address: customerForm.address.trim(),
      neighborhood: customerForm.neighborhood.trim(),
      notes: customerForm.notes.trim()
    };

    const ok = await runAction(
      () => api.createCustomer(token, payload),
      "Cliente cadastrado."
    );

    if (ok) {
      setCustomerForm(defaultCustomerForm);
    }
  };

  const saveExpense = async () => {
    const payload = {
      title: expenseForm.title,
      category: expenseForm.category,
      amount: parseAmount(expenseForm.amount),
      date: expenseForm.date,
      note: expenseForm.note
    };

    const ok = await runAction(
      () =>
        editingExpenseId
          ? api.updateExpense(token, editingExpenseId, payload)
          : api.createExpense(token, payload),
      editingExpenseId ? "Despesa atualizada." : "Despesa registrada."
    );

    if (ok) {
      setExpenseForm(defaultExpenseForm);
      setEditingExpenseId("");
    }
  };

  const savePayable = async () => {
    const payload = {
      title: payableForm.title,
      category: payableForm.category,
      amount: parseAmount(payableForm.amount),
      dueDate: payableForm.dueDate,
      note: payableForm.note,
      status: payableForm.status
    };

    const ok = await runAction(
      () =>
        editingPayableId
          ? api.updatePayable(token, editingPayableId, payload)
          : api.createPayable(token, payload),
      editingPayableId ? "Conta a pagar atualizada." : "Conta a pagar registrada."
    );

    if (ok) {
      setPayableForm(defaultPayableForm);
      setEditingPayableId("");
    }
  };

  const saveReceivable = async () => {
    const payload = {
      title: receivableForm.title,
      customerName: receivableForm.customerName,
      customerPhone: receivableForm.customerPhone,
      category: receivableForm.category,
      amount: parseAmount(receivableForm.amount),
      dueDate: receivableForm.dueDate,
      note: receivableForm.note,
      status: receivableForm.status
    };

    const ok = await runAction(
      () =>
        editingReceivableId
          ? api.updateReceivable(token, editingReceivableId, payload)
          : api.createReceivable(token, payload),
      editingReceivableId ? "Conta a receber atualizada." : "Conta a receber registrada."
    );

    if (ok) {
      setReceivableForm(defaultReceivableForm);
      setEditingReceivableId("");
    }
  };

  const openCashRegister = async () => {
    const ok = await runAction(
      () =>
        api.openCashRegister(token, {
          openingBalance: parseAmount(cashOpenForm.openingBalance),
          note: cashOpenForm.note
        }),
      "Caixa aberto."
    );

    if (ok) {
      setCashOpenForm(defaultCashOpenForm);
    }
  };

  const createCashMovement = async () => {
    const ok = await runAction(
      () =>
        api.createCashMovement(token, {
          type: cashMovementForm.type,
          amount: parseAmount(cashMovementForm.amount),
          note: cashMovementForm.note
        }),
      cashMovementForm.type === "withdrawal"
        ? "Retirada registrada."
        : "Suprimento registrado."
    );

    if (ok) {
      setCashMovementForm(defaultCashMovementForm);
    }
  };

  const closeCashRegister = async () => {
    const ok = await runAction(
      () =>
        api.closeCashRegister(token, {
          countedBalance: parseAmount(cashCloseForm.countedBalance),
          note: cashCloseForm.note
        }),
      "Caixa fechado."
    );

    if (ok) {
      setCashCloseForm(defaultCashCloseForm);
    }
  };

  const saveRider = async () => {
    const payload = {
      name: riderForm.name,
      phone: riderForm.phone,
      active: riderForm.active
    };

    const ok = await runAction(
      () =>
        editingRiderId
          ? api.updateRider(token, editingRiderId, payload)
          : api.createRider(token, payload),
      editingRiderId ? "Motoboy atualizado." : "Motoboy registrado."
    );

    if (ok) {
      setRiderForm(defaultRiderForm);
      setEditingRiderId("");
    }
  };

  const editRider = (rider) => {
    setEditingRiderId(rider.id);
    setRiderForm({
      name: rider.name || "",
      phone: rider.phone || "",
      active: rider.active ?? true
    });
  };

  const removeRider = (riderId) =>
    runAction(() => api.deleteRider(token, riderId), "Motoboy removido.");

  const assignRider = (orderId, riderId) =>
    runAction(() => api.updateOrderRider(token, orderId, riderId), "Motoboy atualizado no pedido.");

  const exportRidersCsv = () => {
    if (!riderStats.length) {
      setMessage("Nao ha dados de motoboys para exportar.");
      return;
    }

    const header = ["Motoboy", "Telefone", "Status", "Entregas", "Taxas (R$)"];
    const rows = riderStats.map((entry) => [
      entry.rider.name,
      entry.rider.phone || "",
      entry.rider.active ? "Ativo" : "Inativo",
      entry.deliveries,
      entry.feesTotal.toFixed(2).replace(".", ",")
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    downloadCsv(`motoboys-${riderPeriodDays}dias.csv`, csv);
  };

  const exportRidersPdf = () => {
    if (!riderStats.length) {
      setMessage("Nao ha dados de motoboys para exportar.");
      return;
    }

    const rowsHtml = riderStats
      .map(
        (entry) => `
          <tr>
            <td>${entry.rider.name}</td>
            <td>${entry.rider.phone || "-"}</td>
            <td>${entry.rider.active ? "Ativo" : "Inativo"}</td>
            <td class="right">${entry.deliveries}</td>
            <td class="right">${formatCurrency(entry.feesTotal)}</td>
          </tr>
        `
      )
      .join("");

    const dailyHtml = riderDailyList
      .map(
        (entry) => `
          <tr>
            <td>${formatDayLabel(entry.date)}</td>
            <td class="right">${entry.deliveries}</td>
            <td class="right">${formatCurrency(entry.feesTotal)}</td>
          </tr>
        `
      )
      .join("");

    const html = `<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Relatorio motoboys</title>
          <style>
            body { font-family: "Arial", sans-serif; margin: 24px; color: #112123; }
            h1 { margin: 0 0 8px; }
            h2 { margin: 24px 0 8px; font-size: 18px; }
            p { margin: 0 0 16px; color: #5f6b6d; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            th { text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; color: #5f6b6d; }
            .right { text-align: right; }
            .meta { display: flex; gap: 16px; font-size: 12px; color: #5f6b6d; }
          </style>
        </head>
        <body>
          <h1>Relatorio de motoboys</h1>
          <p>Periodo: ultimos ${riderPeriodDays} dias</p>
          <div class="meta">
            <span>Total de motoboys: ${riders.length}</span>
            <span>Entregas no periodo: ${deliveredOrdersInPeriod.length}</span>
          </div>
          <h2>Resumo por motoboy</h2>
          <table>
            <thead>
              <tr>
                <th>Motoboy</th>
                <th>Telefone</th>
                <th>Status</th>
                <th class="right">Entregas</th>
                <th class="right">Taxas</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <h2>Historico diario</h2>
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th class="right">Entregas</th>
                <th class="right">Taxas</th>
              </tr>
            </thead>
            <tbody>
              ${dailyHtml}
            </tbody>
          </table>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>`;

    const printWindow = window.open("", "_blank", "width=900,height=720");
    if (!printWindow) {
      setMessage("Popup bloqueado. Permita o popup para exportar PDF.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const editExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      title: expense.title || "",
      category: expense.category || "",
      amount: expense.amount ?? "",
      date: expense.date ? String(expense.date).slice(0, 10) : "",
      note: expense.note || ""
    });
  };

  const removeExpense = (expenseId) =>
    runAction(() => api.deleteExpense(token, expenseId), "Despesa removida.");

  const editPayable = (entry) => {
    setEditingPayableId(entry.id);
    setPayableForm({
      title: entry.title || "",
      category: entry.category || "",
      amount: entry.amount ?? "",
      dueDate: entry.dueDate ? String(entry.dueDate).slice(0, 10) : "",
      note: entry.note || "",
      status: entry.status || "pending"
    });
  };

  const removePayable = (id) =>
    runAction(() => api.deletePayable(token, id), "Conta a pagar removida.");

  const togglePayableStatus = (entry) =>
    runAction(
      () =>
        api.updatePayable(token, entry.id, {
          status: entry.status === "paid" ? "pending" : "paid"
        }),
      entry.status === "paid"
        ? "Conta a pagar reaberta."
        : "Conta a pagar marcada como paga."
    );

  const editReceivable = (entry) => {
    setEditingReceivableId(entry.id);
    setReceivableForm({
      title: entry.title || "",
      customerName: entry.customerName || "",
      customerPhone: entry.customerPhone || "",
      category: entry.category || "",
      amount: entry.amount ?? "",
      dueDate: entry.dueDate ? String(entry.dueDate).slice(0, 10) : "",
      note: entry.note || "",
      status: entry.status || "pending"
    });
  };

  const removeReceivable = (id) =>
    runAction(() => api.deleteReceivable(token, id), "Conta a receber removida.");

  const toggleReceivableStatus = (entry) =>
    runAction(
      () =>
        api.updateReceivable(token, entry.id, {
          status: entry.status === "paid" ? "pending" : "paid"
        }),
      entry.status === "paid"
        ? "Conta a receber reaberta."
        : "Conta a receber marcada como recebida."
    );

  const removeCategory = (name) =>
    runAction(() => api.deleteCategory(token, name), "Categoria removida.");

  const clearHistory = (target) =>
  {
    const label =
      target === "delivery"
        ? "o historico de pedidos delivery"
        : target === "pos"
          ? "o historico de vendas PDV"
          : "todo o historico de pedidos e vendas";

    if (!window.confirm(`Tem certeza que deseja limpar ${label}? Esta acao nao pode ser desfeita.`)) {
      return Promise.resolve(false);
    }

    return runAction(
      () => api.clearHistory(token, { target }),
      target === "delivery"
        ? "Historico de pedidos delivery limpo."
        : target === "pos"
          ? "Historico de vendas PDV limpo."
          : "Historico geral limpo."
    );
  };

  const resolveSupportRequest = (id) =>
    runAction(
      () => api.resolveSupportRequest(token, id),
      "Solicitacao marcada como resolvida."
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

  const updatePosQuantity = (productId, nextQuantity) => {
    if (nextQuantity <= 0) {
      setPosCart((current) => current.filter((item) => item.id !== productId));
      return;
    }

    const product = productsById[productId];
    if (product && nextQuantity > product.stock) {
      setPosFeedback("Estoque insuficiente para esta quantidade.");
      return;
    }

    setPosCart((current) => {
      const existing = current.find((item) => item.id === productId);
      if (!existing) {
        return [...current, { id: productId, quantity: nextQuantity }];
      }
      return current.map((item) => (item.id === productId ? { ...item, quantity: nextQuantity } : item));
    });
  };

  const clearPosCart = () => {
    setPosCart([]);
    setPosFeedback("");
  };

  const handleBrowserPrint = (order) => {
    if (!order) {
      return;
    }

    const receiptHtml = buildReceiptHtml({
      order,
      settings: dashboard?.settings || {},
      width: posPrintWidth
    });
    const printWindow = window.open("", "_blank", "width=420,height=640");

    if (!printWindow) {
      setPosFeedback("Popup bloqueado. Permita o popup para imprimir.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  const handlePosSubmit = async () => {
    if (!posCartItems.length) {
      setPosFeedback("Carrinho vazio. Adicione itens para registrar a venda.");
      return;
    }

    const paymentsPayload = posPayments
      .map((payment) => ({
        method: payment.method,
        amount: parseAmount(payment.amount)
      }))
      .filter((payment) => payment.amount > 0);

    if (!paymentsPayload.length) {
      setPosFeedback("Informe ao menos uma forma de pagamento.");
      return;
    }

    if (posPaymentsTotalCents < posTotalCents) {
      const missing = fromCents(posTotalCents - posPaymentsTotalCents);
      setPosFeedback(`Falta pagar ${formatCurrency(missing)}.`);
      return;
    }

    if (posInvalidChange) {
      setPosFeedback("Troco maior que dinheiro informado.");
      return;
    }

    if (posUsesCredit && !posCreditDetailsReady) {
      setPosFeedback("Preencha nome, telefone e vencimento do fiado.");
      return;
    }

    setPosSubmitting(true);
    setPosFeedback("");

    try {
      const paymentMethod =
        paymentsPayload.length === 1 ? paymentsPayload[0].method : "multiple";
      const payload = await api.createPosOrder(token, {
        name: posForm.name,
        phone: posForm.phone,
        paymentMethod,
        payments: paymentsPayload,
        note: posForm.note,
        couponCode: posForm.couponCode,
        manualDiscount: parseAmount(posForm.manualDiscount),
        manualDiscountPercent: clampPercent(posForm.manualDiscountPercent),
        manualSurcharge: parseAmount(posForm.manualSurcharge),
        manualSurchargePercent: clampPercent(posForm.manualSurchargePercent),
        creditContactName: posForm.creditContactName,
        creditContactPhone: posForm.creditContactPhone,
        creditDueDate: posForm.creditDueDate,
        creditNote: posForm.creditNote,
        items: posCartItems.map((item) => ({
          productId: item.id,
          quantity: item.quantity
        }))
      });

      setPosLastOrder(payload.order);
      setPosCart([]);
      setPosForm(defaultPosForm);
      setPosPayments([createPaymentRow()]);
      await loadData(token, true);
      if (payload.order?.id && posPrintedRef.current !== payload.order.id) {
        posPrintedRef.current = payload.order.id;
        handleBrowserPrint(payload.order);
      }
      setPosFeedback(
        [`Venda PDV registrada: #${payload.order.number}.`].filter(Boolean).join(" ")
      );
    } catch (error) {
      setPosFeedback(error.message);
    } finally {
      setPosSubmitting(false);
    }
  };

  return (
    <div className="page-shell admin">
      <audio ref={orderSoundRef} src="/audio/ifood-motoboy.mp3" preload="auto" />
      <header className="admin-header">
        <div className="admin-brand">
          <BrandLogo subtitle="Painel operacional" variant="admin" to="/" />
          <div>
            <span className="eyebrow">Dashboard operacional</span>
            <h1 className="admin-store-title">
              {adminProfile?.store_name || "Fortin Delivery Admin"}
            </h1>
            {adminProfile ? (
              <small>Proprietario: {adminProfile.owner_name}</small>
            ) : null}
            <div className="admin-badges">
              <span className={`status-badge ${adminConfirmed ? "is-ok" : "is-warn"}`}>
                {adminConfirmed ? "Conta confirmada" : "Email nao confirmado"}
              </span>
            </div>
          </div>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="button button-soft" onClick={() => loadData(token)}>
            <RefreshCcw size={16} />
            Atualizar
          </button>
          <Link to="/admin/conta" className="button button-outline">
            Minha conta
          </Link>
          <button
            type="button"
            className={`button ${soundEnabled ? "button-soft" : "button-muted"}`}
            onClick={() => {
              if (isRinging) {
                stopOrderRing();
                setSoundEnabled(false);
                return;
              }
              setSoundEnabled((current) => {
                const next = !current;
                if (!next) {
                  stopOrderRing();
                }
                if (next) {
                  playOrderSound(true);
                }
                return next;
              });
            }}
          >
            {isRinging ? "Silenciar agora" : `Som pedidos: ${soundEnabled ? "On" : "Off"}`}
          </button>
          <button type="button" className="button button-outline" onClick={() => playOrderSound(true)}>
            Testar som
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
        <MetricCard
          label="Delivery (hoje)"
          value={formatCurrency(dashboard.kpis.salesTodayDelivery)}
          accent="forest"
          hint={`${dashboard.kpis.ordersTodayDelivery} pedidos`}
        />
        <MetricCard
          label="Balcao (hoje)"
          value={formatCurrency(dashboard.kpis.salesTodayPos)}
          accent="ruby"
          hint={`${dashboard.kpis.ordersTodayPos} vendas`}
        />
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
          <div className={`whatsapp-status-card ${pendingSupportRequests.length ? "has-error" : ""}`}>
            <span>Atendimento humano</span>
            <strong>{pendingSupportRequests.length ? `${pendingSupportRequests.length} conversa(s) aguardando` : "Nenhuma conversa pendente"}</strong>
            <small>
              {pendingSupportRequests[0]?.requestedAt
                ? `Ultimo pedido: ${formatDate(pendingSupportRequests[0].requestedAt)}`
                : "Quando o cliente escolher a opcao 6, aparece aqui."}
            </small>
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
        {pendingSupportRequests.length ? (
          <div className="support-request-list">
            {pendingSupportRequests.map((entry) => (
              <div key={entry.id} className="support-request-row">
                <div>
                  <strong>{entry.customerName || "Cliente do WhatsApp"}</strong>
                  <span>{entry.phone || "Sem telefone"} • {entry.requestedAt ? formatDate(entry.requestedAt) : "-"}</span>
                </div>
                <div className="card-actions">
                  <span className="status-pill is-pending">Prioridade</span>
                  <button
                    type="button"
                    className="button button-primary button-compact"
                    onClick={() => resolveSupportRequest(entry.id)}
                  >
                    Marcar resolvido
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
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
          {visibleOrders.map((order) => (
            <article key={order.id} className="admin-card order-card">
              <div className="order-topline">
                <div>
                  <span className="eyebrow">{order.channel === "pos" ? "Venda PDV" : "Pedido"} #{order.number}</span>
                  <h3>{order.customer.name}</h3>
                  <p>{order.customer.phone} - {order.customer.address}</p>
                </div>
                <div className="order-summary">
                  {order.channel === "pos" ? <span className="status-pill pos-pill">PDV</span> : null}
                  <span className="status-pill">{STATUS_STEPS.find((step) => step.key === order.status)?.label || order.status}</span>
                  <strong>{formatCurrency(order.total)}</strong>
                  <small className="order-payment">
                    {[
                      order.payments?.length
                        ? order.payments
                            .map(
                              (payment) =>
                                `${paymentLabels[payment.method] || payment.method} ${formatCurrency(payment.amount)}`
                            )
                            .join(" + ")
                        : paymentLabels[order.paymentMethod] || order.paymentMethod || "",
                      order.changeDue > 0 ? `Troco ${formatCurrency(order.changeDue)}` : ""
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </small>
                  {order.channel === "pos" ? (
                    <button
                      type="button"
                      className="button button-outline button-compact"
                      onClick={() => handleBrowserPrint(order)}
                    >
                      Imprimir
                    </button>
                  ) : null}
                </div>
              </div>
              {order.channel !== "pos" ? (
                <div className="order-rider">
                  <label>
                    Motoboy
                    <select
                      value={order.riderId || ""}
                      onChange={(event) => assignRider(order.id, event.target.value || null)}
                      disabled={saving}
                    >
                      <option value="">Sem motoboy</option>
                      {riders.map((rider) => (
                        <option key={rider.id} value={rider.id}>
                          {rider.name}{rider.active ? "" : " (inativo)"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
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
                    onClick={async () => {
                      if (step.key === "accepted") {
                        const previousRingingOrderIds = [...ringingOrderIdsRef.current];
                        ringingOrderIdsRef.current = ringingOrderIdsRef.current.filter(
                          (ringingOrderId) => ringingOrderId !== order.id
                        );
                        stopOrderRing();
                        const success = await runAction(
                          () => api.updateOrderStatus(token, order.id, step.key),
                          "Status atualizado e cliente notificado."
                        );
                        if (!success) {
                          ringingOrderIdsRef.current = previousRingingOrderIds;
                          playOrderSound();
                        }
                        return;
                      }
                      await runAction(
                        () => api.updateOrderStatus(token, order.id, step.key),
                        "Status atualizado e cliente notificado."
                      );
                    }}
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {visibleOrderCount < orders.length || orders.length >= orderLimit ? (
            <button type="button" className="button button-outline button-block" onClick={loadMoreOrders}>
              Carregar mais pedidos
            </button>
          ) : null}
        </section>
      ) : null}

      {activeTab === "pos" ? (
        <section className="admin-grid pos-grid">
          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Caixa PDV</span>
                <h2>Abertura, suprimento e fechamento</h2>
              </div>
              <span className={`status-pill ${cashSession ? "is-online" : "is-disabled"}`}>
                {cashSession ? "Caixa aberto" : "Caixa fechado"}
              </span>
            </div>
            <div className="summary-list">
              <div><span>Status</span><strong>{cashSession ? "Aberto" : "Fechado"}</strong></div>
              <div><span>Saldo esperado</span><strong>{formatCurrency(cashSession?.expectedBalance || 0)}</strong></div>
              <div><span>Abertura</span><strong>{cashSession?.openedAt ? formatDate(cashSession.openedAt) : "-"}</strong></div>
              <div><span>Fechamentos salvos</span><strong>{cashHistory.length}</strong></div>
            </div>
            {!cashSession ? (
              <div className="expense-form">
                <div className="field-grid">
                  <label>
                    Valor de abertura
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashOpenForm.openingBalance}
                      onChange={(event) =>
                        setCashOpenForm((current) => ({ ...current, openingBalance: event.target.value }))
                      }
                      placeholder="0,00"
                    />
                  </label>
                  <label>
                    Observacao
                    <input
                      value={cashOpenForm.note}
                      onChange={(event) =>
                        setCashOpenForm((current) => ({ ...current, note: event.target.value }))
                      }
                      placeholder="Turno da tarde, abertura da loja..."
                    />
                  </label>
                </div>
                <button type="button" className="button button-primary" disabled={saving} onClick={openCashRegister}>
                  <Wallet size={16} />
                  Abrir caixa
                </button>
              </div>
            ) : (
              <div className="expense-form">
                <div className="field-grid">
                  <label>
                    Movimento
                    <select
                      value={cashMovementForm.type}
                      onChange={(event) =>
                        setCashMovementForm((current) => ({ ...current, type: event.target.value }))
                      }
                    >
                      <option value="withdrawal">Retirada de caixa</option>
                      <option value="supply">Suprimento de caixa</option>
                    </select>
                  </label>
                  <label>
                    Valor
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashMovementForm.amount}
                      onChange={(event) =>
                        setCashMovementForm((current) => ({ ...current, amount: event.target.value }))
                      }
                      placeholder="0,00"
                    />
                  </label>
                  <label className="field-span">
                    Observacao
                    <input
                      value={cashMovementForm.note}
                      onChange={(event) =>
                        setCashMovementForm((current) => ({ ...current, note: event.target.value }))
                      }
                      placeholder="Motivo do movimento"
                    />
                  </label>
                  <label>
                    Saldo contado
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashCloseForm.countedBalance}
                      onChange={(event) =>
                        setCashCloseForm((current) => ({ ...current, countedBalance: event.target.value }))
                      }
                      placeholder="0,00"
                    />
                  </label>
                  <label>
                    Fechamento
                    <input
                      value={cashCloseForm.note}
                      onChange={(event) =>
                        setCashCloseForm((current) => ({ ...current, note: event.target.value }))
                      }
                      placeholder="Observacoes do fechamento"
                    />
                  </label>
                </div>
                <div className="card-actions">
                  <button type="button" className="button button-outline" disabled={saving} onClick={createCashMovement}>
                    {cashMovementForm.type === "withdrawal" ? "Registrar retirada" : "Registrar suprimento"}
                  </button>
                  <button type="button" className="button button-primary" disabled={saving} onClick={closeCashRegister}>
                    Fechar caixa
                  </button>
                </div>
                {(cashSession.movements || []).length ? (
                  <div className="expense-list">
                    {cashSession.movements.slice().reverse().slice(0, 6).map((movement) => (
                      <div key={movement.id} className="expense-row">
                        <div>
                          <strong>{movement.type}</strong>
                          <span>{movement.createdAt ? formatDate(movement.createdAt) : "-"}</span>
                        </div>
                        <div className="expense-actions">
                          <strong>{movement.amount < 0 ? "- " : ""}{formatCurrency(Math.abs(Number(movement.amount || 0)))}</strong>
                          <span>{movement.note || "Sem observacao"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </article>

          <article className="admin-card pos-products">
            <div className="card-header">
              <div>
                <span className="eyebrow">PDV presencial</span>
                <h2>Registrar venda no balcao</h2>
              </div>
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setPosQuery("");
                  setPosCategory("Todos");
                }}
              >
                Limpar filtros
              </button>
            </div>
            <div className="pos-filters">
              <div className="pos-search">
                <Search size={16} />
                <input
                  value={posQuery}
                  onChange={(event) => setPosQuery(event.target.value)}
                  placeholder="Buscar por nome, categoria ou volume"
                />
              </div>
              <select value={posCategory} onChange={(event) => setPosCategory(event.target.value)}>
                <option value="Todos">Todas as categorias</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="pos-product-list">
              {posFilteredProducts.length ? (
                posFilteredProducts.map((product) => {
                  const quantity = posQuantities[product.id] || 0;
                  return (
                    <div key={product.id} className="pos-product-row">
                      <img src={product.image} alt={product.name} />
                      <div className="pos-product-info">
                        <strong>{product.name}</strong>
                        <span>{product.category} • {product.volume}</span>
                        <small>Estoque: {product.stock} un.</small>
                      </div>
                      <div className="pos-product-actions">
                        {quantity > 0 ? (
                          <div className="stepper">
                            <button type="button" onClick={() => updatePosQuantity(product.id, quantity - 1)}>
                              <Minus size={14} />
                            </button>
                            <span>{quantity}</span>
                            <button type="button" onClick={() => updatePosQuantity(product.id, quantity + 1)}>
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <button type="button" className="button button-primary" onClick={() => updatePosQuantity(product.id, 1)}>
                            <ShoppingCart size={16} />
                            Adicionar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state compact">
                  <h3>Nenhum produto encontrado</h3>
                  <p>Verifique os filtros ou cadastre novos itens no estoque.</p>
                </div>
              )}
            </div>
          </article>

          <article className="admin-card pos-cart">
            <div className="card-header">
              <div>
                <span className="eyebrow">Carrinho PDV</span>
                <h2>Resumo da venda</h2>
                {posLastOrder ? <p>Ultima venda registrada: #{posLastOrder.number}</p> : null}
              </div>
              <button type="button" className="button button-muted" onClick={clearPosCart} disabled={!posCartItems.length}>
                Limpar carrinho
              </button>
            </div>

            <div className="pos-cart-items">
              {posCartItems.length ? (
                posCartItems.map((item) => (
                  <div key={item.id} className="pos-cart-item">
                    <img src={item.image} alt={item.name} />
                    <div className="pos-cart-item-info">
                      <strong>{item.name}</strong>
                      <span>{item.quantity}x {formatCurrency(item.salePrice)}</span>
                      <small>{formatCurrency(item.salePrice * item.quantity)}</small>
                    </div>
                    <div className="pos-cart-item-actions">
                      <div className="stepper">
                        <button type="button" onClick={() => updatePosQuantity(item.id, item.quantity - 1)}>
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => updatePosQuantity(item.id, item.quantity + 1)}>
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => updatePosQuantity(item.id, 0)}
                        aria-label={`Excluir ${item.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state compact">
                  <h3>Carrinho vazio</h3>
                  <p>Adicione os itens ao lado para montar a venda.</p>
                </div>
              )}
            </div>

            <div className="pos-cart-form">
              <div className="field-grid">
                <label>
                  Cliente
                  <input
                    value={posForm.name}
                    onChange={(event) => setPosForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Cliente balcao"
                  />
                </label>
                <label>
                  Telefone (opcional)
                  <input
                    value={posForm.phone}
                    onChange={(event) => setPosForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="(11) 99999-9999"
                  />
                </label>
                <label>
                  Largura da impressao
                  <select value={posPrintWidth} onChange={(event) => setPosPrintWidth(event.target.value)}>
                    <option value="58">58mm</option>
                    <option value="80">80mm</option>
                  </select>
                </label>
                <label>
                  Cupom
                  <div className="input-with-icon">
                    <TicketPercent size={16} />
                    <input
                      value={posForm.couponCode}
                      onChange={(event) => setPosForm((current) => ({ ...current, couponCode: event.target.value.toUpperCase() }))}
                      placeholder="CHEGUEI"
                    />
                  </div>
                </label>
                <label>
                  Desconto manual (R$)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={posForm.manualDiscount}
                    onChange={(event) => setPosForm((current) => ({ ...current, manualDiscount: event.target.value }))}
                    placeholder="0,00"
                  />
                </label>
                <label>
                  Desconto manual (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={posForm.manualDiscountPercent}
                    onChange={(event) => setPosForm((current) => ({ ...current, manualDiscountPercent: event.target.value }))}
                    placeholder="0"
                  />
                </label>
                <label>
                  Acrescimo manual (R$)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={posForm.manualSurcharge}
                    onChange={(event) => setPosForm((current) => ({ ...current, manualSurcharge: event.target.value }))}
                    placeholder="0,00"
                  />
                </label>
                <label>
                  Acrescimo manual (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={posForm.manualSurchargePercent}
                    onChange={(event) => setPosForm((current) => ({ ...current, manualSurchargePercent: event.target.value }))}
                    placeholder="0"
                  />
                </label>
              </div>

              <div className="pos-payments">
                <div className="pos-payments-head">
                  <strong>Pagamentos</strong>
                  <div className="pos-payments-actions">
                    <button
                      type="button"
                      className="button button-soft"
                      onClick={() => {
                        if (!posPayments.length) {
                          return;
                        }

                        const totalCents = posTotalCents;
                        const count = posPayments.length;
                        const base = Math.floor(totalCents / count);
                        const remainder = totalCents - base * count;

                        setPosPayments((current) =>
                          current.map((entry, index) => ({
                            ...entry,
                            amount: ((base + (index < remainder ? 1 : 0)) / 100).toFixed(2)
                          }))
                        );
                      }}
                    >
                      Dividir igualmente
                    </button>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setPosPayments((current) => [...current, createPaymentRow()])}
                    >
                      Adicionar forma
                    </button>
                  </div>
                </div>
                {posPayments.map((payment) => (
                  <div className="pos-payment-row" key={payment.id}>
                    <select
                      value={payment.method}
                      onChange={(event) => {
                        const method = event.target.value;
                        setPosPayments((current) =>
                          current.map((entry) =>
                            entry.id === payment.id ? { ...entry, method } : entry
                          )
                        );
                      }}
                    >
                      {paymentOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={payment.amount}
                      onChange={(event) => {
                        const amount = event.target.value;
                        setPosPayments((current) =>
                          current.map((entry) =>
                            entry.id === payment.id ? { ...entry, amount } : entry
                          )
                        );
                      }}
                      placeholder="0,00"
                    />
                    {posPayments.length > 1 ? (
                      <button
                        type="button"
                        className="button button-muted"
                        onClick={() =>
                          setPosPayments((current) =>
                            current.filter((entry) => entry.id !== payment.id)
                          )
                        }
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <label>
                Observacoes da venda
                <textarea
                  rows="3"
                  value={posForm.note}
                  onChange={(event) => setPosForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Informacoes internas, forma de retirada, etc."
                />
              </label>

              {posUsesCredit ? (
                <div className="form-grid">
                  <label>
                    Nome do fiado
                    <input
                      value={posForm.creditContactName}
                      onChange={(event) =>
                        setPosForm((current) => ({
                          ...current,
                          creditContactName: event.target.value
                        }))
                      }
                      placeholder="Quem esta levando no fiado"
                    />
                  </label>
                  <label>
                    Telefone do fiado
                    <input
                      value={posForm.creditContactPhone}
                      onChange={(event) =>
                        setPosForm((current) => ({
                          ...current,
                          creditContactPhone: event.target.value
                        }))
                      }
                      placeholder="(00) 00000-0000"
                    />
                  </label>
                  <label>
                    Vencimento do fiado
                    <input
                      type="date"
                      value={posForm.creditDueDate}
                      onChange={(event) =>
                        setPosForm((current) => ({
                          ...current,
                          creditDueDate: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="field-span">
                    Observacao do fiado
                    <textarea
                      rows="2"
                      value={posForm.creditNote}
                      onChange={(event) =>
                        setPosForm((current) => ({
                          ...current,
                          creditNote: event.target.value
                        }))
                      }
                      placeholder="Referencia, combinado de pagamento, etc."
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="pos-cart-footer">
              <div className="pos-total-line">
                <span>Subtotal</span>
                <strong>{formatCurrency(posSubtotal)}</strong>
              </div>
              {posPromoDiscount > 0 ? (
                <div className="pos-total-line success">
                  <span>Desconto cupom</span>
                  <strong>- {formatCurrency(posPromoDiscount)}</strong>
                </div>
              ) : null}
              {posManualDiscountPercentApplied > 0 ? (
                <div className="pos-total-line success">
                  <span>Desconto % ({posManualDiscountPercent.toFixed(2)}%)</span>
                  <strong>- {formatCurrency(posManualDiscountPercentApplied)}</strong>
                </div>
              ) : null}
              {posManualDiscountFixedApplied > 0 ? (
                <div className="pos-total-line success">
                  <span>Desconto manual</span>
                  <strong>- {formatCurrency(posManualDiscountFixedApplied)}</strong>
                </div>
              ) : null}
              {posManualSurchargePercentAmount > 0 ? (
                <div className="pos-total-line">
                  <span>Acrescimo % ({posManualSurchargePercent.toFixed(2)}%)</span>
                  <strong>{formatCurrency(posManualSurchargePercentAmount)}</strong>
                </div>
              ) : null}
              {posManualSurcharge > 0 ? (
                <div className="pos-total-line">
                  <span>Acrescimo</span>
                  <strong>{formatCurrency(posManualSurcharge)}</strong>
                </div>
              ) : null}
              <div className="pos-total-line">
                <span>Pago</span>
                <strong>{formatCurrency(posPaymentsTotal)}</strong>
              </div>
              {posUsesCredit ? (
                <div className="pos-total-line">
                  <span>Lancado em fiado</span>
                  <strong>{formatCurrency(posCreditTotal)}</strong>
                </div>
              ) : null}
              {posRemaining > 0 ? (
                <div className="pos-total-line">
                  <span>Falta pagar</span>
                  <strong>{formatCurrency(posRemaining)}</strong>
                </div>
              ) : null}
              {posOverpayment > 0 ? (
                <div className={`pos-total-line ${posInvalidChange ? "has-error" : "success"}`}>
                  <span>Troco</span>
                  <strong>{formatCurrency(posOverpayment)}</strong>
                </div>
              ) : null}
              <div className="pos-total-line grand">
                <span>Total</span>
                <strong>{formatCurrency(posTotal)}</strong>
              </div>
              <button
                type="button"
                className="button button-primary button-block"
                onClick={handlePosSubmit}
                disabled={posSubmitting || !posCanSubmit}
              >
                {posSubmitting ? "Registrando venda..." : "Finalizar venda PDV"}
              </button>
              {posFeedback ? <div className="toast-inline">{posFeedback}</div> : null}
            </div>
          </article>
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
            <div className="summary-list">
              <div><span>Categorias</span><strong>{categories.length}</strong></div>
              <div><span>Produtos zerados</span><strong>{stockSummary.zeroStockCount}</strong></div>
              <div><span>Estoque baixo</span><strong>{stockSummary.lowStockCount}</strong></div>
              <div><span>Valor em estoque</span><strong>{formatCurrency(stockSummary.inventoryValue)}</strong></div>
            </div>
            <div className="expense-form">
              <div className="field-grid">
                <label className="field-span">
                  Nova categoria
                  <input
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="Ex.: Conveniencia, Gelo, Carvao"
                  />
                </label>
              </div>
              <div className="card-actions">
                <button type="button" className="button button-outline" disabled={saving} onClick={saveCategory}>
                  <FolderPlus size={16} />
                  Criar categoria
                </button>
              </div>
              {categories.length ? (
                <div className="chips-list">
                  {categories.map((category) => (
                    <span key={category} className="chip light">
                      {category}
                      {!productCatalog.some((product) => product.category === category) ? (
                        <button
                          type="button"
                          className="button button-muted button-compact"
                          onClick={() => removeCategory(category)}
                        >
                          Remover
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : null}
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
            {visibleProducts.map((product) => (
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
            {visibleProductCount < productCatalog.length || productCatalog.length >= productLimit ? (
              <button
                type="button"
                className="button button-outline button-block"
                onClick={loadMoreProducts}
              >
                Carregar mais produtos
              </button>
            ) : null}
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
            {visiblePromotions.map((promotion) => (
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
            {visiblePromotionCount < promotionsCatalog.length || promotionsCatalog.length >= promotionLimit ? (
              <button
                type="button"
                className="button button-outline button-block"
                onClick={loadMorePromotions}
              >
                Carregar mais promocoes
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "customers" ? (
        <section className="admin-grid">
          <article className="admin-card form-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Cadastro manual</span>
                <h2>Novo cliente</h2>
              </div>
            </div>
            <div className="summary-list">
              <div><span>Clientes cadastrados</span><strong>{customers.length}</strong></div>
              <div><span>Total acumulado</span><strong>{formatCurrency(customers.reduce((sum, customer) => sum + Number(customer.totalSpent || 0), 0))}</strong></div>
            </div>
            <div className="field-grid">
              <label>
                Nome
                <input
                  value={customerForm.name}
                  onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Telefone
                <input
                  value={customerForm.phone}
                  onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </label>
              <label>
                Bairro
                <input
                  value={customerForm.neighborhood}
                  onChange={(event) =>
                    setCustomerForm((current) => ({ ...current, neighborhood: event.target.value }))
                  }
                />
              </label>
              <label className="field-span">
                Endereco
                <input
                  value={customerForm.address}
                  onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))}
                />
              </label>
              <label className="field-span">
                Observacoes
                <textarea
                  rows="3"
                  value={customerForm.notes}
                  onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
            </div>
            <button type="button" className="button button-primary button-block" disabled={saving} onClick={saveCustomer}>
              {saving ? "Salvando..." : "Cadastrar cliente"}
            </button>
          </article>
          <div className="list-column">
            {visibleCustomers.map((customer) => (
              <article key={customer.id} className="admin-card customer-card">
                <div className="customer-head">
                  <div>
                    <span className="eyebrow">
                      {customer.previousOrders.length ? "Cliente recorrente" : "Cadastro manual"}
                    </span>
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
            {visibleCustomerCount < customers.length || customers.length >= customerLimit ? (
              <button type="button" className="button button-outline button-block" onClick={loadMoreCustomers}>
                Carregar mais clientes
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "operations" ? (
        <section className="admin-grid reports-grid">
          {reportsLoading || !reports ? (
            <article className="admin-card">
              <span className="eyebrow">Relatorios</span>
              <h2>Carregando indicadores...</h2>
              <p>Os dados mais pesados desta aba sao carregados sob demanda para deixar o painel mais rapido.</p>
            </article>
          ) : null}
          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Relatorios</span>
                <h2>Resumo do desempenho</h2>
              </div>
            </div>
            <div className="summary-list">
              <div><span>Pedidos do dia</span><strong>{dashboard.kpis.ordersToday}</strong></div>
              <div><span>Faturamento semanal</span><strong>{formatCurrency(reportMetrics.weeklyRevenue)}</strong></div>
              <div><span>Faturamento mensal</span><strong>{formatCurrency(reportMetrics.monthlyRevenue)}</strong></div>
              <div><span>Entregas na rua</span><strong>{deliveryBoard.length}</strong></div>
              <div><span>Semanal delivery</span><strong>{formatCurrency(reportMetrics.weeklyRevenueDelivery)}</strong></div>
              <div><span>Semanal balcao</span><strong>{formatCurrency(reportMetrics.weeklyRevenuePos)}</strong></div>
              <div><span>Mensal delivery</span><strong>{formatCurrency(reportMetrics.monthlyRevenueDelivery)}</strong></div>
              <div><span>Mensal balcao</span><strong>{formatCurrency(reportMetrics.monthlyRevenuePos)}</strong></div>
              <div><span>Ticket medio delivery</span><strong>{formatCurrency(reportMetrics.avgTicketDelivery)}</strong></div>
              <div><span>Ticket medio balcao</span><strong>{formatCurrency(reportMetrics.avgTicketPos)}</strong></div>
            </div>
            <div className="rank-list">
              {reportMetrics.topProducts.map((product) => (
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
                <span className="eyebrow">Estoque</span>
                <h2>Saude do estoque</h2>
              </div>
              <span className="status-pill">Minimo {stockSummary.lowThreshold} un.</span>
            </div>
            <div className="summary-list">
              <div><span>Produtos cadastrados</span><strong>{stockSummary.totalProducts}</strong></div>
              <div><span>Quantidade total</span><strong>{stockSummary.totalUnits}</strong></div>
              <div><span>Estoque zerado</span><strong>{stockSummary.zeroStockCount}</strong></div>
              <div><span>Estoque baixo</span><strong>{stockSummary.lowStockCount}</strong></div>
              <div><span>Valor em estoque</span><strong>{formatCurrency(stockSummary.inventoryValue)}</strong></div>
            </div>
            {zeroStockProducts.length || lowStockProducts.length ? (
              <div className="alert-stack">
                {zeroStockProducts.length ? (
                  <div className="promo-note warning-note">
                    <AlertTriangle size={18} />
                    <p>
                      {zeroStockProducts.length} produto(s) com estoque zerado:
                      {" "}
                      {zeroStockProducts.slice(0, 4).map((product) => product.name).join(", ")}
                      {zeroStockProducts.length > 4 ? "..." : ""}
                    </p>
                  </div>
                ) : null}
                {lowStockProducts.length ? (
                  <div className="promo-note warning-note soft">
                    <Package size={18} />
                    <p>
                      {lowStockProducts.length} produto(s) com estoque baixo:
                      {" "}
                      {lowStockProducts.slice(0, 4).map((product) => `${product.name} (${product.stock})`).join(", ")}
                      {lowStockProducts.length > 4 ? "..." : ""}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="promo-note success-note">
                <Package size={18} />
                <p>Estoque sob controle no momento, sem itens zerados ou abaixo do limite minimo.</p>
              </div>
            )}
          </article>

          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Canais</span>
                <h2>Delivery vs Balcao</h2>
              </div>
            </div>
            <div className="channel-split">
              <div className="channel-card delivery">
                <div className="channel-card-header">
                  <MapPinned size={18} />
                  <span className="eyebrow">Delivery</span>
                </div>
                <strong>{formatCurrency(reportMetrics.salesTodayDelivery)}</strong>
                <small>{reportMetrics.ordersTodayDelivery} pedidos hoje</small>
                <div className="channel-meta">
                  <div><span>Semana</span><strong>{formatCurrency(reportMetrics.weeklyRevenueDelivery)}</strong></div>
                  <div><span>Mes</span><strong>{formatCurrency(reportMetrics.monthlyRevenueDelivery)}</strong></div>
                  <div><span>Ticket medio</span><strong>{formatCurrency(reportMetrics.avgTicketDelivery)}</strong></div>
                </div>
              </div>
              <div className="channel-card pos">
                <div className="channel-card-header">
                  <ShoppingCart size={18} />
                  <span className="eyebrow">Balcao</span>
                </div>
                <strong>{formatCurrency(reportMetrics.salesTodayPos)}</strong>
                <small>{reportMetrics.ordersTodayPos} vendas hoje</small>
                <div className="channel-meta">
                  <div><span>Semana</span><strong>{formatCurrency(reportMetrics.weeklyRevenuePos)}</strong></div>
                  <div><span>Mes</span><strong>{formatCurrency(reportMetrics.monthlyRevenuePos)}</strong></div>
                  <div><span>Ticket medio</span><strong>{formatCurrency(reportMetrics.avgTicketPos)}</strong></div>
                </div>
              </div>
            </div>
          </article>

          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Tendencia</span>
                <h2>Evolucao por canal ({effectiveReportsDays} dias)</h2>
              </div>
              <div className="chart-controls">
                <span className="eyebrow">Periodo</span>
                <div className="chip-row">
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      className={`chip light ${reportsDays === days ? "is-active" : ""}`}
                      onClick={() => setReportsDays(days)}
                    >
                      {days} dias
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="chart-legend">
              <span className="legend-item delivery">
                <MapPinned size={14} />
                <i className="legend-dot delivery" />
                Delivery
              </span>
              <span className="legend-item pos">
                <ShoppingCart size={14} />
                <i className="legend-dot pos" />
                Balcao
              </span>
            </div>
            <div className="chart-list">
              {reportsDailyDelivery.map((entry, index) => {
                const posEntry = reportsDailyPos[index] || { value: 0, day: entry.day };
                const deliveryValue = Number(entry.value || 0);
                const posValue = Number(posEntry.value || 0);
                const deliveryPercent = Math.round((deliveryValue / reportsDailyMax) * 100);
                const posPercent = Math.round((posValue / reportsDailyMax) * 100);
                const dayLabel = entry.day || posEntry.day || "";

                return (
                  <div className="chart-row channel-chart-row" key={`${dayLabel}-${index}`}>
                    <span>{dayLabel}</span>
                    <div className="channel-chart-bars">
                      <div className="channel-bar delivery">
                        <i style={{ width: `${deliveryPercent}%` }} />
                      </div>
                      <div className="channel-bar pos">
                        <i style={{ width: `${posPercent}%` }} />
                      </div>
                    </div>
                    <strong>{formatCurrency(deliveryValue + posValue)}</strong>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Taxas de entrega</span>
                <h2>Bairros atendidos</h2>
              </div>
              <button
                type="button"
                className="button button-outline"
                onClick={addFeeRow}
              >
                Adicionar bairro
              </button>
            </div>
            <div className="fee-list">
              {feeRows.map((row, index) => (
                <div key={row.id} className="fee-row">
                  <input
                    value={row.name}
                    disabled={!row.isEditing}
                    onChange={(event) =>
                      setFeeRows((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, name: event.target.value } : entry
                        )
                      )
                    }
                  />
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={row.value}
                    disabled={!row.isEditing}
                    onChange={(event) =>
                      setFeeRows((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, value: event.target.value } : entry
                        )
                      )
                    }
                  />
                  <div className="card-actions">
                    {row.isEditing ? (
                      <button
                        type="button"
                        className="button button-soft"
                        onClick={() => stopEditingFeeRow(row.id)}
                      >
                        Concluir
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button-soft"
                        onClick={() => editFeeRow(row.id)}
                      >
                        Editar
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button-muted"
                      onClick={() => removeFeeRow(row.id)}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="button button-primary button-block" disabled={saving} onClick={saveFees}>Salvar taxas</button>
          </article>

          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Financeiro</span>
                <h2>Despesas</h2>
              </div>
              <button
                type="button"
                className="button button-outline"
                onClick={() => setShowExpenses((current) => !current)}
              >
                {showExpenses ? "Ocultar despesas" : "Ver despesas"}
              </button>
            </div>
            <div className="summary-list">
              <div><span>Total de despesas</span><strong>{formatCurrency(expensesTotal)}</strong></div>
              <div><span>Registros</span><strong>{expenses.length}</strong></div>
            </div>
            <div className="expense-form">
              <div className="field-grid">
                <label>
                  Titulo
                  <input
                    value={expenseForm.title}
                    onChange={(event) =>
                      setExpenseForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Aluguel, reposicao, marketing"
                  />
                </label>
                <label>
                  Categoria
                  <input
                    value={expenseForm.category}
                    onChange={(event) =>
                      setExpenseForm((current) => ({ ...current, category: event.target.value }))
                    }
                    placeholder="Operacional"
                  />
                </label>
                <label>
                  Valor (R$)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(event) =>
                      setExpenseForm((current) => ({ ...current, amount: event.target.value }))
                    }
                    placeholder="0,00"
                  />
                </label>
                <label>
                  Data
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(event) =>
                      setExpenseForm((current) => ({ ...current, date: event.target.value }))
                    }
                  />
                </label>
                <label className="field-span">
                  Observacao
                  <textarea
                    rows="2"
                    value={expenseForm.note}
                    onChange={(event) =>
                      setExpenseForm((current) => ({ ...current, note: event.target.value }))
                    }
                    placeholder="Detalhes importantes"
                  />
                </label>
              </div>
              <div className="card-actions">
                <button type="button" className="button button-primary" disabled={saving} onClick={saveExpense}>
                  {editingExpenseId ? "Atualizar despesa" : "Salvar despesa"}
                </button>
                {editingExpenseId ? (
                  <button
                    type="button"
                    className="button button-muted"
                    onClick={() => {
                      setEditingExpenseId("");
                      setExpenseForm(defaultExpenseForm);
                    }}
                  >
                    Cancelar edicao
                  </button>
                ) : null}
              </div>
            </div>
            {showExpenses ? (
              expenses.length ? (
                <div className="expense-list">
                  {expenses.map((expense, index) => (
                    <div
                      key={expense.id || `${expense.title || "despesa"}-${index}`}
                      className="expense-row"
                    >
                      <div>
                        <strong>{expense.title || "Despesa"}</strong>
                        <span>
                          {[expense.category, expense.createdAt || expense.date]
                            .filter(Boolean)
                            .map((value) =>
                              String(value).includes("T") ? formatDate(value) : value
                            )
                            .join(" • ") || "Sem detalhes"}
                        </span>
                      </div>
                      <div className="expense-actions">
                        <strong>- {formatCurrency(expense.amount)}</strong>
                        <div className="card-actions">
                          <button
                            type="button"
                            className="button button-soft"
                            onClick={() => editExpense(expense)}
                            disabled={!expense.id}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="button button-muted"
                            onClick={() => removeExpense(expense.id)}
                            disabled={!expense.id}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <h3>Nenhuma despesa registrada</h3>
                  <p>Quando cadastrar despesas, elas aparecem aqui.</p>
                </div>
              )
            ) : null}
          </article>

          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Financeiro</span>
                <h2>Contas a pagar</h2>
              </div>
              <button
                type="button"
                className="button button-outline"
                onClick={() => setShowPayables((current) => !current)}
              >
                {showPayables ? "Ocultar contas" : "Ver contas"}
              </button>
            </div>
            <div className="summary-list">
              <div><span>Total previsto</span><strong>{formatCurrency(payablesSummary.total)}</strong></div>
              <div><span>Pendente</span><strong>{formatCurrency(payablesSummary.pendingTotal)}</strong></div>
              <div><span>Em aberto</span><strong>{payablesSummary.pendingCount}</strong></div>
              <div><span>Pagas</span><strong>{payablesSummary.paidCount}</strong></div>
            </div>
            {overduePayables.length || dueSoonPayables.length ? (
              <div className="alert-stack">
                {overduePayables.length ? (
                  <div className="promo-note warning-note">
                    <AlertTriangle size={18} />
                    <p>{overduePayables.length} conta(s) a pagar vencida(s) exigem atencao imediata.</p>
                  </div>
                ) : null}
                {dueSoonPayables.length ? (
                  <div className="promo-note warning-note soft">
                    <Wallet size={18} />
                    <p>{dueSoonPayables.length} conta(s) a pagar vencem nos proximos 3 dias.</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="expense-form">
              <div className="field-grid">
                <label>
                  Titulo
                  <input
                    value={payableForm.title}
                    onChange={(event) =>
                      setPayableForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Fornecedor, aluguel, energia"
                  />
                </label>
                <label>
                  Categoria
                  <input
                    value={payableForm.category}
                    onChange={(event) =>
                      setPayableForm((current) => ({ ...current, category: event.target.value }))
                    }
                    placeholder="Operacional"
                  />
                </label>
                <label>
                  Valor
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payableForm.amount}
                    onChange={(event) =>
                      setPayableForm((current) => ({ ...current, amount: event.target.value }))
                    }
                    placeholder="0,00"
                  />
                </label>
                <label>
                  Vencimento
                  <input
                    type="date"
                    value={payableForm.dueDate}
                    onChange={(event) =>
                      setPayableForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Status
                  <select
                    value={payableForm.status}
                    onChange={(event) =>
                      setPayableForm((current) => ({ ...current, status: event.target.value }))
                    }
                  >
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                  </select>
                </label>
                <label className="field-span">
                  Observacao
                  <textarea
                    rows="2"
                    value={payableForm.note}
                    onChange={(event) =>
                      setPayableForm((current) => ({ ...current, note: event.target.value }))
                    }
                    placeholder="Detalhes da conta"
                  />
                </label>
              </div>
              <div className="card-actions">
                <button type="button" className="button button-primary" disabled={saving} onClick={savePayable}>
                  {editingPayableId ? "Atualizar conta" : "Salvar conta"}
                </button>
                {editingPayableId ? (
                  <button
                    type="button"
                    className="button button-muted"
                    onClick={() => {
                      setEditingPayableId("");
                      setPayableForm(defaultPayableForm);
                    }}
                  >
                    Cancelar edicao
                  </button>
                ) : null}
              </div>
            </div>
            {showPayables ? (
              payables.length ? (
                <div className="expense-list">
                  {payables.map((entry) => (
                    <div
                      key={entry.id}
                      className={`expense-row ${entry.status === "paid" ? "is-paid" : isOverdue(entry.dueDate) ? "is-alert" : isDueSoon(entry.dueDate) ? "is-warning" : ""}`}
                    >
                      <div>
                        <strong>{entry.title}</strong>
                        <span>
                          {[entry.category, entry.dueDate ? formatDate(entry.dueDate) : "", entry.status === "paid" ? "Pago" : "Pendente"]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                      </div>
                      <div className="expense-actions">
                        <strong>{formatCurrency(entry.amount)}</strong>
                        <div className="card-actions">
                          <button type="button" className="button button-soft" onClick={() => togglePayableStatus(entry)}>
                            {entry.status === "paid" ? "Reabrir" : "Marcar pago"}
                          </button>
                          <button type="button" className="button button-outline" onClick={() => editPayable(entry)}>
                            Editar
                          </button>
                          <button type="button" className="button button-muted" onClick={() => removePayable(entry.id)}>
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <h3>Nenhuma conta a pagar</h3>
                  <p>Use este bloco para registrar aluguel, fornecedores e despesas futuras.</p>
                </div>
              )
            ) : null}
          </article>

          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Fiados</span>
                <h2>Contas a receber</h2>
              </div>
              <button
                type="button"
                className="button button-outline"
                onClick={() => setShowReceivables((current) => !current)}
              >
                {showReceivables ? "Ocultar fiados" : "Ver fiados"}
              </button>
            </div>
            <div className="summary-list">
              <div><span>Total registrado</span><strong>{formatCurrency(receivablesSummary.total)}</strong></div>
              <div><span>Em aberto</span><strong>{formatCurrency(receivablesSummary.pendingTotal)}</strong></div>
              <div><span>Clientes pendentes</span><strong>{receivablesSummary.pendingCount}</strong></div>
              <div><span>Recebidos</span><strong>{receivablesSummary.paidCount}</strong></div>
            </div>
            {overdueReceivables.length || dueSoonReceivables.length ? (
              <div className="alert-stack">
                {overdueReceivables.length ? (
                  <div className="promo-note warning-note">
                    <AlertTriangle size={18} />
                    <p>{overdueReceivables.length} fiado(s) estao vencidos e precisam de cobranca.</p>
                  </div>
                ) : null}
                {dueSoonReceivables.length ? (
                  <div className="promo-note warning-note soft">
                    <Users size={18} />
                    <p>{dueSoonReceivables.length} conta(s) a receber vencem nos proximos 3 dias.</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="expense-form">
              <div className="field-grid">
                <label>
                  Titulo
                  <input
                    value={receivableForm.title}
                    onChange={(event) =>
                      setReceivableForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Fiado do cliente"
                  />
                </label>
                <label>
                  Cliente
                  <input
                    value={receivableForm.customerName}
                    onChange={(event) =>
                      setReceivableForm((current) => ({ ...current, customerName: event.target.value }))
                    }
                    placeholder="Nome do cliente"
                  />
                </label>
                <label>
                  Telefone
                  <input
                    value={receivableForm.customerPhone}
                    onChange={(event) =>
                      setReceivableForm((current) => ({ ...current, customerPhone: event.target.value }))
                    }
                    placeholder="(11) 99999-9999"
                  />
                </label>
                <label>
                  Categoria
                  <input
                    value={receivableForm.category}
                    onChange={(event) =>
                      setReceivableForm((current) => ({ ...current, category: event.target.value }))
                    }
                    placeholder="Fiado"
                  />
                </label>
                <label>
                  Valor
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={receivableForm.amount}
                    onChange={(event) =>
                      setReceivableForm((current) => ({ ...current, amount: event.target.value }))
                    }
                    placeholder="0,00"
                  />
                </label>
                <label>
                  Vencimento
                  <input
                    type="date"
                    value={receivableForm.dueDate}
                    onChange={(event) =>
                      setReceivableForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Status
                  <select
                    value={receivableForm.status}
                    onChange={(event) =>
                      setReceivableForm((current) => ({ ...current, status: event.target.value }))
                    }
                  >
                    <option value="pending">Pendente</option>
                    <option value="paid">Recebido</option>
                  </select>
                </label>
                <label className="field-span">
                  Observacao
                  <textarea
                    rows="2"
                    value={receivableForm.note}
                    onChange={(event) =>
                      setReceivableForm((current) => ({ ...current, note: event.target.value }))
                    }
                    placeholder="Produto, prazo combinado, observacoes"
                  />
                </label>
              </div>
              <div className="card-actions">
                <button type="button" className="button button-primary" disabled={saving} onClick={saveReceivable}>
                  {editingReceivableId ? "Atualizar fiado" : "Salvar fiado"}
                </button>
                {editingReceivableId ? (
                  <button
                    type="button"
                    className="button button-muted"
                    onClick={() => {
                      setEditingReceivableId("");
                      setReceivableForm(defaultReceivableForm);
                    }}
                  >
                    Cancelar edicao
                  </button>
                ) : null}
              </div>
            </div>
            {showReceivables ? (
              receivables.length ? (
                <div className="expense-list">
                  {receivables.map((entry) => (
                    <div
                      key={entry.id}
                      className={`expense-row ${entry.status === "paid" ? "is-paid" : isOverdue(entry.dueDate) ? "is-alert" : isDueSoon(entry.dueDate) ? "is-warning" : ""}`}
                    >
                      <div>
                        <strong>{entry.customerName || entry.title}</strong>
                        <span>
                          {[entry.title, entry.customerPhone, entry.dueDate ? formatDate(entry.dueDate) : "", entry.status === "paid" ? "Recebido" : "Pendente"]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                      </div>
                      <div className="expense-actions">
                        <strong>{formatCurrency(entry.amount)}</strong>
                        <div className="card-actions">
                          <button type="button" className="button button-soft" onClick={() => toggleReceivableStatus(entry)}>
                            {entry.status === "paid" ? "Reabrir" : "Marcar recebido"}
                          </button>
                          <button type="button" className="button button-outline" onClick={() => editReceivable(entry)}>
                            Editar
                          </button>
                          <button type="button" className="button button-muted" onClick={() => removeReceivable(entry.id)}>
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <h3>Nenhum fiado registrado</h3>
                  <p>Registre os recebimentos pendentes para acompanhar quem ficou devendo.</p>
                </div>
              )
            ) : null}
          </article>

          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Historicos</span>
                <h2>Limpeza rapida</h2>
              </div>
            </div>
            <div className="summary-list">
              <div><span>Total de registros</span><strong>{orders.length}</strong></div>
              <div><span>Pedidos delivery</span><strong>{orders.filter((order) => order.channel !== "pos").length}</strong></div>
              <div><span>Vendas PDV</span><strong>{orders.filter((order) => order.channel === "pos").length}</strong></div>
            </div>
            <div className="card-actions">
              <button type="button" className="button button-outline" disabled={saving} onClick={() => clearHistory("delivery")}>
                <Archive size={16} />
                Limpar pedidos
              </button>
              <button type="button" className="button button-outline" disabled={saving} onClick={() => clearHistory("pos")}>
                <Archive size={16} />
                Limpar vendas
              </button>
              <button type="button" className="button button-muted" disabled={saving} onClick={() => clearHistory("all")}>
                <Archive size={16} />
                Limpar tudo
              </button>
            </div>
            <div className="promo-note">
              <Archive size={18} />
              <p>Ao limpar o historico, o sistema remove os registros de pedidos e recalcula o resumo dos clientes com base no que restar salvo.</p>
            </div>
          </article>

          <article className="admin-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">Logistica</span>
                <h2>Motoboys</h2>
              </div>
              <div className="rider-controls">
                <div className="chip-row">
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      className={`chip light ${riderPeriodDays === days ? "is-active" : ""}`}
                      onClick={() => setRiderPeriodDays(days)}
                    >
                      {days} dias
                    </button>
                  ))}
                </div>
                <button type="button" className="button button-outline" onClick={exportRidersCsv}>
                  Exportar CSV
                </button>
                <button type="button" className="button button-outline" onClick={exportRidersPdf}>
                  Exportar PDF
                </button>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setShowRiders((current) => !current)}
                >
                  {showRiders ? "Fechar cadastro" : "Registrar motoboy"}
                </button>
              </div>
            </div>
            <div className="summary-list">
              <div><span>Motoboys ativos</span><strong>{riders.filter((rider) => rider.active).length}</strong></div>
              <div><span>Motoboys cadastrados</span><strong>{riders.length}</strong></div>
              <div><span>Entregas ({riderPeriodDays} dias)</span><strong>{deliveredOrdersInPeriod.length}</strong></div>
            </div>
            {showRiders ? (
              <div className="rider-form">
                <div className="field-grid">
                  <label>
                    Nome
                    <input
                      value={riderForm.name}
                      onChange={(event) =>
                        setRiderForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Motoboy"
                    />
                  </label>
                  <label>
                    Telefone
                    <input
                      value={riderForm.phone}
                      onChange={(event) =>
                        setRiderForm((current) => ({ ...current, phone: event.target.value }))
                      }
                      placeholder="(11) 99999-9999"
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={riderForm.active ? "active" : "inactive"}
                      onChange={(event) =>
                        setRiderForm((current) => ({
                          ...current,
                          active: event.target.value === "active"
                        }))
                      }
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </label>
                </div>
                <div className="card-actions">
                  <button type="button" className="button button-primary" disabled={saving} onClick={saveRider}>
                    {editingRiderId ? "Atualizar motoboy" : "Salvar motoboy"}
                  </button>
                  {editingRiderId ? (
                    <button
                      type="button"
                      className="button button-muted"
                      onClick={() => {
                        setEditingRiderId("");
                        setRiderForm(defaultRiderForm);
                      }}
                    >
                      Cancelar edicao
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="rider-list">
              {riderStats.length ? (
                riderStats.map((entry) => (
                  <div key={entry.rider.id} className="rider-row">
                    <div>
                      <strong>{entry.rider.name}</strong>
                      <span>
                        {entry.rider.phone || "Sem telefone"} • {entry.rider.active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="rider-metrics">
                      <div><span>Entregas</span><strong>{entry.deliveries}</strong></div>
                      <div><span>Taxas</span><strong>{formatCurrency(entry.feesTotal)}</strong></div>
                    </div>
                    <div className="card-actions">
                      <button type="button" className="button button-soft" onClick={() => editRider(entry.rider)}>
                        Editar
                      </button>
                      <button type="button" className="button button-muted" onClick={() => removeRider(entry.rider.id)}>
                        Remover
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state compact">
                  <h3>Nenhum motoboy registrado</h3>
                  <p>Cadastre motoboys para acompanhar as taxas de entrega.</p>
                </div>
              )}
            </div>
            <div className="rider-history">
              <div className="card-header">
                <div>
                  <span className="eyebrow">Historico</span>
                  <h3>Taxas por dia</h3>
                </div>
              </div>
              {riderDailyList.length ? (
                <div className="rider-history-list">
                  {riderDailyList.map((entry) => (
                    <div key={entry.date} className="rider-history-row">
                      <div>
                        <strong>{formatDayLabel(entry.date)}</strong>
                        <span>
                          {Object.keys(entry.riders || {}).length
                            ? `Motoboys: ${Object.keys(entry.riders).length}`
                            : "Sem motoboy definido"}
                        </span>
                      </div>
                      <div className="rider-metrics">
                        <div><span>Entregas</span><strong>{entry.deliveries}</strong></div>
                        <div><span>Taxas</span><strong>{formatCurrency(entry.feesTotal)}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <h3>Sem historico no periodo</h3>
                  <p>Registre entregas com motoboy para ver as taxas por dia.</p>
                </div>
              )}
            </div>
            <div className="rider-note">
              <Smartphone size={18} />
              <p>As taxas de entrega somam apenas pedidos entregues com motoboy definido.</p>
            </div>
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
