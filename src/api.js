import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_URL || "";
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? "http://localhost:4000" : undefined);

const request = async (path, options = {}) => {
  const { headers: customHeaders = {}, ...restOptions } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...customHeaders
    }
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || "Erro inesperado na requisicao.");
  }

  return payload;
};

export const api = {
  getStore: () => request("/api/store"),
  getWhatsAppStatus: () => request("/api/whatsapp/status"),
  lookupCustomer: (phone) =>
    request("/api/customers/lookup", {
      method: "POST",
      body: JSON.stringify({ phone })
    }),
  createOrder: (body) =>
    request("/api/orders", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  getOrder: (id) => request(`/api/orders/${id}`),
  adminLogin: (credentials) =>
    request("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    }),
  getDashboard: (token) =>
    request("/api/admin/dashboard", {
      headers: { Authorization: `Bearer ${token}` }
    }),
  getOrders: (token) =>
    request("/api/admin/orders", {
      headers: { Authorization: `Bearer ${token}` }
    }),
  createPosOrder: (token, body) =>
    request("/api/admin/pos/orders", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  updateOrderStatus: (token, id, status) =>
    request(`/api/admin/orders/${id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status })
    }),
  updateOrderRider: (token, id, riderId) =>
    request(`/api/admin/orders/${id}/rider`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ riderId })
    }),
  createProduct: (token, body) =>
    request("/api/admin/products", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  updateProduct: (token, id, body) =>
    request(`/api/admin/products/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  deleteProduct: (token, id) =>
    request(`/api/admin/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }),
  toggleProduct: (token, id) =>
    request(`/api/admin/products/${id}/toggle`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    }),
  createPromotion: (token, body) =>
    request("/api/admin/promotions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  updatePromotion: (token, id, body) =>
    request(`/api/admin/promotions/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  deletePromotion: (token, id) =>
    request(`/api/admin/promotions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }),
  getCustomers: (token) =>
    request("/api/admin/customers", {
      headers: { Authorization: `Bearer ${token}` }
    }),
  updateFees: (token, fees) =>
    request("/api/admin/settings/fees", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fees })
    }),
  getReports: (token, days) =>
    request(`/api/admin/reports${days ? `?days=${days}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` }
    }),
  createExpense: (token, body) =>
    request("/api/admin/expenses", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  updateExpense: (token, id, body) =>
    request(`/api/admin/expenses/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  deleteExpense: (token, id) =>
    request(`/api/admin/expenses/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }),
  createRider: (token, body) =>
    request("/api/admin/riders", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  updateRider: (token, id, body) =>
    request(`/api/admin/riders/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }),
  deleteRider: (token, id) =>
    request(`/api/admin/riders/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
};

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ["websocket", "polling"]
});
