import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initialData } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "db.json");

const deepCopy = (value) => JSON.parse(JSON.stringify(value));

const ensureDatabase = () => {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
  }
};

export const readDB = () => {
  ensureDatabase();
  return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
};

export const writeDB = (data) => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
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
