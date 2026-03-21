import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { initialData } from "../server/data/seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

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

const supabaseUrl =
  process.env.SUPABASE_URL ||
  (process.env.SUPABASE_PROJECT_ID
    ? `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`
    : "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para migrar.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const defaultDataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(rootDir, "server", "data");
const dataDir = process.env.DATA_DIR || process.env.APP_DATA_DIR || defaultDataDir;
const resolvedDataDir = path.resolve(dataDir);
const dbPath = path.join(resolvedDataDir, "db.json");

const loadLocalData = () => {
  if (fs.existsSync(dbPath)) {
    return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  }
  return initialData;
};

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
  stock_low_threshold: Number(settings.stockLowThreshold ?? 5)
});

const mapCategoryToRow = (category, index) => ({
  id: `category-${index + 1}-${String(category || "").trim().toLowerCase().replace(/\s+/g, "-")}`,
  name: String(category || "").trim()
});

const mapPaymentMethodToRow = (method) => ({
  value: String(method.value || "").trim(),
  label: String(method.label || method.value || "").trim(),
  active: method.active ?? true
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
  active: zone.active ?? true
});

const mapProductToRow = (product) => {
  const now = new Date().toISOString();
  return {
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
  created_at: product.createdAt || now,
  updated_at: product.updatedAt || product.createdAt || now
  };
};

const mapPromotionToRow = (promo) => {
  const now = new Date().toISOString();
  return {
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
  created_at: promo.createdAt || now,
  updated_at: promo.updatedAt || promo.createdAt || now
  };
};

const mapCustomerToRow = (customer) => {
  const now = new Date().toISOString();
  return {
  id: customer.id,
  name: customer.name,
  phone: customer.phone,
  address: customer.address,
  neighborhood: customer.neighborhood,
  notes: customer.notes || "",
  total_spent: Number(customer.totalSpent ?? 0),
  order_ids: customer.orderIds || [],
  last_order_id: customer.lastOrderId || null,
  created_at: customer.createdAt || now,
  updated_at: customer.updatedAt || customer.createdAt || now
  };
};

const mapOrderToRow = (order) => {
  const now = new Date().toISOString();
  return {
  id: order.id,
  number: order.number,
  created_at: order.createdAt || now,
  updated_at: order.updatedAt || order.createdAt || now,
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
  };
};

const mapOrderItemToRow = (orderId, item) => ({
  order_id: orderId,
  product_id: item.productId || null,
  name: item.name,
  volume: item.volume || "",
  unit_price: Number(item.unitPrice ?? 0),
  quantity: Number(item.quantity ?? 0),
  line_total: Number(item.lineTotal ?? 0)
});

const mapExpenseToRow = (expense) => {
  const now = new Date().toISOString();
  return {
  id: expense.id,
  title: expense.title,
  category: expense.category || "",
  amount: Number(expense.amount ?? 0),
  date: expense.date || expense.createdAt || now,
  note: expense.note || "",
  created_at: expense.createdAt || now,
  updated_at: expense.updatedAt || expense.createdAt || now
  };
};

const mapPayableToRow = (entry) => {
  const now = new Date().toISOString();
  return {
    id: entry.id,
    title: entry.title,
    category: entry.category || "",
    amount: Number(entry.amount ?? 0),
    due_date: entry.dueDate || entry.createdAt || now,
    note: entry.note || "",
    status: entry.status || "pending",
    created_at: entry.createdAt || now,
    updated_at: entry.updatedAt || entry.createdAt || now
  };
};

const mapReceivableToRow = (entry) => {
  const now = new Date().toISOString();
  return {
    id: entry.id,
    title: entry.title,
    customer_name: entry.customerName || "",
    customer_phone: entry.customerPhone || "",
    category: entry.category || "",
    amount: Number(entry.amount ?? 0),
    due_date: entry.dueDate || entry.createdAt || now,
    note: entry.note || "",
    status: entry.status || "pending",
    created_at: entry.createdAt || now,
    updated_at: entry.updatedAt || entry.createdAt || now
  };
};

const mapSupportRequestToRow = (entry) => {
  const now = new Date().toISOString();
  return {
    id: entry.id,
    customer_name: entry.customerName || "",
    phone: entry.phone || "",
    source: entry.source || "whatsapp",
    status: entry.status || "pending",
    note: entry.note || "",
    requested_at: entry.requestedAt || entry.createdAt || now,
    created_at: entry.createdAt || now,
    updated_at: entry.updatedAt || entry.createdAt || now
  };
};

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
    session.difference === null || session.difference === undefined ? null : Number(session.difference),
  note: session.note || "",
  created_at: session.createdAt || session.openedAt,
  updated_at: session.updatedAt || session.closedAt || session.openedAt
});

const mapCashMovementToRow = (movement, sessionId) => ({
  id: movement.id,
  session_id: sessionId,
  type: movement.type || "",
  amount: Number(movement.amount ?? 0),
  note: movement.note || "",
  created_at: movement.createdAt,
  updated_at: movement.updatedAt || movement.createdAt
});

const mapRiderToRow = (rider) => {
  const now = new Date().toISOString();
  return {
  id: rider.id,
  name: rider.name,
  phone: rider.phone || "",
  active: rider.active ?? true,
  created_at: rider.createdAt || now,
  updated_at: rider.updatedAt || rider.createdAt || now
  };
};

const deleteAll = async (table, column, sentinel) => {
  const { error } = await supabase.from(table).delete().neq(column, sentinel);
  if (error) {
    throw new Error(error.message);
  }
};

const formatMigrationError = (error) => {
  const message = error?.message || String(error);

  if (message.includes("Could not find the table 'public.")) {
    const tableName = message.split("Could not find the table 'public.")[1]?.split("'")[0];
    return `Tabela ausente no Supabase: ${tableName}. Aplique primeiro o arquivo supabase/schema.sql completo no SQL Editor e depois rode a migracao novamente.`;
  }

  return message;
};

const migrate = async () => {
  const force = process.env.MIGRATE_FORCE === "true";
  const payload = loadLocalData();

  if (!force) {
    const { data, error } = await supabase
      .from("settings")
      .select("id")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      console.log("Dados ja existem. Use MIGRATE_FORCE=true para sobrescrever.");
      return;
    }
  }

  const settingsRow = mapSettingsToRow(payload.settings || {});
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

  await deleteAll("order_items", "order_id", "__never__");
  await deleteAll("orders", "id", "__never__");
  await deleteAll("customers", "id", "__never__");
  await deleteAll("products", "id", "__never__");
  await deleteAll("promotions", "id", "__never__");
  await deleteAll("categories", "id", "__never__");
  await deleteAll("payment_methods", "value", "__never__");
  await deleteAll("delivery_zones", "id", "__never__");
  await deleteAll("expenses", "id", "__never__");
  await deleteAll("payables", "id", "__never__");
  await deleteAll("receivables", "id", "__never__");
  await deleteAll("support_requests", "id", "__never__");
  await deleteAll("cash_movements", "id", "__never__");
  await deleteAll("cash_sessions", "id", "__never__");
  await deleteAll("riders", "id", "__never__");

  const { error: settingsError } = await supabase
    .from("settings")
    .upsert(settingsRow, { onConflict: "id" });
  if (settingsError) throw new Error(settingsError.message);

  if (productsRows.length) {
    const { error } = await supabase.from("products").insert(productsRows);
    if (error) throw new Error(error.message);
  }
  if (promotionsRows.length) {
    const { error } = await supabase.from("promotions").insert(promotionsRows);
    if (error) throw new Error(error.message);
  }
  if (categoriesRows.length) {
    const { error } = await supabase.from("categories").insert(categoriesRows);
    if (error) throw new Error(error.message);
  }
  if (paymentMethodsRows.length) {
    const { error } = await supabase.from("payment_methods").insert(paymentMethodsRows);
    if (error) throw new Error(error.message);
  }
  if (deliveryZonesRows.length) {
    const { error } = await supabase.from("delivery_zones").insert(deliveryZonesRows);
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
  if (payablesRows.length) {
    const { error } = await supabase.from("payables").insert(payablesRows);
    if (error) throw new Error(error.message);
  }
  if (receivablesRows.length) {
    const { error } = await supabase.from("receivables").insert(receivablesRows);
    if (error) throw new Error(error.message);
  }
  if (supportRequestsRows.length) {
    const { error } = await supabase.from("support_requests").insert(supportRequestsRows);
    if (error) throw new Error(error.message);
  }
  if (cashSessionsRows.length) {
    const { error } = await supabase.from("cash_sessions").insert(cashSessionsRows);
    if (error) throw new Error(error.message);
  }
  if (cashMovementsRows.length) {
    const { error } = await supabase.from("cash_movements").insert(cashMovementsRows);
    if (error) throw new Error(error.message);
  }
  if (ridersRows.length) {
    const { error } = await supabase.from("riders").insert(ridersRows);
    if (error) throw new Error(error.message);
  }

  console.log("Migracao concluida com sucesso.");
};

migrate().catch((error) => {
  console.error("Falha na migracao:", formatMigrationError(error));
  process.exit(1);
});
