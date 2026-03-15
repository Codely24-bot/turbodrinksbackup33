import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initialData } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "db.json");

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

export const readDB = () => {
  ensureDatabase();
  return normalizeDatabase(JSON.parse(fs.readFileSync(dbPath, "utf-8")));
};

export const writeDB = (data) => {
  fs.writeFileSync(dbPath, JSON.stringify(normalizeDatabase(data), null, 2));
};

export const updateDB = (mutator) => {
  const current = readDB();
  const draft = deepCopy(current);
  const result = mutator(draft) ?? draft;
  writeDB(result);
  return result;
};

export const createId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const resetDB = () => {
  writeDB(initialData);
};
