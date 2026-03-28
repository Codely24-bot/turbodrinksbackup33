import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  advanceDeliveryOrderStatus,
  assignOrderToMotoboy,
  createDeliveryOrder,
  createChatbotApi,
  fetchErpCollections,
  finalizeDeliveryOrder,
  getChatbotDefaultResponse,
  getDeliveryEventName,
  getDeliverySummaries,
  reserveOrderStock,
  saveAppSettings,
  saveBairrosEntrega,
  syncDeliverySnapshot,
  togglePausedProduct,
  togglePublishedProduct,
} from '@/features/delivery/services/deliveryHubService';

export const useDeliveryHub = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState({
    products: [],
    people: [],
    motoboys: [],
    sales: [],
    orders: [],
    settings: null,
    categories: [],
    publishedProducts: [],
  });

  const loadSnapshot = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await syncDeliverySnapshot(user.id);
      setSnapshot(data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const eventName = getDeliveryEventName();
    const handleRefresh = () => {
      loadSnapshot();
    };

    window.addEventListener(eventName, handleRefresh);
    window.addEventListener('storage', handleRefresh);
    return () => {
      window.removeEventListener(eventName, handleRefresh);
      window.removeEventListener('storage', handleRefresh);
    };
  }, [loadSnapshot, user]);

  const refreshOrdersOnly = useCallback(async () => {
    if (!user?.id) return;
    const collections = await fetchErpCollections(user.id);
    setSnapshot((current) => ({
      ...current,
      orders: collections.orders,
      settings: collections.settings,
    }));
  }, [user]);

  return {
    user,
    loading,
    snapshot,
    summaries: getDeliverySummaries(snapshot),
    chatbotDefaultResponse: getChatbotDefaultResponse(),
    loadSnapshot,
    refreshOrdersOnly,
    chatbotApi: user?.id ? createChatbotApi(user.id) : null,
    togglePublishedProduct: async (productId) => {
      await togglePublishedProduct(
        user.id,
        productId,
        snapshot.products.map((product) => product.id),
      );
      await loadSnapshot();
    },
    togglePausedProduct: async (productId) => {
      await togglePausedProduct(user.id, productId);
      await loadSnapshot();
    },
    saveBairrosEntrega: async (bairros) => {
      await saveBairrosEntrega(user.id, bairros);
      await loadSnapshot();
    },
    saveAppSettings: async (appInfo) => {
      await saveAppSettings(user.id, appInfo);
      await loadSnapshot();
    },
    createDeliveryOrder: async (payload) => {
      const order = await createDeliveryOrder(user.id, payload);
      await loadSnapshot();
      return order;
    },
    reserveOrderStock: async (orderId) => {
      const result = await reserveOrderStock(user.id, orderId);
      await loadSnapshot();
      return result;
    },
    updateOrderStatus: async (orderId, nextStatus) => {
      const result = await advanceDeliveryOrderStatus(user.id, orderId, nextStatus);
      await loadSnapshot();
      return result;
    },
    assignOrderToMotoboy: async (orderId, motoboy) => {
      const result = await assignOrderToMotoboy(user.id, orderId, motoboy);
      await loadSnapshot();
      return result;
    },
    finalizeOrder: async (orderId) => {
      const result = await finalizeDeliveryOrder(user.id, orderId);
      await loadSnapshot();
      return result;
    },
  };
};
