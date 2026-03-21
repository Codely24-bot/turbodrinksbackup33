import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { initialData } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const defaultDataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const dataDir = process.env.DATA_DIR || process.env.APP_DATA_DIR || defaultDataDir;
const resolvedDataDir = path.resolve(dataDir);
const backupDir = path.join(resolvedDataDir, "backups");

const loadEnvFile = () => {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadEnvFile();

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDir(resolvedDataDir);
ensureDir(backupDir);

const dbPath = path.join(resolvedDataDir, "db.json");

const getDatabaseCatalogScore = (data) => {
  if (!data) {
    return -1;
  }

  const products = Array.isArray(data.products) ? data.products.length : 0;
  const promotions = Array.isArray(data.promotions) ? data.promotions.length : 0;
  const customers = Array.isArray(data.customers) ? data.customers.length : 0;
  const orders = Array.isArray(data.orders) ? data.orders.length : 0;
  const supportRequests = Array.isArray(data.supportRequests) ? data.supportRequests.length : 0;

  return products * 1000 + promotions * 100 + customers * 10 + orders + supportRequests;
};

const getTimestampValue = (value) => {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDatabaseFreshnessScore = (data) => {
  if (!data) {
    return 0;
  }

  const settingsTimestamp = Math.max(
    getTimestampValue(data.settings?.updatedAt),
    getTimestampValue(data.settings?.createdAt)
  );

  const collectionTimestamps = [
    ...(data.products || []).flatMap((entry) => [entry?.updatedAt, entry?.createdAt]),
    ...(data.promotions || []).flatMap((entry) => [entry?.updatedAt, entry?.createdAt]),
    ...(data.customers || []).flatMap((entry) => [entry?.updatedAt, entry?.createdAt]),
    ...(data.orders || []).flatMap((entry) => [entry?.updatedAt, entry?.createdAt]),
    ...(data.expenses || []).flatMap((entry) => [entry?.updatedAt, entry?.createdAt, entry?.date]),
    ...(data.riders || []).flatMap((entry) => [entry?.updatedAt, entry?.createdAt]),
    ...(data.supportRequests || []).flatMap((entry) => [
      entry?.updatedAt,
      entry?.createdAt,
      entry?.requestedAt
    ])
  ].map(getTimestampValue);

  return Math.max(settingsTimestamp, ...collectionTimestamps, 0);
};

const choosePreferredDatabase = (primary, secondary) => {
  if (!primary) {
    return secondary;
  }

  if (!secondary) {
    return primary;
  }

  const primaryFreshness = getDatabaseFreshnessScore(primary);
  const secondaryFreshness = getDatabaseFreshnessScore(secondary);

  if (primaryFreshness !== secondaryFreshness) {
    return primaryFreshness > secondaryFreshness ? primary : secondary;
  }

  return getDatabaseCatalogScore(primary) >= getDatabaseCatalogScore(secondary)
    ? primary
    : secondary;
};

const deepCopy = (value) => JSON.parse(JSON.stringify(value));
const normalizeMoney = (value) => Number(Number(value || 0).toFixed(2));
const normalizeCategory = (category) => String(category || "").trim();
const normalizePaymentMethod = (method) => ({
  value: String(method?.value || "").trim(),
  label: String(method?.label || method?.value || "").trim(),
  active: method?.active ?? true
});
const normalizeFinancialEntry = (entry) => ({
  ...entry,
  title: String(entry?.title || "").trim(),
  category: String(entry?.category || "").trim(),
  amount: normalizeMoney(entry?.amount),
  status: String(entry?.status || "pending").trim() || "pending"
});
const normalizeSupportRequest = (entry) => ({
  ...entry,
  customerName: String(entry?.customerName || "").trim(),
  phone: String(entry?.phone || "").trim(),
  source: String(entry?.source || "whatsapp").trim() || "whatsapp",
  status: String(entry?.status || "pending").trim() || "pending",
  note: String(entry?.note || "").trim()
});
const normalizeDeliveryZone = (entry) => ({
  id: String(entry?.id || "").trim(),
  name: String(entry?.name || "").trim(),
  fee: normalizeMoney(entry?.fee),
  active: entry?.active ?? true,
  createdAt: entry?.createdAt,
  updatedAt: entry?.updatedAt
});
const normalizeCashMovement = (movement) => ({
  ...movement,
  amount: normalizeMoney(movement?.amount),
  type: String(movement?.type || "").trim(),
  note: String(movement?.note || "").trim()
});
const normalizeCashSession = (session) => {
  if (!session) {
    return null;
  }

  return {
    ...session,
    openingBalance: normalizeMoney(session?.openingBalance),
    expectedBalance: normalizeMoney(session?.expectedBalance),
    countedBalance:
      session?.countedBalance === null || session?.countedBalance === undefined
        ? null
        : normalizeMoney(session?.countedBalance),
    difference:
      session?.difference === null || session?.difference === undefined
        ? null
        : normalizeMoney(session?.difference),
    movements: Array.isArray(session?.movements)
      ? session.movements.map(normalizeCashMovement)
      : []
  };
};
const normalizeCashRegister = (cashRegister) => ({
  currentSession: normalizeCashSession(cashRegister?.currentSession),
  history: Array.isArray(cashRegister?.history)
    ? cashRegister.history.map(normalizeCashSession)
    : []
});
const createTimestamp = () => new Date().toISOString();
const resolveCreatedAt = (value) => value || createTimestamp();
const resolveUpdatedAt = (updatedAt, createdAt) =>
  updatedAt || createdAt || createTimestamp();
const normalizeProduct = (product) => {
  const salePrice = normalizeMoney(product.salePrice ?? product.price);
  const legacyOriginalPrice = Number(product.originalPrice);
  const fallbackPurchasePrice =
    Number.isFinite(legacyOriginalPrice) && legacyOriginalPrice <= salePrice
      ? legacyOriginalPrice
      : salePrice;
  const purchasePrice = normalizeMoney(product.purchasePrice ?? fallbackPurchasePrice);
  const { price, originalPrice, ...rest } = product;

  return {
    ...rest,
    salePrice,
    purchasePrice
  };
};
const normalizeExpense = (expense) => ({
  ...expense,
  amount: normalizeMoney(expense?.amount)
});
const normalizePromotion = (promotion) => ({
  ...promotion,
  discountValue: normalizeMoney(promotion?.discountValue),
  minimumOrder: normalizeMoney(promotion?.minimumOrder)
});
const normalizeCustomer = (customer) => ({
  ...customer,
  totalSpent: normalizeMoney(customer?.totalSpent),
  orderIds: Array.isArray(customer?.orderIds) ? customer.orderIds : []
});
const normalizeOrderItem = (item) => ({
  ...item,
  unitPrice: normalizeMoney(item?.unitPrice),
  lineTotal: normalizeMoney(item?.lineTotal),
  quantity: Number(item?.quantity || 0)
});
const normalizeOrder = (order) => ({
  ...order,
  subtotal: normalizeMoney(order?.subtotal),
  deliveryFee: normalizeMoney(order?.deliveryFee),
  discount: normalizeMoney(order?.discount),
  total: normalizeMoney(order?.total),
  items: Array.isArray(order?.items) ? order.items.map(normalizeOrderItem) : [],
  statusTimeline: Array.isArray(order?.statusTimeline) ? order.statusTimeline : []
});
const normalizeRider = (rider) => ({
  ...rider,
  active: rider?.active ?? true
});
const normalizeDatabase = (data = {}) => ({
  ...data,
  settings: {
    ...(data.settings || {}),
    deliveryFees: data.settings?.deliveryFees || {}
  },
  categories: Array.isArray(data.categories)
    ? data.categories.map(normalizeCategory).filter(Boolean)
    : [],
  paymentMethods: Array.isArray(data.paymentMethods)
    ? data.paymentMethods
        .map(normalizePaymentMethod)
        .filter((method) => method.value && method.label)
    : [],
  deliveryZones: Array.isArray(data.deliveryZones)
    ? data.deliveryZones.map(normalizeDeliveryZone).filter((entry) => entry.name)
    : [],
  promotions: Array.isArray(data.promotions) ? data.promotions.map(normalizePromotion) : [],
  customers: Array.isArray(data.customers) ? data.customers.map(normalizeCustomer) : [],
  orders: Array.isArray(data.orders) ? data.orders.map(normalizeOrder) : [],
  expenses: Array.isArray(data.expenses) ? data.expenses.map(normalizeExpense) : [],
  payables: Array.isArray(data.payables) ? data.payables.map(normalizeFinancialEntry) : [],
  receivables: Array.isArray(data.receivables) ? data.receivables.map(normalizeFinancialEntry) : [],
  supportRequests: Array.isArray(data.supportRequests)
    ? data.supportRequests.map(normalizeSupportRequest)
    : [],
  riders: Array.isArray(data.riders) ? data.riders.map(normalizeRider) : [],
  cashRegister: normalizeCashRegister(data.cashRegister),
  products: Array.isArray(data.products) ? data.products.map(normalizeProduct) : []
});

const mergeFallbackData = (preferred, fallback) => {
  const normalizedPreferred = normalizeDatabase(preferred);
  const normalizedFallback = normalizeDatabase(fallback);
  const preferredDeliveryZones = normalizedPreferred.deliveryZones.length
    ? normalizedPreferred.deliveryZones
    : normalizedFallback.deliveryZones;
  const preferredDeliveryFees = preferredDeliveryZones.length
    ? Object.fromEntries(
        preferredDeliveryZones.filter((entry) => entry.active).map((entry) => [entry.name, entry.fee])
      )
    : normalizedPreferred.settings?.deliveryFees || normalizedFallback.settings?.deliveryFees || {};

  return normalizeDatabase({
    ...normalizedPreferred,
    settings: {
      ...(normalizedFallback.settings || {}),
      ...(normalizedPreferred.settings || {}),
      deliveryFees: preferredDeliveryFees
    },
    categories: normalizedPreferred.categories.length
      ? normalizedPreferred.categories
      : normalizedFallback.categories,
    paymentMethods: normalizedPreferred.paymentMethods.length
      ? normalizedPreferred.paymentMethods
      : normalizedFallback.paymentMethods,
    deliveryZones: preferredDeliveryZones,
    products: normalizedPreferred.products.length
      ? normalizedPreferred.products
      : normalizedFallback.products,
    promotions: normalizedPreferred.promotions.length
      ? normalizedPreferred.promotions
      : normalizedFallback.promotions,
    customers: normalizedPreferred.customers.length
      ? normalizedPreferred.customers
      : normalizedFallback.customers,
    orders: normalizedPreferred.orders.length ? normalizedPreferred.orders : normalizedFallback.orders,
    expenses: normalizedPreferred.expenses.length
      ? normalizedPreferred.expenses
      : normalizedFallback.expenses,
    payables: normalizedPreferred.payables.length
      ? normalizedPreferred.payables
      : normalizedFallback.payables,
    receivables: normalizedPreferred.receivables.length
      ? normalizedPreferred.receivables
      : normalizedFallback.receivables,
    supportRequests: normalizedPreferred.supportRequests.length
      ? normalizedPreferred.supportRequests
      : normalizedFallback.supportRequests,
    riders: normalizedPreferred.riders.length ? normalizedPreferred.riders : normalizedFallback.riders,
    cashRegister:
      normalizedPreferred.cashRegister?.currentSession ||
      normalizedPreferred.cashRegister?.history?.length
        ? normalizedPreferred.cashRegister
        : normalizedFallback.cashRegister
  });
};

const hasMeaningfulData = (data) => {
  if (!data) {
    return false;
  }

  const normalizedData = normalizeDatabase(data);

  return Boolean(
    normalizedData.products.length ||
      normalizedData.promotions.length ||
      normalizedData.customers.length ||
      normalizedData.orders.length ||
      normalizedData.categories.length ||
      normalizedData.paymentMethods.length ||
      normalizedData.deliveryZones.length ||
      normalizedData.expenses.length ||
      normalizedData.payables.length ||
      normalizedData.receivables.length ||
      normalizedData.supportRequests.length ||
      normalizedData.riders.length ||
      normalizedData.cashRegister?.currentSession ||
      normalizedData.cashRegister?.history?.length
  );
};

const writeBackupFile = (data) => {
  const backupName = `db-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const backupPath = path.join(backupDir, backupName);
  fs.writeFileSync(backupPath, JSON.stringify(normalizeDatabase(data), null, 2));

  const backupFiles = fs
    .readdirSync(backupDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse();

  backupFiles.slice(10).forEach((file) => {
    fs.unlinkSync(path.join(backupDir, file));
  });
};

const getBackupFiles = () =>
  fs.existsSync(backupDir)
    ? fs
        .readdirSync(backupDir)
        .filter((file) => file.endsWith(".json"))
        .sort()
        .reverse()
    : [];

const ensureDatabase = () => {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
  }
};

const readDBFile = () => {
  ensureDatabase();
  return normalizeDatabase(JSON.parse(fs.readFileSync(dbPath, "utf-8")));
};

const writeDBFile = (data) => {
  const normalizedData = normalizeDatabase(data);

  if (fs.existsSync(dbPath)) {
    writeBackupFile(readDBFile());
  }

  fs.writeFileSync(dbPath, JSON.stringify(normalizedData, null, 2));
};

const updateDBFile = (mutator) => {
  const current = readDBFile();
  const draft = deepCopy(current);
  const result = mutator(draft) ?? draft;
  writeDBFile(result);
  return result;
};

const supabaseUrl =
  (process.env.SUPABASE_URL || "").trim() ||
  (process.env.VITE_SUPABASE_URL || "").trim() ||
  (process.env.SUPABASE_PROJECT_ID
    ? `https://${process.env.SUPABASE_PROJECT_ID}`.trim() + ".supabase.co"
    : "");
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const supabaseConfig = {
  url: supabaseUrl,
  hasUrl: Boolean(supabaseUrl),
  hasServiceRole: Boolean(supabaseKey)
};
const supabaseEnabled = Boolean(supabaseConfig.hasUrl && supabaseConfig.hasServiceRole);
const supabase = supabaseEnabled
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      db: { schema: process.env.SUPABASE_SCHEMA || "public" }
    })
  : null;
const strictSupabaseMode =
  supabaseEnabled && String(process.env.ALLOW_FILE_FALLBACK || "").trim().toLowerCase() !== "true";

const getSupabaseStatus = () => {
  if (supabaseEnabled) {
    return {
      enabled: true,
      mode: strictSupabaseMode ? "supabase-primary+file-mirror" : "supabase+file-fallback",
      missing: []
    };
  }

  const missing = [];
  if (!supabaseConfig.hasUrl) {
    missing.push("SUPABASE_URL");
  }
  if (!supabaseConfig.hasServiceRole) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    enabled: false,
    mode: "file-only",
    missing
  };
};

const mapSettingsRow = (row = {}) => ({
  storeName: row.store_name ?? initialData.settings.storeName,
  tagline: row.tagline ?? initialData.settings.tagline,
  bannerTitle: row.banner_title ?? initialData.settings.bannerTitle,
  bannerSubtitle: row.banner_subtitle ?? initialData.settings.bannerSubtitle,
  addressLine: row.address_line ?? initialData.settings.addressLine,
  city: row.city ?? initialData.settings.city,
  mapsUrl: row.maps_url ?? initialData.settings.mapsUrl,
  openingHoursText: row.opening_hours_text ?? initialData.settings.openingHoursText,
  whatsappNumber: row.whatsapp_number ?? initialData.settings.whatsappNumber,
  quickMessage: row.quick_message ?? initialData.settings.quickMessage,
  supportText: row.support_text ?? initialData.settings.supportText,
  deliveryFees: row.delivery_fees ?? initialData.settings.deliveryFees ?? {},
  stockLowThreshold: Number(
    row.stock_low_threshold ?? initialData.settings.stockLowThreshold ?? 5
  ),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapSettingsToRow = (settings = {}) => ({
  id: 1,
  store_name: settings.storeName || "",
  tagline: settings.tagline || "",
  banner_title: settings.bannerTitle || "",
  banner_subtitle: settings.bannerSubtitle || "",
  address_line: settings.addressLine || "",
  city: settings.city || "",
  maps_url: settings.mapsUrl || "",
  opening_hours_text: settings.openingHoursText || "",
  whatsapp_number: settings.whatsappNumber || "",
  quick_message: settings.quickMessage || "",
  support_text: settings.supportText || "",
  delivery_fees: settings.deliveryFees || {},
  stock_low_threshold: Number(settings.stockLowThreshold ?? 5),
  created_at: resolveCreatedAt(settings.createdAt),
  updated_at: resolveUpdatedAt(settings.updatedAt, settings.createdAt)
});

const mapCategoryRow = (row) => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapCategoryToRow = (category, index) => ({
  id: `category-${index + 1}-${String(category || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")}`,
  name: String(category || "").trim(),
  created_at: createTimestamp(),
  updated_at: createTimestamp()
});

const mapPaymentMethodRow = (row) => ({
  value: row.value,
  label: row.label,
  active: row.active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapPaymentMethodToRow = (method) => ({
  value: String(method.value || "").trim(),
  label: String(method.label || method.value || "").trim(),
  active: method.active ?? true,
  created_at: resolveCreatedAt(method.createdAt),
  updated_at: resolveUpdatedAt(method.updatedAt, method.createdAt)
});

const mapDeliveryZoneRow = (row) => ({
  id: row.id,
  name: row.name,
  fee: Number(row.fee ?? 0),
  active: row.active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapDeliveryZoneToRow = (zone, index) => ({
  id:
    String(zone.id || "").trim() ||
    `zone-${index + 1}-${String(zone.name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")}`,
  name: String(zone.name || "").trim(),
  fee: Number(zone.fee ?? 0),
  active: zone.active ?? true,
  created_at: resolveCreatedAt(zone.createdAt),
  updated_at: resolveUpdatedAt(zone.updatedAt, zone.createdAt)
});

const mapProductRow = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  volume: row.volume || "",
  salePrice: Number(row.sale_price ?? 0),
  purchasePrice: Number(row.purchase_price ?? 0),
  stock: Number(row.stock ?? 0),
  active: row.active ?? true,
  featured: row.featured ?? false,
  badge: row.badge || "",
  description: row.description || "",
  image: row.image || ""
});

const mapProductToRow = (product) => ({
  id: product.id,
  name: product.name,
  category: product.category,
  volume: product.volume || "",
  sale_price: Number(product.salePrice ?? product.price ?? 0),
  purchase_price: Number(product.purchasePrice ?? 0),
  stock: Number(product.stock ?? 0),
  active: product.active ?? true,
  featured: product.featured ?? false,
  badge: product.badge || "",
  description: product.description || "",
  image: product.image || "",
  created_at: resolveCreatedAt(product.createdAt),
  updated_at: resolveUpdatedAt(product.updatedAt, product.createdAt)
});

const mapPromotionRow = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  description: row.description || "",
  code: row.code || "",
  discountType: row.discount_type || "fixed",
  discountValue: Number(row.discount_value ?? 0),
  minimumOrder: Number(row.minimum_order ?? 0),
  neighborhood: row.neighborhood || "",
  active: row.active ?? true,
  highlight: row.highlight || ""
});

const mapPromotionToRow = (promo) => ({
  id: promo.id,
  type: promo.type || "daily",
  title: promo.title || "",
  description: promo.description || "",
  code: promo.code || "",
  discount_type: promo.discountType || "fixed",
  discount_value: Number(promo.discountValue ?? 0),
  minimum_order: Number(promo.minimumOrder ?? 0),
  neighborhood: promo.neighborhood || "",
  active: promo.active ?? true,
  highlight: promo.highlight || "",
  created_at: resolveCreatedAt(promo.createdAt),
  updated_at: resolveUpdatedAt(promo.updatedAt, promo.createdAt)
});

const mapCustomerRow = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  address: row.address,
  neighborhood: row.neighborhood,
  notes: row.notes || "",
  totalSpent: Number(row.total_spent ?? 0),
  orderIds: row.order_ids || [],
  lastOrderId: row.last_order_id || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapCustomerToRow = (customer) => ({
  id: customer.id,
  name: customer.name,
  phone: customer.phone,
  address: customer.address,
  neighborhood: customer.neighborhood,
  notes: customer.notes || "",
  total_spent: Number(customer.totalSpent ?? 0),
  order_ids: customer.orderIds || [],
  last_order_id: customer.lastOrderId || null,
  created_at: resolveCreatedAt(customer.createdAt),
  updated_at: resolveUpdatedAt(customer.updatedAt, customer.createdAt)
});

const mapOrderRow = (row, items = []) => ({
  id: row.id,
  number: row.number,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  channel: row.channel,
  customerId: row.customer_id || null,
  riderId: row.rider_id || null,
  customer: row.customer || {},
  items,
  paymentMethod: row.payment_method || null,
  payments: row.payments || null,
  paidTotal: row.paid_total ?? null,
  changeDue: row.change_due ?? null,
  couponCode: row.coupon_code || "",
  subtotal: Number(row.subtotal ?? 0),
  deliveryFee: Number(row.delivery_fee ?? 0),
  discount: Number(row.discount ?? 0),
  manualDiscount: row.manual_discount ?? null,
  manualDiscountPercent: row.manual_discount_percent ?? null,
  manualDiscountPercentAmount: row.manual_discount_percent_amount ?? null,
  manualSurcharge: row.manual_surcharge ?? null,
  manualSurchargePercent: row.manual_surcharge_percent ?? null,
  manualSurchargePercentAmount: row.manual_surcharge_percent_amount ?? null,
  promoDiscount: row.promo_discount ?? null,
  total: Number(row.total ?? 0),
  status: row.status,
  statusTimeline: row.status_timeline || []
});

const mapOrderToRow = (order) => ({
  id: order.id,
  number: order.number,
  created_at: resolveCreatedAt(order.createdAt),
  updated_at: resolveUpdatedAt(order.updatedAt, order.createdAt),
  channel: order.channel || "delivery",
  customer_id: order.customerId || null,
  rider_id: order.riderId || null,
  customer: order.customer || {},
  payment_method: order.paymentMethod || null,
  payments: order.payments || null,
  paid_total: order.paidTotal ?? null,
  change_due: order.changeDue ?? null,
  coupon_code: order.couponCode || "",
  subtotal: Number(order.subtotal ?? 0),
  delivery_fee: Number(order.deliveryFee ?? 0),
  discount: Number(order.discount ?? 0),
  manual_discount: order.manualDiscount ?? null,
  manual_discount_percent: order.manualDiscountPercent ?? null,
  manual_discount_percent_amount: order.manualDiscountPercentAmount ?? null,
  manual_surcharge: order.manualSurcharge ?? null,
  manual_surcharge_percent: order.manualSurchargePercent ?? null,
  manual_surcharge_percent_amount: order.manualSurchargePercentAmount ?? null,
  promo_discount: order.promoDiscount ?? null,
  total: Number(order.total ?? 0),
  status: order.status || "received",
  status_timeline: order.statusTimeline || []
});

const mapOrderItemRow = (row) => ({
  productId: row.product_id || null,
  name: row.name,
  volume: row.volume || "",
  unitPrice: Number(row.unit_price ?? 0),
  quantity: Number(row.quantity ?? 0),
  lineTotal: Number(row.line_total ?? 0)
});

const mapOrderItemToRow = (orderId, item) => ({
  order_id: orderId,
  product_id: item.productId || null,
  name: item.name,
  volume: item.volume || "",
  unit_price: Number(item.unitPrice ?? 0),
  quantity: Number(item.quantity ?? 0),
  line_total: Number(item.lineTotal ?? 0)
});

const mapExpenseRow = (row) => ({
  id: row.id,
  title: row.title,
  category: row.category || "",
  amount: Number(row.amount ?? 0),
  date: row.date,
  note: row.note || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapExpenseToRow = (expense) => ({
  id: expense.id,
  title: expense.title,
  category: expense.category || "",
  amount: Number(expense.amount ?? 0),
  date: expense.date || expense.createdAt || createTimestamp(),
  note: expense.note || "",
  created_at: resolveCreatedAt(expense.createdAt),
  updated_at: resolveUpdatedAt(expense.updatedAt, expense.createdAt)
});

const mapPayableRow = (row) => ({
  id: row.id,
  title: row.title,
  category: row.category || "",
  amount: Number(row.amount ?? 0),
  dueDate: row.due_date,
  note: row.note || "",
  status: row.status || "pending",
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapPayableToRow = (entry) => ({
  id: entry.id,
  title: entry.title,
  category: entry.category || "",
  amount: Number(entry.amount ?? 0),
  due_date: entry.dueDate || entry.createdAt || createTimestamp(),
  note: entry.note || "",
  status: entry.status || "pending",
  created_at: resolveCreatedAt(entry.createdAt),
  updated_at: resolveUpdatedAt(entry.updatedAt, entry.createdAt)
});

const mapReceivableRow = (row) => ({
  id: row.id,
  title: row.title,
  customerName: row.customer_name || "",
  customerPhone: row.customer_phone || "",
  category: row.category || "",
  amount: Number(row.amount ?? 0),
  dueDate: row.due_date,
  note: row.note || "",
  status: row.status || "pending",
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapReceivableToRow = (entry) => ({
  id: entry.id,
  title: entry.title,
  customer_name: entry.customerName || "",
  customer_phone: entry.customerPhone || "",
  category: entry.category || "",
  amount: Number(entry.amount ?? 0),
  due_date: entry.dueDate || entry.createdAt || createTimestamp(),
  note: entry.note || "",
  status: entry.status || "pending",
  created_at: resolveCreatedAt(entry.createdAt),
  updated_at: resolveUpdatedAt(entry.updatedAt, entry.createdAt)
});

const mapSupportRequestRow = (row) => ({
  id: row.id,
  customerName: row.customer_name || "",
  phone: row.phone || "",
  source: row.source || "whatsapp",
  status: row.status || "pending",
  note: row.note || "",
  requestedAt: row.requested_at || row.created_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapSupportRequestToRow = (entry) => ({
  id: entry.id,
  customer_name: entry.customerName || "",
  phone: entry.phone || "",
  source: entry.source || "whatsapp",
  status: entry.status || "pending",
  note: entry.note || "",
  requested_at: entry.requestedAt || entry.createdAt || createTimestamp(),
  created_at: resolveCreatedAt(entry.createdAt || entry.requestedAt),
  updated_at: resolveUpdatedAt(entry.updatedAt, entry.createdAt || entry.requestedAt)
});

const mapRiderRow = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone || "",
  active: row.active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapRiderToRow = (rider) => ({
  id: rider.id,
  name: rider.name,
  phone: rider.phone || "",
  active: rider.active ?? true,
  created_at: resolveCreatedAt(rider.createdAt),
  updated_at: resolveUpdatedAt(rider.updatedAt, rider.createdAt)
});

const mapCashSessionRow = (row) => ({
  id: row.id,
  openedAt: row.opened_at,
  closedAt: row.closed_at,
  openingBalance: Number(row.opening_balance ?? 0),
  expectedBalance: Number(row.expected_balance ?? 0),
  countedBalance:
    row.counted_balance === null || row.counted_balance === undefined
      ? null
      : Number(row.counted_balance),
  difference:
    row.difference === null || row.difference === undefined ? null : Number(row.difference),
  note: row.note || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapCashSessionToRow = (session) => ({
  id: session.id,
  opened_at: session.openedAt,
  closed_at: session.closedAt,
  opening_balance: Number(session.openingBalance ?? 0),
  expected_balance: Number(session.expectedBalance ?? 0),
  counted_balance:
    session.countedBalance === null || session.countedBalance === undefined
      ? null
      : Number(session.countedBalance),
  difference:
    session.difference === null || session.difference === undefined
      ? null
      : Number(session.difference),
  note: session.note || "",
  created_at: resolveCreatedAt(session.createdAt || session.openedAt),
  updated_at: resolveUpdatedAt(session.updatedAt || session.closedAt, session.createdAt || session.openedAt)
});

const mapCashMovementRow = (row) => ({
  id: row.id,
  sessionId: row.session_id,
  type: row.type,
  amount: Number(row.amount ?? 0),
  note: row.note || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapCashMovementToRow = (movement, sessionId) => ({
  id: movement.id,
  session_id: sessionId,
  type: movement.type || "",
  amount: Number(movement.amount ?? 0),
  note: movement.note || "",
  created_at: resolveCreatedAt(movement.createdAt),
  updated_at: resolveUpdatedAt(movement.updatedAt, movement.createdAt)
});

const ensureSettingsRow = async () => {
  if (!supabase) {
    throw new Error("Supabase nao configurado para escrita.");
  }

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    const { error: insertError } = await supabase
      .from("settings")
      .insert(mapSettingsToRow(initialData.settings));
    if (insertError) {
      throw new Error(insertError.message);
    }
    return mapSettingsRow(mapSettingsToRow(initialData.settings));
  }

  return mapSettingsRow(data);
};

const readDBSupabase = async () => {
  if (!supabase) {
    throw new Error("Supabase nao configurado para leitura.");
  }

  const [
    settingsRes,
    productsRes,
    promotionsRes,
    customersRes,
    ordersRes,
    orderItemsRes,
    expensesRes,
    ridersRes,
    categoriesRes,
    paymentMethodsRes,
    deliveryZonesRes,
    payablesRes,
    receivablesRes,
    cashSessionsRes,
    cashMovementsRes,
    supportRequestsRes
  ] = await Promise.all([
    ensureSettingsRow().then((data) => ({ data })),
    supabase.from("products").select("*"),
    supabase.from("promotions").select("*"),
    supabase.from("customers").select("*"),
    supabase.from("orders").select("*"),
    supabase.from("order_items").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("riders").select("*"),
    supabase.from("categories").select("*"),
    supabase.from("payment_methods").select("*"),
    supabase.from("delivery_zones").select("*"),
    supabase.from("payables").select("*"),
    supabase.from("receivables").select("*"),
    supabase.from("cash_sessions").select("*"),
    supabase.from("cash_movements").select("*"),
    supabase.from("support_requests").select("*")
  ]);

  const errors = [
    productsRes.error,
    promotionsRes.error,
    customersRes.error,
    ordersRes.error,
    orderItemsRes.error,
    expensesRes.error,
    ridersRes.error,
    categoriesRes.error,
    paymentMethodsRes.error,
    deliveryZonesRes.error,
    payablesRes.error,
    receivablesRes.error,
    cashSessionsRes.error,
    cashMovementsRes.error,
    supportRequestsRes.error
  ].filter(Boolean);

  if (errors.length) {
    throw new Error(errors[0].message);
  }

  const orderItemsByOrder = new Map();
  (orderItemsRes.data || []).forEach((item) => {
    const list = orderItemsByOrder.get(item.order_id) || [];
    list.push(mapOrderItemRow(item));
    orderItemsByOrder.set(item.order_id, list);
  });

  const cashMovementsBySession = new Map();
  (cashMovementsRes.data || []).forEach((movement) => {
    const list = cashMovementsBySession.get(movement.session_id) || [];
    list.push(mapCashMovementRow(movement));
    cashMovementsBySession.set(movement.session_id, list);
  });

  const cashSessions = (cashSessionsRes.data || []).map((session) => ({
    ...mapCashSessionRow(session),
    movements: cashMovementsBySession.get(session.id) || []
  }));

  const currentSession = cashSessions.find((session) => !session.closedAt) || null;
  const historySessions = cashSessions.filter((session) => session.closedAt);

  const db = {
    settings: settingsRes.data,
    categories: (categoriesRes.data || []).map((row) => mapCategoryRow(row).name),
    paymentMethods: (paymentMethodsRes.data || []).map(mapPaymentMethodRow),
    deliveryZones: (deliveryZonesRes.data || []).map(mapDeliveryZoneRow),
    products: (productsRes.data || []).map(mapProductRow),
    promotions: (promotionsRes.data || []).map(mapPromotionRow),
    customers: (customersRes.data || []).map(mapCustomerRow),
    orders: (ordersRes.data || []).map((order) =>
      mapOrderRow(order, orderItemsByOrder.get(order.id) || [])
    ),
    expenses: (expensesRes.data || []).map(mapExpenseRow),
    payables: (payablesRes.data || []).map(mapPayableRow),
    receivables: (receivablesRes.data || []).map(mapReceivableRow),
    supportRequests: (supportRequestsRes.data || []).map(mapSupportRequestRow),
    riders: (ridersRes.data || []).map(mapRiderRow),
    cashRegister: {
      currentSession,
      history: historySessions
    }
  };

  return normalizeDatabase(db);
};

const fetchSupabaseRows = async (table, configure) => {
  if (!supabase) {
    throw new Error("Supabase nao configurado para leitura.");
  }

  let query = supabase.from(table).select("*");
  query = typeof configure === "function" ? configure(query) : query;
  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
};

const mapOrdersWithItems = (ordersRows = [], orderItemsRows = []) => {
  const orderItemsByOrder = new Map();

  orderItemsRows.forEach((item) => {
    const list = orderItemsByOrder.get(item.order_id) || [];
    list.push(mapOrderItemRow(item));
    orderItemsByOrder.set(item.order_id, list);
  });

  return ordersRows.map((order) => mapOrderRow(order, orderItemsByOrder.get(order.id) || []));
};

const readStoreSupabase = async () => {
  const [settings, productsRows, promotionsRows, deliveryZonesRows] = await Promise.all([
    ensureSettingsRow(),
    fetchSupabaseRows("products", (query) =>
      query
        .eq("active", true)
        .gt("stock", 0)
        .order("featured", { ascending: false })
        .order("sale_price", { ascending: true })
    ),
    fetchSupabaseRows("promotions", (query) =>
      query.eq("active", true).order("updated_at", { ascending: false })
    ),
    fetchSupabaseRows("delivery_zones", (query) => query.order("name", { ascending: true }))
  ]);

  const deliveryZones = deliveryZonesRows.map(mapDeliveryZoneRow);
  const products = productsRows.map(mapProductRow);
  const promotions = promotionsRows.map(mapPromotionRow);
  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))];

  return normalizeDatabase({
    settings: {
      ...settings,
      deliveryFees: deliveryZones.length
        ? Object.fromEntries(
            deliveryZones.filter((zone) => zone.active).map((zone) => [zone.name, zone.fee])
          )
        : settings.deliveryFees || {}
    },
    deliveryZones,
    categories,
    products,
    promotions
  });
};

const readOrderByIdSupabase = async (orderId) => {
  const ordersRows = await fetchSupabaseRows("orders", (query) => query.eq("id", orderId).limit(1));
  const order = ordersRows[0];

  if (!order) {
    return null;
  }

  const orderItemsRows = await fetchSupabaseRows("order_items", (query) =>
    query.eq("order_id", orderId)
  );

  return normalizeOrder(mapOrderRow(order, orderItemsRows.map(mapOrderItemRow)));
};

const readOrdersListSupabase = async (limit = 50) => {
  const ordersRows = await fetchSupabaseRows("orders", (query) =>
    query.order("created_at", { ascending: false }).limit(limit)
  );

  if (!ordersRows.length) {
    return [];
  }

  const orderItemsRows = await fetchSupabaseRows("order_items", (query) =>
    query.in("order_id", ordersRows.map((order) => order.id))
  );

  return mapOrdersWithItems(ordersRows, orderItemsRows).map(normalizeOrder);
};

const readProductsListSupabase = async (limit = 50) => {
  const productsRows = await fetchSupabaseRows("products", (query) =>
    query.order("name", { ascending: true }).limit(limit)
  );
  return productsRows.map((row) => normalizeProduct(mapProductRow(row)));
};

const readPromotionsListSupabase = async (limit = 50) => {
  const promotionsRows = await fetchSupabaseRows("promotions", (query) =>
    query.order("updated_at", { ascending: false }).limit(limit)
  );
  return promotionsRows.map((row) => normalizePromotion(mapPromotionRow(row)));
};

const readCustomersListSupabase = async (limit = 50) => {
  const customerRows = await fetchSupabaseRows("customers", (query) =>
    query.order("total_spent", { ascending: false }).limit(limit)
  );
  const customers = customerRows.map((row) => normalizeCustomer(mapCustomerRow(row)));
  const orderIds = [...new Set(customers.flatMap((customer) => customer.orderIds || []).filter(Boolean))];

  if (!orderIds.length) {
    return customers.map((customer) => ({ ...customer, previousOrders: [] }));
  }

  const [ordersRows, orderItemsRows] = await Promise.all([
    fetchSupabaseRows("orders", (query) => query.in("id", orderIds)),
    fetchSupabaseRows("order_items", (query) => query.in("order_id", orderIds))
  ]);

  const ordersById = new Map(
    mapOrdersWithItems(ordersRows, orderItemsRows).map((order) => [order.id, normalizeOrder(order)])
  );

  return customers.map((customer) => ({
    ...customer,
    previousOrders: (customer.orderIds || []).map((orderId) => ordersById.get(orderId)).filter(Boolean)
  }));
};

const readCustomerLookupSupabase = async (phone) => {
  const customerRows = await fetchSupabaseRows("customers", (query) => query.eq("phone", phone).limit(1));
  const customerRow = customerRows[0];

  if (!customerRow) {
    return { customer: null, lastOrder: null };
  }

  const customer = normalizeCustomer(mapCustomerRow(customerRow));
  const lastOrder = customer.lastOrderId ? await readOrderByIdSupabase(customer.lastOrderId) : null;

  return {
    customer,
    lastOrder
  };
};

const readCategoriesSupabase = async () => {
  const rows = await fetchSupabaseRows("categories", (query) => query.order("name", { ascending: true }));
  return rows.map((row) => mapCategoryRow(row).name).filter(Boolean);
};

const deleteAll = async (table, column, sentinel) => {
  if (!supabase) {
    throw new Error("Supabase nao configurado para escrita.");
  }

  const { error } = await supabase.from(table).delete().neq(column, sentinel);
  if (error) {
    throw new Error(error.message);
  }
};

const syncTableById = async (table, rows, idColumn = "id") => {
  if (!supabase) {
    throw new Error("Supabase nao configurado para escrita.");
  }

  const normalizedRows = Array.isArray(rows) ? rows : [];
  const desiredIds = normalizedRows.map((row) => row[idColumn]).filter(Boolean);

  const { data: existingRows, error: fetchError } = await supabase.from(table).select(idColumn);
  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const existingIds = (existingRows || []).map((row) => row[idColumn]).filter(Boolean);
  const idsToDelete = existingIds.filter((id) => !desiredIds.includes(id));

  if (idsToDelete.length) {
    const { error: deleteError } = await supabase.from(table).delete().in(idColumn, idsToDelete);
    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  if (normalizedRows.length) {
    const { error: upsertError } = await supabase
      .from(table)
      .upsert(normalizedRows, { onConflict: idColumn });
    if (upsertError) {
      throw new Error(upsertError.message);
    }
  }
};

const writeDBSupabase = async (data) => {
  if (!supabase) {
    throw new Error("Supabase nao configurado para escrita.");
  }

  const payload = normalizeDatabase(data);
  const settingsRow = mapSettingsToRow(payload.settings);
  const productsRows = (payload.products || []).map(mapProductToRow);
  const promotionsRows = (payload.promotions || []).map(mapPromotionToRow);
  const customersRows = (payload.customers || []).map(mapCustomerToRow);
  const ordersRows = (payload.orders || []).map(mapOrderToRow);
  const expensesRows = (payload.expenses || []).map(mapExpenseToRow);
  const categoriesRows = (payload.categories || []).map(mapCategoryToRow);
  const paymentMethodsRows = (payload.paymentMethods || []).map(mapPaymentMethodToRow);
  const deliveryZonesRows = (
    payload.deliveryZones?.length
      ? payload.deliveryZones
      : Object.entries(payload.settings?.deliveryFees || {}).map(([name, fee]) => ({ name, fee }))
  ).map(mapDeliveryZoneToRow);
  const payablesRows = (payload.payables || []).map(mapPayableToRow);
  const receivablesRows = (payload.receivables || []).map(mapReceivableToRow);
  const supportRequestsRows = (payload.supportRequests || []).map(mapSupportRequestToRow);
  const ridersRows = (payload.riders || []).map(mapRiderToRow);
  const cashSessions = [
    ...(payload.cashRegister?.currentSession ? [payload.cashRegister.currentSession] : []),
    ...(payload.cashRegister?.history || [])
  ];
  const cashSessionsRows = cashSessions.map(mapCashSessionToRow);
  const cashMovementsRows = cashSessions.flatMap((session) =>
    (session.movements || []).map((movement) => mapCashMovementToRow(movement, session.id))
  );
  const orderItemsRows = (payload.orders || []).flatMap((order) =>
    (order.items || []).map((item) => mapOrderItemToRow(order.id, item))
  );

  const { error: settingsError } = await supabase
    .from("settings")
    .upsert(settingsRow, { onConflict: "id" });

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  await syncTableById("products", productsRows);
  await syncTableById("promotions", promotionsRows);
  await syncTableById("customers", customersRows);
  await syncTableById("categories", categoriesRows);
  await syncTableById("payment_methods", paymentMethodsRows, "value");
  await syncTableById("delivery_zones", deliveryZonesRows);
  await syncTableById("expenses", expensesRows);
  await syncTableById("payables", payablesRows);
  await syncTableById("receivables", receivablesRows);
  await syncTableById("support_requests", supportRequestsRows);
  await syncTableById("riders", ridersRows);
  await syncTableById("cash_sessions", cashSessionsRows);
  await syncTableById("cash_movements", cashMovementsRows);
  await syncTableById("orders", ordersRows);

  if (ordersRows.length) {
    const orderIds = ordersRows.map((row) => row.id);
    const { error: deleteOrderItemsError } = await supabase
      .from("order_items")
      .delete()
      .in("order_id", orderIds);
    if (deleteOrderItemsError) {
      throw new Error(deleteOrderItemsError.message);
    }
  } else {
    await deleteAll("order_items", "order_id", "__never__");
  }

  if (orderItemsRows.length) {
    const { error } = await supabase.from("order_items").insert(orderItemsRows);
    if (error) throw new Error(error.message);
  }
};

const updateDBSupabase = async (mutator) => {
  const current = await readDBSupabase();
  const draft = deepCopy(current);
  const result = mutator(draft) ?? draft;
  await writeDBSupabase(result);
  return result;
};

const logSupabaseConfigurationWarning = () => {
  if (supabaseEnabled) {
    return;
  }

  const status = getSupabaseStatus();
  console.warn(
    `[storage] Supabase indisponivel. Usando somente arquivo local. Variaveis ausentes: ${status.missing.join(", ")}`
  );
};

let bootstrapPromise = null;
let lastStorageSyncError = "";
let storageRevision = 0;
let readCache = {
  revision: 0,
  createdAt: 0,
  data: null
};
const READ_CACHE_TTL_MS = Math.max(
  Number(process.env.READ_DB_CACHE_TTL_MS || 1500),
  0
);

const clearReadCache = () => {
  readCache = {
    revision: storageRevision,
    createdAt: 0,
    data: null
  };
};

const primeReadCache = (data) => {
  storageRevision += 1;
  readCache = {
    revision: storageRevision,
    createdAt: Date.now(),
    data: deepCopy(data)
  };
};

export const bootstrapStorage = async () => {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    ensureDatabase();

    if (!supabaseEnabled) {
      logSupabaseConfigurationWarning();
      primeReadCache(readDBFile());
      return { synced: false, mode: "file-only" };
    }

    const [supabaseResult, fileResult] = await Promise.allSettled([
      readDBSupabase(),
      Promise.resolve(readDBFile())
    ]);

    const supabaseData = supabaseResult.status === "fulfilled" ? supabaseResult.value : null;
    const fileData = fileResult.status === "fulfilled" ? fileResult.value : null;
    const supabaseHasData = hasMeaningfulData(supabaseData);
    const fileHasData = hasMeaningfulData(fileData);

    if (!supabaseData && !fileData) {
      throw supabaseResult.status === "rejected"
        ? supabaseResult.reason
        : fileResult.status === "rejected"
          ? fileResult.reason
          : new Error("Nao foi possivel inicializar o armazenamento.");
    }

    if (supabaseHasData) {
      const canonicalData = mergeFallbackData(supabaseData, fileData);
      writeDBFile(canonicalData);
      primeReadCache(canonicalData);
      return { synced: false, mode: getSupabaseStatus().mode };
    }

    const bootstrapData = fileHasData ? fileData : initialData;
    const mergedBootstrapData = mergeFallbackData(bootstrapData, initialData);
    try {
      await writeDBSupabase(mergedBootstrapData);
    } catch (error) {
      lastStorageSyncError = error?.message || String(error);
      console.error("[storage-bootstrap-sync-error]", error?.message || error);

      if (strictSupabaseMode) {
        throw error;
      }

      writeDBFile(mergedBootstrapData);
      primeReadCache(mergedBootstrapData);
      return { synced: false, mode: "file-only-fallback" };
    }

    lastStorageSyncError = "";
    writeDBFile(mergedBootstrapData);
    primeReadCache(mergedBootstrapData);
    return { synced: true, mode: getSupabaseStatus().mode };
  })().catch((error) => {
    bootstrapPromise = null;
    throw error;
  });

  return bootstrapPromise;
};

export const readDB = async () => {
  await bootstrapStorage();

  const cacheAge = Date.now() - readCache.createdAt;
  if (readCache.data && readCache.revision === storageRevision && cacheAge <= READ_CACHE_TTL_MS) {
    return deepCopy(readCache.data);
  }

  if (!supabaseEnabled) {
    const fileData = readDBFile();
    readCache = {
      revision: storageRevision,
      createdAt: Date.now(),
      data: deepCopy(fileData)
    };
    return fileData;
  }

  const [supabaseResult, fileResult] = await Promise.allSettled([
    readDBSupabase(),
    Promise.resolve(readDBFile())
  ]);

  const supabaseData = supabaseResult.status === "fulfilled" ? supabaseResult.value : null;
  const fileData = fileResult.status === "fulfilled" ? fileResult.value : null;

  if (supabaseData) {
    lastStorageSyncError = "";
    const mergedData = mergeFallbackData(supabaseData, fileData);
    readCache = {
      revision: storageRevision,
      createdAt: Date.now(),
      data: deepCopy(mergedData)
    };
    return mergedData;
  }

  const supabaseError = supabaseResult.status === "rejected" ? supabaseResult.reason : null;

  if (strictSupabaseMode) {
    lastStorageSyncError = supabaseError?.message || "Falha ao carregar dados do Supabase.";
    throw supabaseError || new Error("Falha ao carregar dados do Supabase.");
  }

  const bestData = choosePreferredDatabase(fileData, initialData);
  if (bestData) {
    const mergedData = mergeFallbackData(bestData, initialData);
    readCache = {
      revision: storageRevision,
      createdAt: Date.now(),
      data: deepCopy(mergedData)
    };
    return mergedData;
  }

  const fileError = fileResult.status === "rejected" ? fileResult.reason : null;
  throw supabaseError || fileError || new Error("Nao foi possivel carregar o banco.");
};

let writeQueue = Promise.resolve();

const queueStorageWrite = async (handler) => {
  const nextWrite = writeQueue.catch(() => undefined).then(handler);
  writeQueue = nextWrite.catch(() => undefined);
  return nextWrite;
};

const finalizeStorageWrite = (result) => {
  lastStorageSyncError = "";
  writeDBFile(result);
  primeReadCache(result);
  return result;
};

const runProductUpsertRpc = async (product) => {
  if (!supabase) {
    throw new Error("Supabase nao configurado para escrita.");
  }

  const payload = {
    id: product.id,
    name: product.name,
    category: product.category,
    volume: product.volume || "",
    salePrice: Number(product.salePrice ?? product.price ?? 0),
    purchasePrice: Number(product.purchasePrice ?? 0),
    stock: Number(product.stock ?? 0),
    active: product.active ?? true,
    featured: product.featured ?? false,
    badge: product.badge || "",
    description: product.description || "",
    image: product.image || ""
  };

  const { error } = await supabase.rpc("admin_upsert_product", { payload });
  if (error) {
    throw new Error(error.message);
  }
};

const runProductDeleteRpc = async (productId) => {
  if (!supabase) {
    throw new Error("Supabase nao configurado para escrita.");
  }

  const { error } = await supabase.rpc("admin_delete_product", { product_id: productId });
  if (error) {
    throw new Error(error.message);
  }
};

const runProductToggleRpc = async (productId) => {
  if (!supabase) {
    throw new Error("Supabase nao configurado para escrita.");
  }

  const { error } = await supabase.rpc("admin_toggle_product", { product_id: productId });
  if (error) {
    throw new Error(error.message);
  }
};

export const updateDB = async (mutator) => {
  return queueStorageWrite(async () => {
    await bootstrapStorage();
    clearReadCache();

    if (!supabaseEnabled) {
      const result = updateDBFile(mutator);
      primeReadCache(result);
      return result;
    }

    const current = await readDB();
    const draft = deepCopy(current);
    const result = normalizeDatabase(mutator(draft) ?? draft);

    try {
      await writeDBSupabase(result);
      finalizeStorageWrite(result);
    } catch (error) {
      lastStorageSyncError = error?.message || String(error);
      console.error("[storage-sync-error]", lastStorageSyncError);
      throw error;
    }

    return result;
  });
};

export const updateProductsDB = async (mutator, options = {}) =>
  queueStorageWrite(async () => {
    await bootstrapStorage();
    clearReadCache();

    if (!supabaseEnabled) {
      const result = updateDBFile(mutator);
      primeReadCache(result);
      return result;
    }

    const current = await readDB();
    const draft = deepCopy(current);
    const result = normalizeDatabase(mutator(draft) ?? draft);

    try {
      const resolvedProduct =
        typeof options.resolveProduct === "function" ? options.resolveProduct(result) : options.product;

      if (options.mode === "delete" && options.productId) {
        await runProductDeleteRpc(options.productId);
      } else if (options.mode === "toggle" && options.productId) {
        await runProductToggleRpc(options.productId);
      } else if (resolvedProduct) {
        await runProductUpsertRpc(resolvedProduct);
      } else {
        throw new Error("Mutacao de produto invalida.");
      }

      finalizeStorageWrite(result);
    } catch (error) {
      lastStorageSyncError = error?.message || String(error);
      console.error("[product-storage-sync-error]", lastStorageSyncError);
      throw error;
    }

    return result;
  });

export const createId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const resetDB = async () => {
  if (process.env.ALLOW_DB_RESET !== "true") {
    throw new Error("Reset bloqueado. Defina ALLOW_DB_RESET=true para executar.");
  }

  if (supabaseEnabled) {
    await writeDBSupabase(initialData);
  }
  writeDBFile(initialData);
};

export const readStoreData = async () => {
  await bootstrapStorage();

  if (!supabaseEnabled) {
    return getStoreFileData();
  }

  try {
    return await readStoreSupabase();
  } catch (error) {
    if (strictSupabaseMode) {
      throw error;
    }

    return getStoreFileData();
  }
};

const getStoreFileData = () =>
  readDB().then((db) =>
    normalizeDatabase({
      settings: db.settings,
      deliveryZones: db.deliveryZones || [],
      categories: db.categories || [],
      products: db.products || [],
      promotions: db.promotions || []
    })
  );

export const readOrderById = async (orderId) => {
  await bootstrapStorage();

  if (!supabaseEnabled) {
    const db = await readDB();
    return db.orders.find((entry) => entry.id === orderId) || null;
  }

  try {
    return await readOrderByIdSupabase(orderId);
  } catch (error) {
    if (strictSupabaseMode) {
      throw error;
    }

    const db = await readDB();
    return db.orders.find((entry) => entry.id === orderId) || null;
  }
};

export const readOrdersList = async (limit = 50) => {
  await bootstrapStorage();

  if (!supabaseEnabled) {
    const db = await readDB();
    return [...db.orders]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, limit);
  }

  try {
    return await readOrdersListSupabase(limit);
  } catch (error) {
    if (strictSupabaseMode) {
      throw error;
    }

    const db = await readDB();
    return [...db.orders]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, limit);
  }
};

export const readProductsList = async (limit = 50) => {
  await bootstrapStorage();

  if (!supabaseEnabled) {
    const db = await readDB();
    return [...db.products]
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, limit);
  }

  try {
    return await readProductsListSupabase(limit);
  } catch (error) {
    if (strictSupabaseMode) {
      throw error;
    }

    const db = await readDB();
    return [...db.products]
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, limit);
  }
};

export const readPromotionsList = async (limit = 50) => {
  await bootstrapStorage();

  if (!supabaseEnabled) {
    const db = await readDB();
    return [...db.promotions].slice(0, limit);
  }

  try {
    return await readPromotionsListSupabase(limit);
  } catch (error) {
    if (strictSupabaseMode) {
      throw error;
    }

    const db = await readDB();
    return [...db.promotions].slice(0, limit);
  }
};

export const readCustomersList = async (limit = 50) => {
  await bootstrapStorage();

  if (!supabaseEnabled) {
    const db = await readDB();
    const ordersById = new Map((db.orders || []).map((order) => [order.id, order]));
    return db.customers
      .map((customer) => ({
        ...customer,
        previousOrders: (customer.orderIds || []).map((orderId) => ordersById.get(orderId)).filter(Boolean)
      }))
      .sort((left, right) => right.totalSpent - left.totalSpent)
      .slice(0, limit);
  }

  try {
    return await readCustomersListSupabase(limit);
  } catch (error) {
    if (strictSupabaseMode) {
      throw error;
    }

    const db = await readDB();
    const ordersById = new Map((db.orders || []).map((order) => [order.id, order]));
    return db.customers
      .map((customer) => ({
        ...customer,
        previousOrders: (customer.orderIds || []).map((orderId) => ordersById.get(orderId)).filter(Boolean)
      }))
      .sort((left, right) => right.totalSpent - left.totalSpent)
      .slice(0, limit);
  }
};

export const readCustomerLookup = async (phone) => {
  await bootstrapStorage();

  if (!supabaseEnabled) {
    const db = await readDB();
    const customer = db.customers.find((entry) => entry.phone === phone) || null;
    const lastOrder = customer?.lastOrderId
      ? db.orders.find((order) => order.id === customer.lastOrderId) || null
      : null;

    return { customer, lastOrder };
  }

  try {
    return await readCustomerLookupSupabase(phone);
  } catch (error) {
    if (strictSupabaseMode) {
      throw error;
    }

    const db = await readDB();
    const customer = db.customers.find((entry) => entry.phone === phone) || null;
    const lastOrder = customer?.lastOrderId
      ? db.orders.find((order) => order.id === customer.lastOrderId) || null
      : null;

    return { customer, lastOrder };
  }
};

export const readCategoriesList = async () => {
  await bootstrapStorage();

  if (!supabaseEnabled) {
    const db = await readDB();
    return getCatalogCategoriesFromDb(db);
  }

  try {
    const categories = await readCategoriesSupabase();
    return categories.length ? categories : getCatalogCategoriesFromDb(await readDB());
  } catch (error) {
    if (strictSupabaseMode) {
      throw error;
    }

    const db = await readDB();
    return getCatalogCategoriesFromDb(db);
  }
};

const getCatalogCategoriesFromDb = (db) =>
  [...new Set([...(db.categories || []), ...((db.products || []).map((product) => product.category))])]
    .map((category) => String(category || "").trim())
    .filter(Boolean);

export const getDataDir = () => resolvedDataDir;
export const getStorageRevision = () => storageRevision;
export const getStorageMeta = () => ({
  supabaseStatus: getSupabaseStatus().enabled ? "enabled" : "disabled",
  mode: getSupabaseStatus().mode,
  strictSupabaseMode,
  dataDir: resolvedDataDir,
  dbPath,
  backupDir,
  supabaseEnabled,
  missingVariables: getSupabaseStatus().missing,
  lastStorageSyncError,
  storageRevision,
  localMirrorOk: fs.existsSync(dbPath),
  backupCount: getBackupFiles().length,
  latestBackup: getBackupFiles()[0] || null
});
