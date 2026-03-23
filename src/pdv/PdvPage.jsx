import { useEffect, useMemo, useRef, useState } from "react";
import {
  Minus,
  Plus,
  RefreshCcw,
  Search,
  ShoppingCart,
  TicketPercent,
  Trash2,
  Wallet
} from "lucide-react";
import { api, socket } from "../api";
import { supabase } from "../supabase";
import BrandLogo from "../components/BrandLogo";

const TOKEN_KEY = "turbo_pdv_token";
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || "/admin";
const STORE_URL = import.meta.env.VITE_STORE_URL || "/";

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

const posPaymentOptions = [
  { value: "fiado", label: "Fiado" },
  { value: "pix_key", label: "Chave PIX" },
  { value: "pix_qr", label: "Chave PIX QR Code" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "credit_card", label: "Cartao de Credito" },
  { value: "debit_card", label: "Cartao de Debito" }
];

const createPaymentRow = (overrides = {}) => ({
  id: `pay-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  method: "pix_key",
  amount: "",
  ...overrides
});

const defaultBootstrap = {
  settings: {},
  categories: [],
  products: [],
  promotions: [],
  paymentMethods: [],
  cashRegister: {
    currentSession: null,
    history: []
  }
};

const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
const formatDate = (value) => new Date(value).toLocaleString("pt-BR");
const parseAmount = (value) => {
  const normalized = String(value ?? "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
};
const toCents = (value) => Math.round(parseAmount(value) * 100);
const fromCents = (value) => Number((Number(value || 0) / 100).toFixed(2));
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
      <table>${itemsHtml}</table>
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

function PdvPage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [bootstrap, setBootstrap] = useState(defaultBootstrap);
  const [adminProfile, setAdminProfile] = useState(null);
  const [posQuery, setPosQuery] = useState("");
  const [posCategory, setPosCategory] = useState("Todos");
  const [posCart, setPosCart] = useState([]);
  const [posForm, setPosForm] = useState(defaultPosForm);
  const [posPayments, setPosPayments] = useState(() => [createPaymentRow()]);
  const [posSubmitting, setPosSubmitting] = useState(false);
  const [posFeedback, setPosFeedback] = useState("");
  const [posLastOrder, setPosLastOrder] = useState(null);
  const [posPrintWidth, setPosPrintWidth] = useState("58");
  const [cashOpenForm, setCashOpenForm] = useState(defaultCashOpenForm);
  const [cashCloseForm, setCashCloseForm] = useState(defaultCashCloseForm);
  const [cashMovementForm, setCashMovementForm] = useState(defaultCashMovementForm);
  const posPrintedRef = useRef("");

  const resetPdvState = () => {
    setBootstrap(defaultBootstrap);
    setAdminProfile(null);
    setPosQuery("");
    setPosCategory("Todos");
    setPosCart([]);
    setPosForm(defaultPosForm);
    setPosPayments([createPaymentRow()]);
    setPosFeedback("");
    setPosLastOrder(null);
    setPosPrintWidth("58");
    setCashOpenForm(defaultCashOpenForm);
    setCashCloseForm(defaultCashCloseForm);
    setCashMovementForm(defaultCashMovementForm);
  };

  const loadBootstrap = async (currentToken = token, silent = false) => {
    if (!currentToken) {
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    try {
      const [bootstrapPayload, profilePayload] = await Promise.all([
        api.getPosBootstrap(currentToken),
        api.getAdminProfile(currentToken)
      ]);
      setBootstrap({
        ...defaultBootstrap,
        ...bootstrapPayload,
        cashRegister: {
          ...defaultBootstrap.cashRegister,
          ...(bootstrapPayload?.cashRegister || {})
        }
      });
      setAdminProfile(profilePayload?.profile || null);
      if (!silent) {
        setMessage("");
      }
    } catch (error) {
      const unauthorized = /nao autorizado|unauthorized/i.test(String(error?.message || ""));

      if (unauthorized) {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        resetPdvState();
        if (supabase) {
          await supabase.auth.signOut();
        }
      }

      if (!silent) {
        setMessage(error.message || "Nao foi possivel carregar o PDV.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    loadBootstrap(token);
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    socket.emit("admin:subscribe", token);

    const refresh = () => {
      loadBootstrap(token, true);
    };

    socket.on("catalog:updated", refresh);
    socket.on("dashboard:update", refresh);
    socket.on("pos:update", refresh);

    return () => {
      socket.off("catalog:updated", refresh);
      socket.off("dashboard:update", refresh);
      socket.off("pos:update", refresh);
    };
  }, [token]);

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
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    resetPdvState();
    setMessage("");
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const settings = bootstrap.settings || {};
  const categories = bootstrap.categories || [];
  const products = bootstrap.products || [];
  const promotions = bootstrap.promotions || [];
  const paymentOptions = bootstrap.paymentMethods?.length
    ? bootstrap.paymentMethods
    : posPaymentOptions;
  const cashRegister = bootstrap.cashRegister || defaultBootstrap.cashRegister;
  const cashSession = cashRegister.currentSession || null;
  const cashHistory = cashRegister.history || [];

  const productsById = useMemo(
    () =>
      products.reduce((accumulator, product) => {
        accumulator[product.id] = product;
        return accumulator;
      }, {}),
    [products]
  );

  const posQuantities = useMemo(
    () => posCart.reduce((accumulator, item) => ({ ...accumulator, [item.id]: item.quantity }), {}),
    [posCart]
  );

  const posCartItems = useMemo(
    () =>
      posCart
        .map((item) => {
          const product = productsById[item.id];
          return product ? { ...product, quantity: item.quantity } : null;
        })
        .filter(Boolean),
    [posCart, productsById]
  );

  const posSubtotal = posCartItems.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);
  const posPromoDiscount = estimateDiscount(posSubtotal, promotions, posForm.couponCode);
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
  const posDiscountTotal = Math.min(
    posPromoDiscount + posManualDiscountFixedApplied + posManualDiscountPercentApplied,
    posSubtotal
  );
  const posSurchargeBase = Math.max(posSubtotal - posDiscountTotal, 0);
  const posManualSurcharge = Math.max(parseAmount(posForm.manualSurcharge), 0);
  const posManualSurchargePercent = clampPercent(posForm.manualSurchargePercent);
  const posManualSurchargePercentAmount = Number(
    ((posSurchargeBase * posManualSurchargePercent) / 100).toFixed(2)
  );
  const posManualSurchargeTotal = posManualSurcharge + posManualSurchargePercentAmount;
  const posTotal = Math.max(posSubtotal - posDiscountTotal + posManualSurchargeTotal, 0);
  const posPaymentsTotalCents = posPayments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
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
  const posFilteredProducts = products
    .filter((product) => (posCategory === "Todos" ? true : product.category === posCategory))
    .filter((product) =>
      posQuery
        ? `${product.name} ${product.category} ${product.volume}`
            .toLowerCase()
            .includes(posQuery.toLowerCase())
        : true
    );

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

      return current.map((item) =>
        item.id === productId ? { ...item, quantity: nextQuantity } : item
      );
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
      settings,
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

  const refreshPdv = async () => {
    setLoading(true);

    try {
      await loadBootstrap(token, true);
      setMessage("PDV atualizado.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openCashRegister = async () => {
    setSaving(true);
    setMessage("");

    try {
      await api.openCashRegister(token, {
        openingBalance: parseAmount(cashOpenForm.openingBalance),
        note: cashOpenForm.note
      });
      setCashOpenForm(defaultCashOpenForm);
      await loadBootstrap(token, true);
      setMessage("Caixa aberto com sucesso.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const createCashMovement = async () => {
    setSaving(true);
    setMessage("");

    try {
      await api.createCashMovement(token, {
        type: cashMovementForm.type,
        amount: parseAmount(cashMovementForm.amount),
        note: cashMovementForm.note
      });
      setCashMovementForm(defaultCashMovementForm);
      await loadBootstrap(token, true);
      setMessage("Movimento de caixa registrado.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const closeCashRegister = async () => {
    setSaving(true);
    setMessage("");

    try {
      await api.closeCashRegister(token, {
        countedBalance: parseAmount(cashCloseForm.countedBalance),
        note: cashCloseForm.note
      });
      setCashCloseForm(defaultCashCloseForm);
      await loadBootstrap(token, true);
      setMessage("Caixa fechado com sucesso.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
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
      await loadBootstrap(token, true);
      if (payload.order?.id && posPrintedRef.current !== payload.order.id) {
        posPrintedRef.current = payload.order.id;
        handleBrowserPrint(payload.order);
      }
      setPosFeedback(`Venda PDV registrada: #${payload.order.number}.`);
    } catch (error) {
      setPosFeedback(error.message);
    } finally {
      setPosSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="page-shell centered admin-login">
        <div className="login-card">
          <BrandLogo to={null} subtitle="PDV separado com estoque sincronizado" variant="login" className="login-brand" />
          <span className="eyebrow">PDV Fortin</span>
          <h1>Venda presencial</h1>
          <p>Use a mesma conta do admin para vender no PDV sem carregar o painel do delivery.</p>
          {!supabase ? (
            <div className="toast-inline">
              Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para acessar com email.
            </div>
          ) : null}
          <div className="field-grid single">
            <label>
              Email ou usuario
              <input
                type="email"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, username: event.target.value }))
                }
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
          </div>
          <button type="button" className="button button-primary button-block" onClick={handleLogin} disabled={loading}>
            {loading ? "Entrando..." : "Entrar no PDV"}
          </button>
          <a className="button button-outline button-block" href={ADMIN_URL}>
            Abrir admin principal
          </a>
          <a className="button button-outline button-block" href={STORE_URL}>
            Ver loja delivery
          </a>
          {message ? <div className="toast-inline">{message}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell admin">
      <header className="admin-header">
        <div className="admin-brand">
          <BrandLogo to={null} subtitle="PDV separado do admin, estoque unificado" variant="admin" />
          <div>
            <span className="eyebrow">PDV</span>
            <h1 className="admin-store-title">{settings.storeName || "Fortin PDV"}</h1>
            {adminProfile ? <small>Proprietario: {adminProfile.owner_name}</small> : null}
          </div>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="button button-soft" onClick={refreshPdv} disabled={loading}>
            <RefreshCcw size={16} />
            Atualizar
          </button>
          <a className="button button-outline" href={ADMIN_URL}>
            Admin principal
          </a>
          <a className="button button-outline" href={STORE_URL}>
            Loja delivery
          </a>
          <button type="button" className="button button-muted" onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      {message ? <div className="toast-inline">{message}</div> : null}

      <section className="admin-grid pos-grid">
        <article className="admin-card">
          <div className="card-header">
            <div>
              <span className="eyebrow">Caixa</span>
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
                      setCashOpenForm((current) => ({
                        ...current,
                        openingBalance: event.target.value
                      }))
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
                      setCashCloseForm((current) => ({
                        ...current,
                        countedBalance: event.target.value
                      }))
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
          <div className="summary-list">
            <div><span>Produtos ativos</span><strong>{products.length}</strong></div>
            <div><span>Categorias</span><strong>{categories.length}</strong></div>
            <div><span>Promocoes</span><strong>{promotions.length}</strong></div>
            <div><span>Ultima venda</span><strong>{posLastOrder ? `#${posLastOrder.number}` : "-"}</strong></div>
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
                      <span>{product.category} - {product.volume}</span>
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
                <p>Verifique os filtros ou aguarde a sincronizacao do estoque.</p>
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
                    onChange={(event) =>
                      setPosForm((current) => ({
                        ...current,
                        couponCode: event.target.value.toUpperCase()
                      }))
                    }
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
                  onChange={(event) =>
                    setPosForm((current) => ({ ...current, manualDiscount: event.target.value }))
                  }
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
                  onChange={(event) =>
                    setPosForm((current) => ({
                      ...current,
                      manualDiscountPercent: event.target.value
                    }))
                  }
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
                  onChange={(event) =>
                    setPosForm((current) => ({ ...current, manualSurcharge: event.target.value }))
                  }
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
                  onChange={(event) =>
                    setPosForm((current) => ({
                      ...current,
                      manualSurchargePercent: event.target.value
                    }))
                  }
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
    </div>
  );
}

export default PdvPage;
