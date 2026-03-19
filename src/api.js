import { io } from "socket.io-client";
import { supabase } from "./supabase";

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

const mapSettingsRow = (row) => ({
  storeName: row.store_name || "",
  tagline: row.tagline || "",
  bannerTitle: row.banner_title || "",
  bannerSubtitle: row.banner_subtitle || "",
  addressLine: row.address_line || "",
  city: row.city || "",
  mapsUrl: row.maps_url || "",
  openingHoursText: row.opening_hours_text || "",
  whatsappNumber: row.whatsapp_number || "",
  quickMessage: row.quick_message || "",
  supportText: row.support_text || "",
  deliveryFees: row.delivery_fees || {}
});

const getPublicStoreUrl = () =>
  import.meta.env.VITE_PUBLIC_STORE_URL || window.location.origin;

const getStoreCatalogScore = (store) => {
  if (!store) {
    return -1;
  }

  const products = Array.isArray(store.products) ? store.products.length : 0;
  const promotions = Array.isArray(store.promotions) ? store.promotions.length : 0;
  const featuredProducts = Array.isArray(store.featuredProducts) ? store.featuredProducts.length : 0;
  const categories = Array.isArray(store.categories) ? store.categories.length : 0;

  return products * 1000 + promotions * 100 + featuredProducts * 10 + categories;
};

const withSource = (store, source) => (store ? { ...store, source } : null);

const getStoreFromSupabase = async () => {
  if (!supabase) {
    return null;
  }

  const [settingsRes, productsRes, promotionsRes] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("products").select("*"),
    supabase.from("promotions").select("*")
  ]);

  const error = settingsRes.error || productsRes.error || promotionsRes.error;
  if (error) {
    throw new Error(error.message || "Falha ao carregar dados do Supabase.");
  }

  const settings = settingsRes.data ? mapSettingsRow(settingsRes.data) : {};
  const products = (productsRes.data || [])
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      volume: product.volume || "",
      salePrice: Number(product.sale_price ?? 0),
      purchasePrice: Number(product.purchase_price ?? 0),
      stock: Number(product.stock ?? 0),
      active: product.active ?? true,
      featured: product.featured ?? false,
      badge: product.badge || "",
      description: product.description || "",
      image: product.image || ""
    }))
    .filter((product) => product.active && product.stock > 0)
    .sort(
      (left, right) =>
        Number(right.featured) - Number(left.featured) || left.salePrice - right.salePrice
    );
  const promotions = (promotionsRes.data || [])
    .map((promo) => ({
      id: promo.id,
      type: promo.type,
      title: promo.title,
      description: promo.description || "",
      code: promo.code || "",
      discountType: promo.discount_type || "fixed",
      discountValue: Number(promo.discount_value ?? 0),
      minimumOrder: Number(promo.minimum_order ?? 0),
      neighborhood: promo.neighborhood || "",
      active: promo.active ?? true,
      highlight: promo.highlight || ""
    }))
    .filter((promo) => promo.active);

  const categories = [
    ...new Set(products.map((product) => product.category).filter(Boolean))
  ];

  return {
    settings: {
      ...settings,
      publicStoreUrl: getPublicStoreUrl()
    },
    categories,
    products,
    featuredProducts: products.filter((product) => product.featured),
    promotions
  };
};

const createOrderFromSupabase = async (body) => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("create_order", { payload: body });
  if (error) {
    throw new Error(error.message || "Falha ao criar pedido no Supabase.");
  }

  return { order: data };
};

export const api = {
  getStore: async () => {
    const [apiResult, supabaseResult] = await Promise.allSettled([
      request("/api/store"),
      getStoreFromSupabase()
    ]);

    const apiStore = apiResult.status === "fulfilled" ? apiResult.value : null;
    const supabaseStore = supabaseResult.status === "fulfilled" ? supabaseResult.value : null;

    if (getStoreCatalogScore(supabaseStore) > getStoreCatalogScore(apiStore)) {
      return withSource(supabaseStore, "supabase");
    }

    if (apiStore) {
      return withSource(apiStore, "api");
    }

    if (supabaseStore) {
      return withSource(supabaseStore, "supabase");
    }

    const apiError = apiResult.status === "rejected" ? apiResult.reason : null;
    const supabaseError = supabaseResult.status === "rejected" ? supabaseResult.reason : null;
    throw apiError || supabaseError || new Error("Nao foi possivel carregar a loja.");
  },
  getWhatsAppStatus: () => request("/api/whatsapp/status"),
  lookupCustomer: (phone) =>
    request("/api/customers/lookup", {
      method: "POST",
      body: JSON.stringify({ phone })
    }),
  createOrder: async (body, options = {}) => {
    const { preferredSource } = options;
    const submitWithApi = () =>
      request("/api/orders", {
        method: "POST",
        body: JSON.stringify(body)
      });

    if (preferredSource === "api") {
      return submitWithApi();
    }

    if (!supabase) {
      return submitWithApi();
    }

    try {
      return await createOrderFromSupabase(body);
    } catch (error) {
      const message = String(error?.message || "");
      const canFallbackToApi =
        preferredSource !== "supabase" ||
        /Carrinho invalido|Adicione ao menos um item ao carrinho|Preencha nome/i.test(message);

      if (canFallbackToApi) {
        return submitWithApi();
      }

      throw error;
    }
  },
  getOrder: (id) => request(`/api/orders/${id}`),
  adminLogin: (credentials) =>
    request("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    }),
  getAdminProfile: (token) =>
    request("/api/admin/profile", {
      headers: { Authorization: `Bearer ${token}` }
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
