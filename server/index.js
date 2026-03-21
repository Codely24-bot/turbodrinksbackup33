import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { bootstrapStorage, createId, getStorageMeta, readDB, updateDB } from "./data/store.js";
import { buildTrackingUrl, getPublicStoreUrl } from "./services/publicLinks.js";
import { normalizePhone } from "./services/phone.js";
import {
  STATUS_FLOW,
  STATUS_LABELS,
  formatCurrency
} from "./services/whatsappTemplates.js";
import { sendWhatsAppUpdate } from "./services/whatsapp.js";
import {
  getSupabaseAdminProfile,
  isSupabaseAuthEnabled,
  verifySupabaseToken
} from "./services/supabaseAuth.js";
import {
  getWhatsAppQrPage,
  getWhatsAppQrPngBuffer,
  getWhatsAppStatus,
  initializeWhatsAppBot
} from "./services/whatsappBot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const packageJsonPath = path.join(rootDir, "package.json");
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || "0.0.0.0";
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
const appVersion = packageJson.version || "0.0.0";
const appCommit =
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.RAILWAY_GIT_COMMIT_ID ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_SHA ||
  "unknown";
const startedAt = new Date().toISOString();

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "delivery-admin-token";

const asyncHandler = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.json({ limit: "6mb" }));
app.use("/public", express.static(path.join(rootDir, "public")));

const defaultProductImageByCategory = {
  Cervejas: "/products/beer.svg",
  Refrigerantes: "/products/soda.svg",
  Energeticos: "/products/energy.svg",
  Aguas: "/products/water.svg",
  Sucos: "/products/juice.svg",
  Destilados: "/products/spirit.svg",
  "Combos e promocoes": "/products/combo.svg"
};

const defaultPaymentMethods = [
  { value: "dinheiro", label: "Dinheiro", active: true },
  { value: "pix_key", label: "Chave PIX", active: true },
  { value: "pix_qr", label: "Chave PIX QR Code", active: true },
  { value: "credit_card", label: "Cartao de Credito", active: true },
  { value: "debit_card", label: "Cartao de Debito", active: true }
];

const normalizeNeighborhood = (value = "") =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

const statusSortValue = {
  received: 1,
  accepted: 2,
  preparing: 3,
  out_for_delivery: 4,
  delivered: 5
};

const parseMoney = (value) => Number(Number(value || 0).toFixed(2));
const normalizeLabel = (value = "") => String(value || "").trim();
const getCatalogCategories = (db) =>
  [...new Set([...(db.categories || []), ...db.products.map((product) => product.category)])]
    .map(normalizeLabel)
    .filter(Boolean);
const getPaymentMethods = (db) => {
  const methods = Array.isArray(db.paymentMethods) && db.paymentMethods.length
    ? db.paymentMethods
    : defaultPaymentMethods;

  return methods
    .map((method) => ({
      value: String(method?.value || "").trim(),
      label: String(method?.label || method?.value || "").trim(),
      active: method?.active ?? true
    }))
    .filter((method) => method.value && method.label);
};
const getAvailablePaymentMethodValues = (db) =>
  new Set([
    "pix",
    "cartao",
    "multiple",
    ...getPaymentMethods(db)
      .filter((method) => method.active)
      .map((method) => method.value)
  ]);
const parseExpenseDate = (value, fallback) => {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};
const hasValue = (value) => value !== undefined && value !== null && value !== "";
const getDefaultProductImage = (category) =>
  defaultProductImageByCategory[category] || "/products/combo.svg";
const isAllowedProductImage = (image) =>
  typeof image === "string" &&
  (image.startsWith("/products/") || image.startsWith("data:image/png;base64,"));
const getSalePrice = (product) => parseMoney(product.salePrice ?? product.price);
const getPurchasePrice = (product) => {
  const salePrice = getSalePrice(product);
  const legacyOriginalPrice = Number(product.originalPrice);
  const fallbackPurchasePrice =
    Number.isFinite(legacyOriginalPrice) && legacyOriginalPrice <= salePrice
      ? legacyOriginalPrice
      : salePrice;

  return parseMoney(product.purchasePrice ?? fallbackPurchasePrice);
};
const resolveSalePrice = (payload, fallback = 0) =>
  hasValue(payload.salePrice)
    ? parseMoney(payload.salePrice)
    : hasValue(payload.price)
      ? parseMoney(payload.price)
      : parseMoney(fallback);
const resolvePurchasePrice = (payload, salePrice, fallback = salePrice) => {
  if (hasValue(payload.purchasePrice)) {
    return parseMoney(payload.purchasePrice);
  }

  if (hasValue(payload.originalPrice)) {
    const legacyOriginalPrice = parseMoney(payload.originalPrice);
    return legacyOriginalPrice <= salePrice ? legacyOriginalPrice : salePrice;
  }

  return parseMoney(fallback);
};

const buildStatusTimeline = (status, timestamp = new Date().toISOString()) => {
  const currentIndex = STATUS_FLOW.indexOf(status);

  if (currentIndex <= 0) {
    return [{ status: "received", timestamp }];
  }

  return STATUS_FLOW.slice(0, currentIndex + 1).map((step) => ({
    status: step,
    timestamp
  }));
};

const sameDay = (date, compareDate = new Date()) => {
  const left = new Date(date);
  return left.toDateString() === compareDate.toDateString();
};

const parseLimit = (value, fallback = 50, max = 500) => {
  const requested = Number(value || fallback);
  return Number.isFinite(requested)
    ? Math.min(Math.max(Math.floor(requested), 1), max)
    : fallback;
};

const isWithinDays = (date, days) => {
  const target = new Date(date).getTime();
  const min = Date.now() - days * 24 * 60 * 60 * 1000;
  return target >= min;
};

const getStorePayload = (db) => ({
  settings: {
    ...db.settings,
    publicStoreUrl: getPublicStoreUrl()
  },
  deliveryZones: db.deliveryZones || [],
  categories: getCatalogCategories(db),
  products: db.products
    .filter((product) => product.active && product.stock > 0)
    .sort(
      (left, right) =>
        Number(right.featured) - Number(left.featured) || getSalePrice(left) - getSalePrice(right)
    ),
  featuredProducts: db.products.filter(
    (product) => product.active && product.stock > 0 && product.featured
  ),
  promotions: db.promotions.filter((promotion) => promotion.active),
  paymentMethods: getPaymentMethods(db).filter((method) => method.active)
});

const getFeeForNeighborhood = (db, neighborhood) => {
  const normalizedInput = normalizeNeighborhood(neighborhood);
  const zoneMatch = (db.deliveryZones || []).find(
    (zone) => zone.active !== false && normalizeNeighborhood(zone.name) === normalizedInput
  );
  if (zoneMatch) {
    return Number(zoneMatch.fee || 0);
  }

  const settingsMatch = Object.entries(db.settings.deliveryFees || {}).find(
    ([name]) => normalizeNeighborhood(name) === normalizedInput
  );
  return settingsMatch ? Number(settingsMatch[1]) : 0;
};

const getSequenceNumber = (orders) => {
  const lastNumber = orders.reduce((max, order) => Math.max(max, order.number), 1000);
  return lastNumber + 1;
};

const getStockSummary = (db) => {
  const lowThreshold = Math.max(Number(db.settings?.stockLowThreshold || 5), 1);
  const products = Array.isArray(db.products) ? db.products : [];
  const totalUnits = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const zeroStockCount = products.filter((product) => Number(product.stock || 0) <= 0).length;
  const lowStockCount = products.filter((product) => {
    const stock = Number(product.stock || 0);
    return stock > 0 && stock <= lowThreshold;
  }).length;
  const inventoryValue = products.reduce(
    (sum, product) => sum + parseMoney(getPurchasePrice(product) * Number(product.stock || 0)),
    0
  );

  return {
    lowThreshold,
    totalProducts: products.length,
    totalUnits,
    zeroStockCount,
    lowStockCount,
    inventoryValue: parseMoney(inventoryValue)
  };
};

const sortFinancialEntries = (entries = []) =>
  [...entries].sort(
    (left, right) =>
      new Date(right.updatedAt || right.createdAt || right.dueDate || 0).getTime() -
      new Date(left.updatedAt || left.createdAt || left.dueDate || 0).getTime()
  );

const getFinancialSummary = (entries = []) => {
  const pending = entries.filter((entry) => entry.status !== "paid");
  const paid = entries.filter((entry) => entry.status === "paid");

  return {
    total: parseMoney(entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)),
    pendingTotal: parseMoney(pending.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)),
    paidTotal: parseMoney(paid.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)),
    pendingCount: pending.length,
    paidCount: paid.length
  };
};

const sortSupportRequests = (entries = []) =>
  [...entries].sort(
    (left, right) =>
      new Date(right.updatedAt || right.requestedAt || right.createdAt || 0).getTime() -
      new Date(left.updatedAt || left.requestedAt || left.createdAt || 0).getTime()
  );

const ensureCashRegister = (draft) => {
  if (!draft.cashRegister || typeof draft.cashRegister !== "object") {
    draft.cashRegister = { currentSession: null, history: [] };
  }

  if (!Array.isArray(draft.cashRegister.history)) {
    draft.cashRegister.history = [];
  }

  return draft.cashRegister;
};

const appendCashMovement = (draft, movement) => {
  const cashRegister = ensureCashRegister(draft);
  const session = cashRegister.currentSession;

  if (!session) {
    return;
  }

  session.movements = Array.isArray(session.movements) ? session.movements : [];
  session.movements.push({
    id: createId("cash-move"),
    createdAt: new Date().toISOString(),
    ...movement,
    amount: parseMoney(movement.amount)
  });
  session.expectedBalance = parseMoney(Number(session.expectedBalance || 0) + Number(movement.amount || 0));
};

const recalculateCustomers = (draft) => {
  draft.customers = (draft.customers || []).map((customer) => {
    const previousOrders = (draft.orders || [])
      .filter((order) => order.customerId === customer.id)
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));

    const lastOrder = previousOrders[previousOrders.length - 1] || null;

    return {
      ...customer,
      orderIds: previousOrders.map((order) => order.id),
      lastOrderId: lastOrder?.id || null,
      totalSpent: parseMoney(previousOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)),
      updatedAt: new Date().toISOString()
    };
  });
};

const aggregateTopProducts = (orders) => {
  const accumulator = new Map();

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const current = accumulator.get(item.productId) || {
        productId: item.productId,
        name: item.name,
        quantity: 0,
        revenue: 0
      };
      current.quantity += item.quantity;
      current.revenue += item.lineTotal;
      accumulator.set(item.productId, current);
    });
  });

  return [...accumulator.values()]
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 5);
};

const buildDailySeries = (orders, days = 7) => {
  const today = new Date();
  const dayKeys = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const label = date.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit"
    });
    dayKeys.push({ key, label });
  }

  const totals = orders.reduce((accumulator, order) => {
    const date = new Date(order.createdAt);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    accumulator[key] = (accumulator[key] || 0) + order.total;
    return accumulator;
  }, {});

  return dayKeys.map(({ key, label }) => ({
    day: label,
    value: parseMoney(totals[key] || 0)
  }));
};

const buildDashboard = (db) => {
  const resolveChannel = (order) => (order?.channel === "pos" ? "pos" : "delivery");
  const todayOrders = db.orders.filter((order) => sameDay(order.createdAt));
  const weeklyOrders = db.orders.filter((order) => isWithinDays(order.createdAt, 7));
  const monthlyOrders = db.orders.filter((order) => isWithinDays(order.createdAt, 30));
  const expenses = Array.isArray(db.expenses) ? [...db.expenses] : [];
  const payables = sortFinancialEntries(Array.isArray(db.payables) ? db.payables : []);
  const receivables = sortFinancialEntries(Array.isArray(db.receivables) ? db.receivables : []);
  const supportRequests = sortSupportRequests(Array.isArray(db.supportRequests) ? db.supportRequests : []);
  const expensesSorted = expenses.sort(
    (left, right) =>
      new Date(right.createdAt || right.date || 0).getTime() -
      new Date(left.createdAt || left.date || 0).getTime()
  );
  const expensesTotal = expensesSorted.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const stockSummary = getStockSummary(db);
  const cashRegister = ensureCashRegister({ ...db, cashRegister: db.cashRegister });

  const todayDeliveryOrders = todayOrders.filter((order) => resolveChannel(order) === "delivery");
  const todayPosOrders = todayOrders.filter((order) => resolveChannel(order) === "pos");
  const weeklyDeliveryOrders = weeklyOrders.filter((order) => resolveChannel(order) === "delivery");
  const weeklyPosOrders = weeklyOrders.filter((order) => resolveChannel(order) === "pos");
  const monthlyDeliveryOrders = monthlyOrders.filter((order) => resolveChannel(order) === "delivery");
  const monthlyPosOrders = monthlyOrders.filter((order) => resolveChannel(order) === "pos");

  const salesToday = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const salesTodayDelivery = todayDeliveryOrders.reduce((sum, order) => sum + order.total, 0);
  const salesTodayPos = todayPosOrders.reduce((sum, order) => sum + order.total, 0);
  const weeklyRevenue = weeklyOrders.reduce((sum, order) => sum + order.total, 0);
  const weeklyRevenueDelivery = weeklyDeliveryOrders.reduce((sum, order) => sum + order.total, 0);
  const weeklyRevenuePos = weeklyPosOrders.reduce((sum, order) => sum + order.total, 0);
  const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + order.total, 0);
  const monthlyRevenueDelivery = monthlyDeliveryOrders.reduce((sum, order) => sum + order.total, 0);
  const monthlyRevenuePos = monthlyPosOrders.reduce((sum, order) => sum + order.total, 0);

  return {
    settings: db.settings,
    storage: getStorageMeta(),
    kpis: {
      salesToday: parseMoney(salesToday),
      salesTodayDelivery: parseMoney(salesTodayDelivery),
      salesTodayPos: parseMoney(salesTodayPos),
      ordersToday: todayOrders.length,
      ordersTodayDelivery: todayDeliveryOrders.length,
      ordersTodayPos: todayPosOrders.length,
      avgTicket: parseMoney(monthlyOrders.length ? monthlyRevenue / monthlyOrders.length : 0),
      avgTicketDelivery: parseMoney(
        monthlyDeliveryOrders.length
          ? monthlyRevenueDelivery / monthlyDeliveryOrders.length
          : 0
      ),
      avgTicketPos: parseMoney(
        monthlyPosOrders.length ? monthlyRevenuePos / monthlyPosOrders.length : 0
      ),
      weeklyRevenue: parseMoney(weeklyRevenue),
      weeklyRevenueDelivery: parseMoney(weeklyRevenueDelivery),
      weeklyRevenuePos: parseMoney(weeklyRevenuePos),
      monthlyRevenue: parseMoney(monthlyRevenue),
      monthlyRevenueDelivery: parseMoney(monthlyRevenueDelivery),
      monthlyRevenuePos: parseMoney(monthlyRevenuePos)
    },
    statusCounts: STATUS_FLOW.reduce((summary, status) => {
      summary[status] = db.orders.filter((order) => order.status === status).length;
      return summary;
    }, {}),
    topProducts: aggregateTopProducts(monthlyOrders),
    recentOrders: [...db.orders].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    ),
    customers: [...db.customers].sort((left, right) => right.totalSpent - left.totalSpent),
    products: [...db.products].sort((left, right) => left.name.localeCompare(right.name)),
    categories: getCatalogCategories(db),
    paymentMethods: getPaymentMethods(db),
    promotions: db.promotions,
    riders: Array.isArray(db.riders) ? db.riders : [],
    expenses: expensesSorted,
    expensesTotal: parseMoney(expensesTotal),
    payables,
    payablesSummary: getFinancialSummary(payables),
    receivables,
    receivablesSummary: getFinancialSummary(receivables),
    supportRequests,
    stockSummary,
    cashRegister,
    deliveryFees: db.settings.deliveryFees,
    deliveryZones: db.deliveryZones || [],
    whatsapp: getWhatsAppStatus()
  };
};

const applyPromotions = ({ db, subtotal, neighborhood, couponCode }) => {
  let deliveryFee = getFeeForNeighborhood(db, neighborhood);
  let discount = 0;

  const activePromotions = db.promotions.filter((promotion) => promotion.active);
  const coupon = activePromotions.find(
    (promotion) =>
      promotion.type === "coupon" &&
      promotion.code &&
      promotion.code.toLowerCase() === String(couponCode || "").trim().toLowerCase()
  );

  if (coupon && subtotal >= Number(coupon.minimumOrder || 0)) {
    if (coupon.discountType === "percentage") {
      discount += (subtotal * Number(coupon.discountValue || 0)) / 100;
    } else {
      discount += Number(coupon.discountValue || 0);
    }
  }

  activePromotions
    .filter((promotion) => promotion.type === "shipping")
    .forEach((promotion) => {
      const eligibleNeighborhood =
        !promotion.neighborhood ||
        normalizeNeighborhood(promotion.neighborhood) === normalizeNeighborhood(neighborhood);
      const eligibleMinimum = subtotal >= Number(promotion.minimumOrder || 0);

      if (eligibleNeighborhood && eligibleMinimum) {
        deliveryFee = 0;
      }
    });

  return {
    deliveryFee: parseMoney(deliveryFee),
    discount: parseMoney(discount)
  };
};

const requireAdmin = async (request, response, next) => {
  const authorization = request.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");

  if (token === ADMIN_TOKEN) {
    return next();
  }

  if (!isSupabaseAuthEnabled()) {
    return response.status(503).json({ message: "Supabase Auth nao configurado." });
  }

  try {
    const user = await verifySupabaseToken(token);
    if (!user) {
      return response.status(401).json({ message: "Nao autorizado." });
    }
  } catch (error) {
    return response.status(401).json({ message: "Nao autorizado." });
  }

  return next();
};

const notifyOrderUpdate = (order, status, options = {}) => {
  io.emit("order:updated", order);
  io.to(`order:${order.id}`).emit("order:updated", order);
  io.emit("dashboard:update");
  const shouldNotifyWhatsapp =
    !options.skipWhatsApp && order?.channel !== "pos" && order?.customer?.phone;

  if (shouldNotifyWhatsapp) {
    sendWhatsAppUpdate(order, status).catch((error) => {
      console.error("[whatsapp-error]", error?.message || error);
    });
  }
};

io.on("connection", (socket) => {
  socket.on("order:subscribe", (orderId) => {
    if (orderId) {
      socket.join(`order:${orderId}`);
    }
  });

  socket.on("admin:subscribe", async (token) => {
    if (!token) {
      return;
    }

    if (token === ADMIN_TOKEN) {
      socket.join("admins");
      return;
    }

    try {
      const user = await verifySupabaseToken(token);
      if (user) {
        socket.join("admins");
      }
    } catch (error) {
      // ignore invalid tokens
    }
  });
});

app.get("/api/health", asyncHandler(async (_request, response) => {
  response.json({
    ok: true,
    version: appVersion,
    commit: appCommit,
    startedAt,
    storage: getStorageMeta()
  });
}));

app.get("/api/whatsapp/status", (_request, response) => {
  response.json(getWhatsAppStatus());
});

app.get("/api/whatsapp/qr", (_request, response) => {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.send(getWhatsAppQrPage());
});

app.get("/api/whatsapp/qr.png", (_request, response) => {
  const pngBuffer = getWhatsAppQrPngBuffer();

  if (!pngBuffer) {
    return response.status(404).json(getWhatsAppStatus());
  }

  response.setHeader("Content-Type", "image/png");
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.send(pngBuffer);
});

app.get("/api/store", asyncHandler(async (_request, response) => {
  const db = await readDB();
  response.json(getStorePayload(db));
}));

app.post("/api/customers/lookup", asyncHandler(async (request, response) => {
  const db = await readDB();
  const phone = normalizePhone(request.body.phone);
  const customer = db.customers.find((entry) => normalizePhone(entry.phone) === phone);

  if (!customer) {
    return response.json({ customer: null, lastOrder: null, trackingUrl: "" });
  }

  const lastOrder = db.orders.find((order) => order.id === customer.lastOrderId) || null;

  return response.json({
    customer,
    lastOrder,
    trackingUrl: lastOrder ? buildTrackingUrl(lastOrder.id) : ""
  });
}));

app.get("/api/orders/:id", asyncHandler(async (request, response) => {
  const db = await readDB();
  const order = db.orders.find((entry) => entry.id === request.params.id);

  if (!order) {
    return response.status(404).json({ message: "Pedido nao encontrado." });
  }

  return response.json({
    ...order,
    trackingUrl: buildTrackingUrl(order.id)
  });
}));

app.post("/api/orders", async (request, response) => {
  const payload = request.body || {};

  if (!payload.name || !payload.phone || !payload.address || !payload.neighborhood) {
    return response.status(400).json({ message: "Preencha nome, telefone, endereco e bairro." });
  }

  if (!Array.isArray(payload.items) || !payload.items.length) {
    return response.status(400).json({ message: "Adicione ao menos um item ao carrinho." });
  }

  let createdOrder = null;

  try {
    const db = await updateDB((draft) => {
      const items = payload.items
        .map((item) => {
          const product = draft.products.find((entry) => entry.id === item.productId);

          if (!product || !product.active || product.stock <= 0) {
            return null;
          }

          const quantity = Number(item.quantity || 0);

          if (quantity <= 0 || quantity > product.stock) {
            return null;
          }

          const salePrice = getSalePrice(product);

          return {
            productId: product.id,
            name: product.name,
            volume: product.volume,
            unitPrice: salePrice,
            quantity,
            lineTotal: parseMoney(salePrice * quantity)
          };
        })
        .filter(Boolean);

      if (!items.length) {
        throw new Error("Carrinho invalido.");
      }

      const subtotal = parseMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
      const { deliveryFee, discount } = applyPromotions({
        db: draft,
        subtotal,
        neighborhood: payload.neighborhood,
        couponCode: payload.couponCode
      });

      const customerPhone = normalizePhone(payload.phone);
      let customer = draft.customers.find((entry) => normalizePhone(entry.phone) === customerPhone);

      if (!customer) {
        customer = {
          id: createId("customer"),
          name: payload.name,
          phone: customerPhone,
          address: payload.address,
          neighborhood: payload.neighborhood,
          notes: payload.note || "",
          totalSpent: 0,
          orderIds: [],
          lastOrderId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        draft.customers.push(customer);
      }

      const order = {
        id: createId("order"),
        number: getSequenceNumber(draft.orders),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        channel: "delivery",
        customerId: customer.id,
        customer: {
          name: payload.name,
          phone: customerPhone,
          address: payload.address,
          neighborhood: payload.neighborhood,
          note: payload.note || ""
        },
        items,
        paymentMethod: payload.paymentMethod,
        changeFor: payload.paymentMethod === "dinheiro" ? payload.changeFor || "" : null,
        couponCode: payload.couponCode || "",
        subtotal,
        deliveryFee,
        discount,
        total: parseMoney(subtotal + deliveryFee - discount),
        status: "received",
        statusTimeline: buildStatusTimeline("received")
      };

      items.forEach((item) => {
        const product = draft.products.find((entry) => entry.id === item.productId);
        product.stock -= item.quantity;
      });

      customer.name = payload.name;
      customer.phone = customerPhone;
      customer.address = payload.address;
      customer.neighborhood = payload.neighborhood;
      customer.notes = payload.note || customer.notes || "";
      customer.totalSpent = parseMoney(Number(customer.totalSpent || 0) + order.total);
      customer.lastOrderId = order.id;
      customer.updatedAt = new Date().toISOString();
      customer.orderIds = [...new Set([...(customer.orderIds || []), order.id])];

      draft.orders.push(order);
      createdOrder = order;
      return draft;
    });

    notifyOrderUpdate(createdOrder, "received");

    return response.status(201).json({
      order: {
        ...createdOrder,
        trackingUrl: buildTrackingUrl(createdOrder.id)
      },
      store: getStorePayload(db)
    });
  } catch (error) {
    return response.status(400).json({
      message: error.message || "Nao foi possivel criar o pedido."
    });
  }
});

app.post("/api/admin/pos/orders", requireAdmin, async (request, response) => {
  const payload = request.body || {};

  if (!Array.isArray(payload.items) || !payload.items.length) {
    return response.status(400).json({ message: "Adicione ao menos um item ao carrinho." });
  }

  let createdOrder = null;

  try {
    const db = await updateDB((draft) => {
      const availablePaymentMethods = getAvailablePaymentMethodValues(draft);
      const items = payload.items
        .map((item) => {
          const product = draft.products.find((entry) => entry.id === item.productId);

          if (!product || !product.active || product.stock <= 0) {
            return null;
          }

          const quantity = Number(item.quantity || 0);

          if (quantity <= 0 || quantity > product.stock) {
            return null;
          }

          const salePrice = getSalePrice(product);

          return {
            productId: product.id,
            name: product.name,
            volume: product.volume,
            unitPrice: salePrice,
            quantity,
            lineTotal: parseMoney(salePrice * quantity)
          };
        })
        .filter(Boolean);

      if (!items.length) {
        throw new Error("Carrinho invalido.");
      }

      const subtotal = parseMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
      const { discount: rawDiscount } = applyPromotions({
        db: draft,
        subtotal,
        neighborhood: payload.neighborhood || "",
        couponCode: payload.couponCode
      });
      const promoDiscount = parseMoney(rawDiscount);
      const discountBase = Math.max(subtotal - promoDiscount, 0);
      const manualDiscount = Math.max(parseMoney(payload.manualDiscount), 0);
      const manualDiscountPercent = Math.min(
        Math.max(Number(payload.manualDiscountPercent || 0), 0),
        100
      );
      const manualDiscountPercentAmount = parseMoney(
        (discountBase * manualDiscountPercent) / 100
      );
      const manualDiscountFixedApplied = Math.min(manualDiscount, discountBase);
      const manualDiscountPercentApplied = Math.min(
        manualDiscountPercentAmount,
        Math.max(discountBase - manualDiscountFixedApplied, 0)
      );
      const manualDiscountTotal = parseMoney(
        manualDiscountFixedApplied + manualDiscountPercentApplied
      );
      const discount = Math.min(promoDiscount + manualDiscountTotal, subtotal);
      const surchargeBase = Math.max(subtotal - discount, 0);
      const manualSurcharge = Math.max(parseMoney(payload.manualSurcharge), 0);
      const manualSurchargePercent = Math.min(
        Math.max(Number(payload.manualSurchargePercent || 0), 0),
        100
      );
      const manualSurchargePercentAmount = parseMoney(
        (surchargeBase * manualSurchargePercent) / 100
      );
      const manualSurchargeTotal = parseMoney(manualSurcharge + manualSurchargePercentAmount);
      const now = new Date().toISOString();
      const customerPhone = normalizePhone(payload.phone);
      const customerName = String(payload.name || "").trim() || "Cliente balcao";
      const customerAddress = String(payload.address || "").trim() || "Retirada no balcao";
      const customerNeighborhood = String(payload.neighborhood || "").trim() || "Loja";
      const total = parseMoney(Math.max(subtotal - discount + manualSurchargeTotal, 0));
      const rawPayments = Array.isArray(payload.payments) ? payload.payments : [];
      let payments = [];
      let paidTotal = total;
      let changeDue = 0;
      let paymentMethod = payload.paymentMethod || "pix";

      if (rawPayments.length) {
        payments = rawPayments
          .map((entry) => ({
            method: String(entry.method || "pix").trim() || "pix",
            amount: parseMoney(entry.amount)
          }))
          .filter((entry) => entry.amount > 0);

        if (!payments.length) {
          throw new Error("Informe ao menos uma forma de pagamento.");
        }

        const invalidPayment = payments.find((entry) => !availablePaymentMethods.has(entry.method));
        if (invalidPayment) {
          throw new Error("Forma de pagamento invalida.");
        }

        const paymentsTotal = parseMoney(payments.reduce((sum, entry) => sum + entry.amount, 0));
        const cashTotal = parseMoney(
          payments
            .filter((entry) => entry.method === "dinheiro")
            .reduce((sum, entry) => sum + entry.amount, 0)
        );
        const overpayment = parseMoney(Math.max(paymentsTotal - total, 0));

        if (paymentsTotal < total) {
          throw new Error("Pagamentos insuficientes.");
        }

        if (overpayment > 0 && cashTotal < overpayment) {
          throw new Error("Troco maior que dinheiro informado.");
        }

        paymentMethod = payments.length === 1 ? payments[0].method : "multiple";
        paidTotal = paymentsTotal;
        changeDue = overpayment;
      } else {
        if (!availablePaymentMethods.has(paymentMethod)) {
          throw new Error("Forma de pagamento invalida.");
        }
        payments = [{ method: paymentMethod, amount: total }];
      }

      let customer = null;

      if (customerPhone) {
        customer = draft.customers.find((entry) => normalizePhone(entry.phone) === customerPhone);
      }

      if (!customer && customerPhone) {
        customer = {
          id: createId("customer"),
          name: customerName,
          phone: customerPhone,
          address: customerAddress,
          neighborhood: customerNeighborhood,
          notes: payload.note || "",
          totalSpent: 0,
          orderIds: [],
          lastOrderId: null,
          createdAt: now,
          updatedAt: now
        };
        draft.customers.push(customer);
      }

      const status = STATUS_FLOW.includes(payload.status) ? payload.status : "delivered";

      const order = {
        id: createId("order"),
        number: getSequenceNumber(draft.orders),
        createdAt: now,
        updatedAt: now,
        channel: "pos",
        customerId: customer ? customer.id : null,
        customer: {
          name: customerName,
          phone: customerPhone,
          address: customerAddress,
          neighborhood: customerNeighborhood,
          note: payload.note || ""
        },
        items,
        paymentMethod,
        payments,
        paidTotal,
        changeDue,
        couponCode: payload.couponCode || "",
        subtotal,
        deliveryFee: 0,
        discount,
        manualDiscount,
        manualDiscountPercent,
        manualDiscountPercentAmount: manualDiscountPercentApplied,
        manualSurcharge,
        manualSurchargePercent,
        manualSurchargePercentAmount,
        promoDiscount,
        total,
        status,
        statusTimeline: buildStatusTimeline(status, now)
      };

      items.forEach((item) => {
        const product = draft.products.find((entry) => entry.id === item.productId);
        product.stock -= item.quantity;
      });

      const cashEffect = parseMoney(
        payments
          .filter((entry) => entry.method === "dinheiro")
          .reduce((sum, entry) => sum + Number(entry.amount || 0), 0) - changeDue
      );

      if (cashEffect > 0) {
        appendCashMovement(draft, {
          type: "sale",
          amount: cashEffect,
          note: `Venda PDV #${order.number}`
        });
      }

      if (customer) {
        customer.name = customerName;
        customer.phone = customerPhone;
        customer.address = customerAddress;
        customer.neighborhood = customerNeighborhood;
        customer.notes = payload.note || customer.notes || "";
        customer.totalSpent = parseMoney(Number(customer.totalSpent || 0) + order.total);
        customer.lastOrderId = order.id;
        customer.updatedAt = now;
        customer.orderIds = [...new Set([...(customer.orderIds || []), order.id])];
      }

      draft.orders.push(order);
      createdOrder = order;
      return draft;
    });

    notifyOrderUpdate(createdOrder, createdOrder.status, { skipWhatsApp: true });

    return response.status(201).json({
      order: createdOrder,
      store: getStorePayload(db)
    });
  } catch (error) {
    return response.status(400).json({
      message: error.message || "Nao foi possivel registrar a venda PDV."
    });
  }
});

app.post("/api/admin/login", (request, response) => {
  const { username, password } = request.body || {};

  if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    return response.status(401).json({ message: "Usuario ou senha invalidos." });
  }

  return response.json({
    token: ADMIN_TOKEN,
    user: {
      name: "Operacao Turbo",
      username: ADMIN_USER
    }
  });
});

app.get("/api/admin/profile", requireAdmin, async (request, response) => {
  const authorization = request.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");

  if (!token || token === ADMIN_TOKEN) {
    return response.json({ profile: null, confirmed: true, user: null });
  }

  const data = await getSupabaseAdminProfile(token);
  if (!data) {
    return response.status(401).json({ message: "Nao autorizado." });
  }

  return response.json({
    profile: data.profile,
    user: { email: data.user.email },
    confirmed: data.confirmed
  });
});

app.get("/api/admin/debug-token", async (request, response) => {
  const authorization = request.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");

  if (!isSupabaseAuthEnabled()) {
    return response.status(503).json({
      ok: false,
      reason: "Supabase Auth nao configurado no backend."
    });
  }

  if (!token) {
    return response.status(400).json({
      ok: false,
      reason: "Token ausente no header Authorization."
    });
  }

  const data = await getSupabaseAdminProfile(token);
  if (!data) {
    return response.status(401).json({
      ok: false,
      reason: "Token invalido.",
      emailConfirmed: false
    });
  }

  return response.json({
    ok: true,
    email: data.user.email,
    emailConfirmed: data.confirmed,
    hasProfile: Boolean(data.profile)
  });
});

app.get("/api/admin/dashboard", requireAdmin, async (_request, response) => {
  const db = await readDB();
  const dashboard = buildDashboard(db);
  response.json({
    ...dashboard,
    recentOrders: [],
    customers: [],
    products: [],
    promotions: []
  });
});

app.get("/api/admin/storage", requireAdmin, async (_request, response) => {
  const db = await readDB();
  response.json({
    ...getStorageMeta(),
    counts: {
      products: db.products.length,
      promotions: db.promotions.length,
      customers: db.customers.length,
      orders: db.orders.length,
      expenses: Array.isArray(db.expenses) ? db.expenses.length : 0,
      riders: Array.isArray(db.riders) ? db.riders.length : 0
    }
  });
});

app.get("/api/admin/orders", requireAdmin, async (request, response) => {
  const db = await readDB();
  const limit = parseLimit(request.query.limit, 50);

  response.json(
    [...db.orders].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    ).slice(0, limit)
  );
});

app.get("/api/admin/products", requireAdmin, async (request, response) => {
  const db = await readDB();
  const limit = parseLimit(request.query.limit, 50);
  response.json(
    [...db.products]
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, limit)
  );
});

app.patch("/api/admin/orders/:id/status", requireAdmin, async (request, response) => {
  const { status } = request.body || {};

  if (!STATUS_FLOW.includes(status)) {
    return response.status(400).json({ message: "Status invalido." });
  }

  let updatedOrder = null;

  try {
    await updateDB((draft) => {
      const order = draft.orders.find((entry) => entry.id === request.params.id);

      if (!order) {
        throw new Error("Pedido nao encontrado.");
      }

      if (statusSortValue[status] < statusSortValue[order.status]) {
        throw new Error("Nao e permitido retroceder o status.");
      }

      if (order.status !== status) {
        order.status = status;
        order.updatedAt = new Date().toISOString();
        order.statusTimeline.push({ status, timestamp: new Date().toISOString() });
      }

      updatedOrder = order;
      return draft;
    });

    notifyOrderUpdate(updatedOrder, status);
    return response.json(updatedOrder);
  } catch (error) {
    return response.status(400).json({
      message: error.message || "Falha ao atualizar o status."
    });
  }
});

app.get("/api/admin/products", requireAdmin, async (_request, response) => {
  const db = await readDB();
  response.json(db.products);
});

app.post("/api/admin/products", requireAdmin, asyncHandler(async (request, response) => {
  const payload = request.body || {};

  if (!payload.name || !payload.category) {
    return response.status(400).json({ message: "Nome e categoria sao obrigatorios." });
  }

  if (payload.image && !isAllowedProductImage(payload.image)) {
    return response.status(400).json({ message: "Envie somente imagem PNG para o produto." });
  }

  let createdProduct = null;
  const db = await updateDB((draft) => {
    const salePrice = resolveSalePrice(payload);
    const category = String(payload.category || "").trim();

    createdProduct = {
      id: createId("prod"),
      name: payload.name,
      category,
      volume: payload.volume || "",
      salePrice,
      purchasePrice: resolvePurchasePrice(payload, salePrice),
      stock: Number(payload.stock || 0),
      active: payload.active ?? true,
      featured: payload.featured ?? false,
      badge: payload.badge || "",
      description: payload.description || "",
      image: payload.image || getDefaultProductImage(category)
    };
    draft.categories = getCatalogCategories({
      ...draft,
      categories: [...(draft.categories || []), category]
    });
    draft.products.push(createdProduct);
    return draft;
  });

  io.emit("catalog:updated", getStorePayload(db));
  return response.status(201).json(createdProduct);
}));

app.put("/api/admin/products/:id", requireAdmin, async (request, response) => {
  const payload = request.body || {};
  let updatedProduct = null;

  if (payload.image !== undefined && !isAllowedProductImage(payload.image)) {
    return response.status(400).json({ message: "Envie somente imagem PNG para o produto." });
  }

  try {
    const db = await updateDB((draft) => {
      const product = draft.products.find((entry) => entry.id === request.params.id);

      if (!product) {
        throw new Error("Produto nao encontrado.");
      }

      const nextSalePrice = resolveSalePrice(payload, getSalePrice(product));
      const nextPurchasePrice = resolvePurchasePrice(
        payload,
        nextSalePrice,
        getPurchasePrice(product)
      );

      Object.assign(product, {
        name: payload.name ?? product.name,
        category: payload.category ?? product.category,
        volume: payload.volume ?? product.volume,
        salePrice: nextSalePrice,
        purchasePrice: nextPurchasePrice,
        stock: payload.stock !== undefined ? Number(payload.stock) : product.stock,
        active: payload.active ?? product.active,
        featured: payload.featured ?? product.featured,
        badge: payload.badge ?? product.badge,
        description: payload.description ?? product.description,
        image: payload.image ?? product.image
      });

      draft.categories = getCatalogCategories(draft);

      updatedProduct = product;
      return draft;
    });

    io.emit("catalog:updated", getStorePayload(db));
    return response.json(updatedProduct);
  } catch (error) {
    return response.status(400).json({ message: error.message || "Falha ao atualizar produto." });
  }
});

app.delete("/api/admin/products/:id", requireAdmin, asyncHandler(async (request, response) => {
  const db = await updateDB((draft) => {
    draft.products = draft.products.filter((entry) => entry.id !== request.params.id);
    return draft;
  });

  io.emit("catalog:updated", getStorePayload(db));
  return response.status(204).end();
}));

app.patch("/api/admin/products/:id/toggle", requireAdmin, async (request, response) => {
  let updatedProduct = null;

  try {
    const db = await updateDB((draft) => {
      const product = draft.products.find((entry) => entry.id === request.params.id);

      if (!product) {
        throw new Error("Produto nao encontrado.");
      }

      product.active = !product.active;
      updatedProduct = product;
      return draft;
    });

    io.emit("catalog:updated", getStorePayload(db));
    return response.json(updatedProduct);
  } catch (error) {
    return response.status(400).json({ message: error.message || "Falha ao pausar produto." });
  }
});

app.get("/api/admin/categories", requireAdmin, async (_request, response) => {
  const db = await readDB();
  response.json(getCatalogCategories(db));
});

app.post("/api/admin/categories", requireAdmin, asyncHandler(async (request, response) => {
  const name = String(request.body?.name || "").trim();

  if (!name) {
    return response.status(400).json({ message: "Informe o nome da categoria." });
  }

  const db = await updateDB((draft) => {
    draft.categories = getCatalogCategories({
      ...draft,
      categories: [...(draft.categories || []), name]
    });
    return draft;
  });

  io.emit("catalog:updated", getStorePayload(db));
  return response.status(201).json(db.categories);
}));

app.delete("/api/admin/categories/:name", requireAdmin, async (request, response) => {
  const name = decodeURIComponent(request.params.name || "").trim();

  try {
    const db = await updateDB((draft) => {
      const categoryInUse = (draft.products || []).some((product) => product.category === name);
      if (categoryInUse) {
        throw new Error("Nao e possivel remover uma categoria em uso.");
      }

      draft.categories = (draft.categories || []).filter((category) => category !== name);
      return draft;
    });

    io.emit("catalog:updated", getStorePayload(db));
    return response.json(db.categories);
  } catch (error) {
    return response.status(400).json({ message: error.message || "Falha ao remover categoria." });
  }
});

app.get("/api/admin/promotions", requireAdmin, async (request, response) => {
  const db = await readDB();
  const limit = parseLimit(request.query.limit, 50);
  response.json([...db.promotions].slice(0, limit));
});

app.post("/api/admin/promotions", requireAdmin, asyncHandler(async (request, response) => {
  const payload = request.body || {};
  let createdPromotion = null;

  await updateDB((draft) => {
    createdPromotion = {
      id: createId("promo"),
      type: payload.type || "daily",
      title: payload.title || "Nova promocao",
      description: payload.description || "",
      code: payload.code || "",
      discountType: payload.discountType || "fixed",
      discountValue: Number(payload.discountValue || 0),
      minimumOrder: Number(payload.minimumOrder || 0),
      neighborhood: payload.neighborhood || "",
      active: payload.active ?? true,
      highlight: payload.highlight || ""
    };

    draft.promotions.push(createdPromotion);
    return draft;
  });

  io.emit("catalog:updated");
  return response.status(201).json(createdPromotion);
}));

app.put("/api/admin/promotions/:id", requireAdmin, async (request, response) => {
  const payload = request.body || {};
  let updatedPromotion = null;

  try {
    await updateDB((draft) => {
      const promotion = draft.promotions.find((entry) => entry.id === request.params.id);

      if (!promotion) {
        throw new Error("Promocao nao encontrada.");
      }

      Object.assign(promotion, {
        type: payload.type ?? promotion.type,
        title: payload.title ?? promotion.title,
        description: payload.description ?? promotion.description,
        code: payload.code ?? promotion.code,
        discountType: payload.discountType ?? promotion.discountType,
        discountValue:
          payload.discountValue !== undefined
            ? Number(payload.discountValue)
            : promotion.discountValue,
        minimumOrder:
          payload.minimumOrder !== undefined
            ? Number(payload.minimumOrder)
            : promotion.minimumOrder,
        neighborhood: payload.neighborhood ?? promotion.neighborhood,
        active: payload.active ?? promotion.active,
        highlight: payload.highlight ?? promotion.highlight
      });

      updatedPromotion = promotion;
      return draft;
    });

    io.emit("catalog:updated");
    return response.json(updatedPromotion);
  } catch (error) {
    return response.status(400).json({
      message: error.message || "Falha ao atualizar promocao."
    });
  }
});

app.delete("/api/admin/promotions/:id", requireAdmin, asyncHandler(async (request, response) => {
  await updateDB((draft) => {
    draft.promotions = draft.promotions.filter((entry) => entry.id !== request.params.id);
    return draft;
  });

  io.emit("catalog:updated");
  return response.status(204).end();
}));

app.get("/api/admin/expenses", requireAdmin, async (_request, response) => {
  const db = await readDB();
  const expenses = Array.isArray(db.expenses) ? db.expenses : [];
  response.json(
    [...expenses].sort(
      (left, right) =>
        new Date(right.createdAt || right.date || 0).getTime() -
        new Date(left.createdAt || left.date || 0).getTime()
    )
  );
});

app.post("/api/admin/expenses", requireAdmin, asyncHandler(async (request, response) => {
  const payload = request.body || {};

  if (!payload.title || !parseMoney(payload.amount)) {
    return response.status(400).json({ message: "Informe titulo e valor da despesa." });
  }

  const now = new Date().toISOString();
  const expense = {
    id: createId("expense"),
    title: String(payload.title || "").trim(),
    category: String(payload.category || "").trim(),
    amount: parseMoney(payload.amount),
    date: parseExpenseDate(payload.date, now),
    note: String(payload.note || "").trim(),
    createdAt: now,
    updatedAt: now
  };

  const db = await updateDB((draft) => {
    draft.expenses = Array.isArray(draft.expenses) ? draft.expenses : [];
    draft.expenses.push(expense);
    return draft;
  });

  return response.status(201).json({
    expense,
    total: parseMoney(
      (db.expenses || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
    )
  });
}));

app.put("/api/admin/expenses/:id", requireAdmin, async (request, response) => {
  const payload = request.body || {};
  const now = new Date().toISOString();
  let updatedExpense = null;

  try {
    await updateDB((draft) => {
      draft.expenses = Array.isArray(draft.expenses) ? draft.expenses : [];
      const expense = draft.expenses.find((entry) => entry.id === request.params.id);

      if (!expense) {
        throw new Error("Despesa nao encontrada.");
      }

      if (hasValue(payload.title)) {
        expense.title = String(payload.title || "").trim();
      }
      if (hasValue(payload.category)) {
        expense.category = String(payload.category || "").trim();
      }
      if (hasValue(payload.amount)) {
        expense.amount = parseMoney(payload.amount);
      }
      if (hasValue(payload.date)) {
        expense.date = parseExpenseDate(payload.date, expense.date || expense.createdAt || now);
      }
      if (hasValue(payload.note)) {
        expense.note = String(payload.note || "").trim();
      }

      expense.updatedAt = now;
      updatedExpense = expense;
      return draft;
    });

    return response.json({ expense: updatedExpense });
  } catch (error) {
    return response.status(404).json({ message: error.message || "Despesa nao encontrada." });
  }
});

app.delete("/api/admin/expenses/:id", requireAdmin, asyncHandler(async (request, response) => {
  await updateDB((draft) => {
    draft.expenses = Array.isArray(draft.expenses) ? draft.expenses : [];
    draft.expenses = draft.expenses.filter((expense) => expense.id !== request.params.id);
    return draft;
  });

  return response.json({ ok: true });
}));

app.get("/api/admin/payables", requireAdmin, async (_request, response) => {
  const db = await readDB();
  response.json(sortFinancialEntries(db.payables || []));
});

app.post("/api/admin/payables", requireAdmin, asyncHandler(async (request, response) => {
  const payload = request.body || {};

  if (!payload.title || !parseMoney(payload.amount)) {
    return response.status(400).json({ message: "Informe titulo e valor da conta a pagar." });
  }

  const now = new Date().toISOString();
  const payable = {
    id: createId("payable"),
    title: String(payload.title || "").trim(),
    category: String(payload.category || "").trim(),
    amount: parseMoney(payload.amount),
    dueDate: parseExpenseDate(payload.dueDate, now),
    note: String(payload.note || "").trim(),
    status: payload.status === "paid" ? "paid" : "pending",
    createdAt: now,
    updatedAt: now
  };

  await updateDB((draft) => {
    draft.payables = Array.isArray(draft.payables) ? draft.payables : [];
    draft.payables.push(payable);
    return draft;
  });

  return response.status(201).json(payable);
}));

app.put("/api/admin/payables/:id", requireAdmin, async (request, response) => {
  const payload = request.body || {};
  const now = new Date().toISOString();
  let updatedPayable = null;

  try {
    await updateDB((draft) => {
      draft.payables = Array.isArray(draft.payables) ? draft.payables : [];
      const payable = draft.payables.find((entry) => entry.id === request.params.id);

      if (!payable) {
        throw new Error("Conta a pagar nao encontrada.");
      }

      if (hasValue(payload.title)) payable.title = String(payload.title || "").trim();
      if (hasValue(payload.category)) payable.category = String(payload.category || "").trim();
      if (hasValue(payload.amount)) payable.amount = parseMoney(payload.amount);
      if (hasValue(payload.dueDate)) {
        payable.dueDate = parseExpenseDate(payload.dueDate, payable.dueDate || now);
      }
      if (hasValue(payload.note)) payable.note = String(payload.note || "").trim();
      if (hasValue(payload.status)) {
        payable.status = payload.status === "paid" ? "paid" : "pending";
      }

      payable.updatedAt = now;
      updatedPayable = payable;
      return draft;
    });

    return response.json(updatedPayable);
  } catch (error) {
    return response.status(404).json({ message: error.message || "Conta a pagar nao encontrada." });
  }
});

app.delete("/api/admin/payables/:id", requireAdmin, asyncHandler(async (request, response) => {
  await updateDB((draft) => {
    draft.payables = Array.isArray(draft.payables) ? draft.payables : [];
    draft.payables = draft.payables.filter((entry) => entry.id !== request.params.id);
    return draft;
  });

  return response.json({ ok: true });
}));

app.get("/api/admin/receivables", requireAdmin, async (_request, response) => {
  const db = await readDB();
  response.json(sortFinancialEntries(db.receivables || []));
});

app.post("/api/admin/receivables", requireAdmin, asyncHandler(async (request, response) => {
  const payload = request.body || {};

  if (!payload.title || !parseMoney(payload.amount)) {
    return response.status(400).json({ message: "Informe titulo e valor da conta a receber." });
  }

  const now = new Date().toISOString();
  const receivable = {
    id: createId("receivable"),
    title: String(payload.title || "").trim(),
    customerName: String(payload.customerName || "").trim(),
    customerPhone: normalizePhone(payload.customerPhone || ""),
    category: String(payload.category || "").trim(),
    amount: parseMoney(payload.amount),
    dueDate: parseExpenseDate(payload.dueDate, now),
    note: String(payload.note || "").trim(),
    status: payload.status === "paid" ? "paid" : "pending",
    createdAt: now,
    updatedAt: now
  };

  await updateDB((draft) => {
    draft.receivables = Array.isArray(draft.receivables) ? draft.receivables : [];
    draft.receivables.push(receivable);
    return draft;
  });

  return response.status(201).json(receivable);
}));

app.put("/api/admin/receivables/:id", requireAdmin, async (request, response) => {
  const payload = request.body || {};
  const now = new Date().toISOString();
  let updatedReceivable = null;

  try {
    await updateDB((draft) => {
      draft.receivables = Array.isArray(draft.receivables) ? draft.receivables : [];
      const receivable = draft.receivables.find((entry) => entry.id === request.params.id);

      if (!receivable) {
        throw new Error("Conta a receber nao encontrada.");
      }

      if (hasValue(payload.title)) receivable.title = String(payload.title || "").trim();
      if (hasValue(payload.customerName)) {
        receivable.customerName = String(payload.customerName || "").trim();
      }
      if (payload.customerPhone !== undefined) {
        receivable.customerPhone = normalizePhone(payload.customerPhone || "");
      }
      if (hasValue(payload.category)) receivable.category = String(payload.category || "").trim();
      if (hasValue(payload.amount)) receivable.amount = parseMoney(payload.amount);
      if (hasValue(payload.dueDate)) {
        receivable.dueDate = parseExpenseDate(payload.dueDate, receivable.dueDate || now);
      }
      if (hasValue(payload.note)) receivable.note = String(payload.note || "").trim();
      if (hasValue(payload.status)) {
        receivable.status = payload.status === "paid" ? "paid" : "pending";
      }

      receivable.updatedAt = now;
      updatedReceivable = receivable;
      return draft;
    });

    return response.json(updatedReceivable);
  } catch (error) {
    return response.status(404).json({ message: error.message || "Conta a receber nao encontrada." });
  }
});

app.delete("/api/admin/receivables/:id", requireAdmin, asyncHandler(async (request, response) => {
  await updateDB((draft) => {
    draft.receivables = Array.isArray(draft.receivables) ? draft.receivables : [];
    draft.receivables = draft.receivables.filter((entry) => entry.id !== request.params.id);
    return draft;
  });

  return response.json({ ok: true });
}));

app.post("/api/admin/cash/open", requireAdmin, async (request, response) => {
  const payload = request.body || {};
  const openingBalance = parseMoney(payload.openingBalance);
  const now = new Date().toISOString();
  let session = null;

  try {
    await updateDB((draft) => {
      const cashRegister = ensureCashRegister(draft);

      if (cashRegister.currentSession) {
        throw new Error("Ja existe um caixa aberto.");
      }

      session = {
        id: createId("cash-session"),
        openedAt: now,
        closedAt: null,
        openingBalance,
        expectedBalance: openingBalance,
        countedBalance: null,
        difference: null,
        note: String(payload.note || "").trim(),
        movements: [
          {
            id: createId("cash-move"),
            type: "opening",
            amount: openingBalance,
            note: "Abertura de caixa",
            createdAt: now
          }
        ]
      };

      cashRegister.currentSession = session;
      return draft;
    });

    return response.status(201).json(session);
  } catch (error) {
    return response.status(400).json({ message: error.message || "Falha ao abrir caixa." });
  }
});

app.post("/api/admin/cash/movement", requireAdmin, async (request, response) => {
  const payload = request.body || {};
  const type = payload.type === "withdrawal" ? "withdrawal" : payload.type === "supply" ? "supply" : "";
  const amount = parseMoney(payload.amount);
  let session = null;

  if (!type || amount <= 0) {
    return response.status(400).json({ message: "Informe tipo e valor do movimento." });
  }

  try {
    await updateDB((draft) => {
      const cashRegister = ensureCashRegister(draft);

      if (!cashRegister.currentSession) {
        throw new Error("Abra o caixa antes de lancar movimentos.");
      }

      const signedAmount = type === "withdrawal" ? -amount : amount;
      appendCashMovement(draft, {
        type,
        amount: signedAmount,
        note: String(payload.note || "").trim() || (type === "withdrawal" ? "Retirada" : "Suprimento")
      });
      session = cashRegister.currentSession;
      return draft;
    });

    return response.status(201).json(session);
  } catch (error) {
    return response.status(400).json({ message: error.message || "Falha ao registrar movimento." });
  }
});

app.post("/api/admin/cash/close", requireAdmin, async (request, response) => {
  const payload = request.body || {};
  const countedBalance = parseMoney(payload.countedBalance);
  const now = new Date().toISOString();
  let closedSession = null;

  try {
    await updateDB((draft) => {
      const cashRegister = ensureCashRegister(draft);
      const session = cashRegister.currentSession;

      if (!session) {
        throw new Error("Nao existe caixa aberto.");
      }

      closedSession = {
        ...session,
        closedAt: now,
        countedBalance,
        difference: parseMoney(countedBalance - Number(session.expectedBalance || 0)),
        note: String(payload.note || session.note || "").trim()
      };

      cashRegister.history = [closedSession, ...(cashRegister.history || [])].slice(0, 20);
      cashRegister.currentSession = null;
      return draft;
    });

    return response.json(closedSession);
  } catch (error) {
    return response.status(400).json({ message: error.message || "Falha ao fechar caixa." });
  }
});

app.post("/api/admin/history/clear", requireAdmin, async (request, response) => {
  const target = String(request.body?.target || "all").trim();

  if (!["delivery", "pos", "all"].includes(target)) {
    return response.status(400).json({ message: "Destino de limpeza invalido." });
  }

  const db = await updateDB((draft) => {
    draft.orders = (draft.orders || []).filter((order) => {
      if (target === "delivery") {
        return order.channel === "pos";
      }
      if (target === "pos") {
        return order.channel !== "pos";
      }
      return false;
    });
    recalculateCustomers(draft);
    return draft;
  });

  io.emit("catalog:updated", getStorePayload(db));
  io.emit("dashboard:update");
  return response.json({ ok: true, remainingOrders: db.orders.length });
});

app.put("/api/admin/support-requests/:id/resolve", requireAdmin, async (request, response) => {
  const now = new Date().toISOString();
  let updatedRequest = null;

  try {
    await updateDB((draft) => {
      draft.supportRequests = Array.isArray(draft.supportRequests) ? draft.supportRequests : [];
      const entry = draft.supportRequests.find((item) => item.id === request.params.id);

      if (!entry) {
        throw new Error("Solicitacao nao encontrada.");
      }

      entry.status = "resolved";
      entry.updatedAt = now;
      updatedRequest = entry;
      return draft;
    });

    io.emit("dashboard:update");
    return response.json(updatedRequest);
  } catch (error) {
    return response.status(404).json({ message: error.message || "Solicitacao nao encontrada." });
  }
});

app.get("/api/admin/riders", requireAdmin, async (_request, response) => {
  const db = await readDB();
  const riders = Array.isArray(db.riders) ? db.riders : [];
  response.json(
    [...riders].sort((left, right) => left.name.localeCompare(right.name))
  );
});

app.post("/api/admin/riders", requireAdmin, asyncHandler(async (request, response) => {
  const payload = request.body || {};

  if (!payload.name) {
    return response.status(400).json({ message: "Informe o nome do motoboy." });
  }

  const now = new Date().toISOString();
  const rider = {
    id: createId("rider"),
    name: String(payload.name || "").trim(),
    phone: String(payload.phone || "").trim(),
    active: payload.active ?? true,
    createdAt: now,
    updatedAt: now
  };

  await updateDB((draft) => {
    draft.riders = Array.isArray(draft.riders) ? draft.riders : [];
    draft.riders.push(rider);
    return draft;
  });

  return response.status(201).json(rider);
}));

app.put("/api/admin/riders/:id", requireAdmin, async (request, response) => {
  const payload = request.body || {};
  const now = new Date().toISOString();
  let updatedRider = null;

  try {
    await updateDB((draft) => {
      draft.riders = Array.isArray(draft.riders) ? draft.riders : [];
      const rider = draft.riders.find((entry) => entry.id === request.params.id);

      if (!rider) {
        throw new Error("Motoboy nao encontrado.");
      }

      if (hasValue(payload.name)) {
        rider.name = String(payload.name || "").trim();
      }
      if (hasValue(payload.phone)) {
        rider.phone = String(payload.phone || "").trim();
      }
      if (payload.active !== undefined) {
        rider.active = Boolean(payload.active);
      }

      rider.updatedAt = now;
      updatedRider = rider;
      return draft;
    });

    return response.json(updatedRider);
  } catch (error) {
    return response.status(404).json({ message: error.message || "Motoboy nao encontrado." });
  }
});

app.delete("/api/admin/riders/:id", requireAdmin, asyncHandler(async (request, response) => {
  await updateDB((draft) => {
    draft.riders = Array.isArray(draft.riders) ? draft.riders : [];
    draft.riders = draft.riders.filter((rider) => rider.id !== request.params.id);
    draft.orders = draft.orders.map((order) =>
      order.riderId === request.params.id ? { ...order, riderId: null } : order
    );
    return draft;
  });

  return response.json({ ok: true });
}));

app.put("/api/admin/orders/:id/rider", requireAdmin, async (request, response) => {
  const { riderId } = request.body || {};
  let updatedOrder = null;

  try {
    await updateDB((draft) => {
      const order = draft.orders.find((entry) => entry.id === request.params.id);

      if (!order) {
        throw new Error("Pedido nao encontrado.");
      }

      if (riderId) {
        const rider = (draft.riders || []).find((entry) => entry.id === riderId);
        if (!rider) {
          throw new Error("Motoboy nao encontrado.");
        }
        order.riderId = riderId;
      } else {
        order.riderId = null;
      }

      order.updatedAt = new Date().toISOString();
      updatedOrder = order;
      return draft;
    });

    return response.json(updatedOrder);
  } catch (error) {
    return response.status(400).json({ message: error.message || "Falha ao atualizar motoboy." });
  }
});

app.get("/api/admin/customers", requireAdmin, async (request, response) => {
  const db = await readDB();
  const limit = parseLimit(request.query.limit, 50);
  const customers = db.customers.map((customer) => ({
    ...customer,
    previousOrders: customer.orderIds
      .map((orderId) => db.orders.find((order) => order.id === orderId))
      .filter(Boolean)
  }));

  response.json(customers.sort((left, right) => right.totalSpent - left.totalSpent).slice(0, limit));
});

const reportsCache = new Map();
const REPORTS_CACHE_TTL_MS = 15000;

app.post("/api/admin/customers", requireAdmin, asyncHandler(async (request, response) => {
  const payload = request.body || {};
  const name = String(payload.name || "").trim();
  const phone = normalizePhone(payload.phone);
  const address = String(payload.address || "").trim();
  const neighborhood = String(payload.neighborhood || "").trim();
  const notes = String(payload.notes || "").trim();

  if (!name || !phone || !address || !neighborhood) {
    return response.status(400).json({
      message: "Preencha nome, telefone, endereco e bairro para cadastrar o cliente."
    });
  }

  let createdCustomer = null;

  try {
    await updateDB((draft) => {
      draft.customers = Array.isArray(draft.customers) ? draft.customers : [];

      if (draft.customers.some((entry) => normalizePhone(entry.phone) === phone)) {
        throw new Error("Ja existe um cliente cadastrado com esse telefone.");
      }

      const now = new Date().toISOString();
      createdCustomer = {
        id: createId("customer"),
        name,
        phone,
        address,
        neighborhood,
        notes,
        totalSpent: 0,
        orderIds: [],
        lastOrderId: null,
        createdAt: now,
        updatedAt: now
      };

      draft.customers.push(createdCustomer);
      return draft;
    });

    return response.status(201).json(createdCustomer);
  } catch (error) {
    return response.status(400).json({ message: error.message || "Falha ao cadastrar cliente." });
  }
}));

app.put("/api/admin/settings/fees", requireAdmin, asyncHandler(async (request, response) => {
  const fees = request.body.fees || {};

  const db = await updateDB((draft) => {
    const sanitizedFees = Object.fromEntries(
      Object.entries(fees)
        .map(([neighborhood, fee]) => [String(neighborhood || "").trim(), Number(fee)])
        .filter(([neighborhood]) => neighborhood.trim())
    );
    draft.settings.deliveryFees = sanitizedFees;
    draft.deliveryZones = Object.entries(sanitizedFees).map(([name, fee], index) => ({
      id:
        draft.deliveryZones?.find((zone) => zone.name === name)?.id ||
        `zone-${index + 1}-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name,
      fee: Number(fee || 0),
      active: true
    }));
    return draft;
  });

  io.emit("catalog:updated", getStorePayload(db));
  return response.json(db.settings.deliveryFees);
}));

app.get("/api/admin/reports", requireAdmin, async (request, response) => {
  const db = await readDB();
  const requestedDays = Number(request.query.days || 7);
  const periodDays = Number.isFinite(requestedDays)
    ? Math.min(Math.max(Math.floor(requestedDays), 1), 60)
    : 7;
  const cacheKey = `${periodDays}:${db.orders.length}:${db.products.length}:${db.expenses?.length || 0}`;
  const cached = reportsCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < REPORTS_CACHE_TTL_MS) {
    return response.json(cached.payload);
  }

  const dashboard = buildDashboard(db);
  const recentOrders = dashboard.recentOrders.filter((order) =>
    isWithinDays(order.createdAt, periodDays)
  );
  const deliveryOrders = recentOrders.filter((order) => order.channel !== "pos");
  const posOrders = recentOrders.filter((order) => order.channel === "pos");

  const payload = {
    ...dashboard.kpis,
    periodDays,
    topProducts: dashboard.topProducts,
    dailySales: buildDailySeries(recentOrders, periodDays),
    dailySalesDelivery: buildDailySeries(deliveryOrders, periodDays),
    dailySalesPos: buildDailySeries(posOrders, periodDays)
  };

  reportsCache.clear();
  reportsCache.set(cacheKey, { createdAt: Date.now(), payload });

  response.json(payload);
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api")) {
      return next();
    }

    return response.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((error, _request, response, _next) => {
  const message = error?.message || "Erro interno do servidor.";
  console.error("[api-error]", message);

  if (response.headersSent) {
    return;
  }

  response.status(500).json({ message });
});

initializeWhatsAppBot();
bootstrapStorage()
  .then((result) => {
    console.log(`[storage] Inicializado em modo ${result.mode}${result.synced ? " com sincronizacao" : ""}.`);
  })
  .catch((error) => {
    console.error("[storage-bootstrap-error]", error?.message || error);
  });

server.listen(port, host, () => {
  console.log(`Delivery server running on http://${host}:${port}`);
  console.log(`Admin padrao: ${ADMIN_USER} / ${ADMIN_PASSWORD}`);
  console.log(`Status disponiveis: ${STATUS_FLOW.map((status) => STATUS_LABELS[status]).join(", ")}`);
  console.log(`Loja publica: ${getPublicStoreUrl()}`);
  console.log(`WhatsApp: ${getWhatsAppStatus().enabled ? "habilitado" : "desativado"}`);
  console.log(`Exemplo de rastreio: ${buildTrackingUrl("pedido-exemplo")}`);
  console.log(`Exemplo de valor formatado: ${formatCurrency(99.9)}`);
});
