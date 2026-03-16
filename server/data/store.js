import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { initialData } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const dataDir = process.env.DATA_DIR || process.env.APP_DATA_DIR || defaultDataDir;
const resolvedDataDir = path.resolve(dataDir);

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDir(resolvedDataDir);

const dbPath = path.join(resolvedDataDir, "db.json");

const deepCopy = (value) => JSON.parse(JSON.stringify(value));
const normalizeMoney = (value) => Number(Number(value || 0).toFixed(2));
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
const normalizeRider = (rider) => ({
  ...rider,
  active: rider?.active ?? true
});
const normalizeDatabase = (data) => ({
  ...data,
  expenses: Array.isArray(data.expenses) ? data.expenses.map(normalizeExpense) : [],
  riders: Array.isArray(data.riders) ? data.riders.map(normalizeRider) : [],
  products: Array.isArray(data.products) ? data.products.map(normalizeProduct) : []
});

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
  fs.writeFileSync(dbPath, JSON.stringify(normalizeDatabase(data), null, 2));
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
  (process.env.SUPABASE_PROJECT_ID
    ? `https://${process.env.SUPABASE_PROJECT_ID}`.trim() + ".supabase.co"
    : "");
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const useSupabase = Boolean(supabaseUrl && supabaseKey);
const supabase = useSupabase
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      db: { schema: process.env.SUPABASE_SCHEMA || "public" }
    })
  : null;

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
  deliveryFees: row.delivery_fees ?? initialData.settings.deliveryFees ?? {}
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
  delivery_fees: settings.deliveryFees || {}
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
  created_at: product.createdAt,
  updated_at: product.updatedAt
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
  created_at: promo.createdAt,
  updated_at: promo.updatedAt
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
  created_at: customer.createdAt,
  updated_at: customer.updatedAt
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
  created_at: order.createdAt,
  updated_at: order.updatedAt,
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
  date: expense.date || expense.createdAt,
  note: expense.note || "",
  created_at: expense.createdAt,
  updated_at: expense.updatedAt
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
  created_at: rider.createdAt,
  updated_at: rider.updatedAt
});

const ensureSettingsRow = async () => {
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
  const [
    settingsRes,
    productsRes,
    promotionsRes,
    customersRes,
    ordersRes,
    orderItemsRes,
    expensesRes,
    ridersRes
  ] = await Promise.all([
    ensureSettingsRow().then((data) => ({ data })),
    supabase.from("products").select("*"),
    supabase.from("promotions").select("*"),
    supabase.from("customers").select("*"),
    supabase.from("orders").select("*"),
    supabase.from("order_items").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("riders").select("*")
  ]);

  const errors = [
    productsRes.error,
    promotionsRes.error,
    customersRes.error,
    ordersRes.error,
    orderItemsRes.error,
    expensesRes.error,
    ridersRes.error
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

  const db = {
    settings: settingsRes.data,
    products: (productsRes.data || []).map(mapProductRow),
    promotions: (promotionsRes.data || []).map(mapPromotionRow),
    customers: (customersRes.data || []).map(mapCustomerRow),
    orders: (ordersRes.data || []).map((order) =>
      mapOrderRow(order, orderItemsByOrder.get(order.id) || [])
    ),
    expenses: (expensesRes.data || []).map(mapExpenseRow),
    riders: (ridersRes.data || []).map(mapRiderRow)
  };

  return normalizeDatabase(db);
};

const deleteAll = async (table, column, sentinel) => {
  const { error } = await supabase.from(table).delete().neq(column, sentinel);
  if (error) {
    throw new Error(error.message);
  }
};

const writeDBSupabase = async (data) => {
  const payload = normalizeDatabase(data);
  const settingsRow = mapSettingsToRow(payload.settings);
  const productsRows = (payload.products || []).map(mapProductToRow);
  const promotionsRows = (payload.promotions || []).map(mapPromotionToRow);
  const customersRows = (payload.customers || []).map(mapCustomerToRow);
  const ordersRows = (payload.orders || []).map(mapOrderToRow);
  const expensesRows = (payload.expenses || []).map(mapExpenseToRow);
  const ridersRows = (payload.riders || []).map(mapRiderToRow);
  const orderItemsRows = (payload.orders || []).flatMap((order) =>
    (order.items || []).map((item) => mapOrderItemToRow(order.id, item))
  );

  const { error: settingsError } = await supabase
    .from("settings")
    .upsert(settingsRow, { onConflict: "id" });

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  await deleteAll("order_items", "order_id", "__never__");
  await deleteAll("orders", "id", "__never__");
  await deleteAll("customers", "id", "__never__");
  await deleteAll("products", "id", "__never__");
  await deleteAll("promotions", "id", "__never__");
  await deleteAll("expenses", "id", "__never__");
  await deleteAll("riders", "id", "__never__");

  if (productsRows.length) {
    const { error } = await supabase.from("products").insert(productsRows);
    if (error) throw new Error(error.message);
  }
  if (promotionsRows.length) {
    const { error } = await supabase.from("promotions").insert(promotionsRows);
    if (error) throw new Error(error.message);
  }
  if (customersRows.length) {
    const { error } = await supabase.from("customers").insert(customersRows);
    if (error) throw new Error(error.message);
  }
  if (ordersRows.length) {
    const { error } = await supabase.from("orders").insert(ordersRows);
    if (error) throw new Error(error.message);
  }
  if (orderItemsRows.length) {
    const { error } = await supabase.from("order_items").insert(orderItemsRows);
    if (error) throw new Error(error.message);
  }
  if (expensesRows.length) {
    const { error } = await supabase.from("expenses").insert(expensesRows);
    if (error) throw new Error(error.message);
  }
  if (ridersRows.length) {
    const { error } = await supabase.from("riders").insert(ridersRows);
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

export const readDB = async () => (useSupabase ? readDBSupabase() : readDBFile());

export const updateDB = async (mutator) =>
  (useSupabase ? updateDBSupabase(mutator) : updateDBFile(mutator));

export const createId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const resetDB = async () => {
  if (useSupabase) {
    await writeDBSupabase(initialData);
    return;
  }

  writeDBFile(initialData);
};

export const getDataDir = () => resolvedDataDir;
