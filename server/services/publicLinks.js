const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

export const getPublicStoreUrl = () =>
  trimTrailingSlash(process.env.PUBLIC_STORE_URL || process.env.STORE_URL || "http://localhost:5173");

export const buildTrackingUrl = (orderId) => `${getPublicStoreUrl()}/pedido/${orderId}`;
