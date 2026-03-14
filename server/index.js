import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { createId, readDB, updateDB } from "./data/store.js";
import { buildTrackingUrl, getPublicStoreUrl } from "./services/publicLinks.js";
import { normalizePhone } from "./services/phone.js";
import {
  STATUS_FLOW,
  STATUS_LABELS,
  formatCurrency
} from "./services/whatsappTemplates.js";
import { sendWhatsAppUpdate } from "./services/whatsapp.js";
import {
  getWhatsAppQrPage,
  getWhatsAppQrPngBuffer,
  getWhatsAppStatus,
  initializeWhatsAppBot
} from "./services/whatsappBot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT || 4000);

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "delivery-admin-token";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.json());
app.use("/public", express.static(path.join(rootDir, "public")));

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

const sameDay = (date, compareDate = new Date()) => {
  const left = new Date(date);
  return left.toDateString() === compareDate.toDateString();
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
  categories: [...new Set(db.products.map((product) => product.category))],
  products: db.products
    .filter((product) => product.active && product.stock > 0)
    .sort(
      (left, right) => Number(right.featured) - Number(left.featured) || left.price - right.price
    ),
  featuredProducts: db.products.filter(
    (product) => product.active && product.stock > 0 && product.featured
  ),
  promotions: db.promotions.filter((promotion) => promotion.active)
});

const getFeeForNeighborhood = (db, neighborhood) => {
  const normalizedInput = normalizeNeighborhood(neighborhood);
  const match = Object.entries(db.settings.deliveryFees || {}).find(
    ([name]) => normalizeNeighborhood(name) === normalizedInput
  );
  return match ? Number(match[1]) : 0;
};

const getSequenceNumber = (orders) => {
  const lastNumber = orders.reduce((max, order) => Math.max(max, order.number), 1000);
  return lastNumber + 1;
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

const buildDashboard = (db) => {
  const todayOrders = db.orders.filter((order) => sameDay(order.createdAt));
  const weeklyOrders = db.orders.filter((order) => isWithinDays(order.createdAt, 7));
  const monthlyOrders = db.orders.filter((order) => isWithinDays(order.createdAt, 30));

  const salesToday = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const weeklyRevenue = weeklyOrders.reduce((sum, order) => sum + order.total, 0);
  const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + order.total, 0);

  return {
    kpis: {
      salesToday: parseMoney(salesToday),
      ordersToday: todayOrders.length,
      avgTicket: parseMoney(monthlyOrders.length ? monthlyRevenue / monthlyOrders.length : 0),
      weeklyRevenue: parseMoney(weeklyRevenue),
      monthlyRevenue: parseMoney(monthlyRevenue)
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
    promotions: db.promotions,
    deliveryFees: db.settings.deliveryFees,
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

const requireAdmin = (request, response, next) => {
  const authorization = request.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");

  if (token !== ADMIN_TOKEN) {
    return response.status(401).json({ message: "Nao autorizado." });
  }

  return next();
};

const notifyOrderUpdate = (order, status) => {
  io.emit("order:updated", order);
  io.to(`order:${order.id}`).emit("order:updated", order);
  io.emit("dashboard:update");
  sendWhatsAppUpdate(order, status).catch((error) => {
    console.error("[whatsapp-error]", error?.message || error);
  });
};

io.on("connection", (socket) => {
  socket.on("order:subscribe", (orderId) => {
    if (orderId) {
      socket.join(`order:${orderId}`);
    }
  });

  socket.on("admin:subscribe", (token) => {
    if (token === ADMIN_TOKEN) {
      socket.join("admins");
    }
  });
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

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

app.get("/api/store", (_request, response) => {
  response.json(getStorePayload(readDB()));
});

app.post("/api/customers/lookup", (request, response) => {
  const db = readDB();
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
});

app.get("/api/orders/:id", (request, response) => {
  const db = readDB();
  const order = db.orders.find((entry) => entry.id === request.params.id);

  if (!order) {
    return response.status(404).json({ message: "Pedido nao encontrado." });
  }

  return response.json({
    ...order,
    trackingUrl: buildTrackingUrl(order.id)
  });
});

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
    const db = updateDB((draft) => {
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

          return {
            productId: product.id,
            name: product.name,
            volume: product.volume,
            unitPrice: parseMoney(product.price),
            quantity,
            lineTotal: parseMoney(product.price * quantity)
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
        statusTimeline: [{ status: "received", timestamp: new Date().toISOString() }]
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

app.get("/api/admin/dashboard", requireAdmin, (_request, response) => {
  response.json(buildDashboard(readDB()));
});

app.get("/api/admin/orders", requireAdmin, (_request, response) => {
  const db = readDB();

  response.json(
    [...db.orders].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
  );
});

app.patch("/api/admin/orders/:id/status", requireAdmin, async (request, response) => {
  const { status } = request.body || {};

  if (!STATUS_FLOW.includes(status)) {
    return response.status(400).json({ message: "Status invalido." });
  }

  let updatedOrder = null;

  try {
    updateDB((draft) => {
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

app.get("/api/admin/products", requireAdmin, (_request, response) => {
  response.json(readDB().products);
});

app.post("/api/admin/products", requireAdmin, (request, response) => {
  const payload = request.body || {};

  if (!payload.name || !payload.category) {
    return response.status(400).json({ message: "Nome e categoria sao obrigatorios." });
  }

  let createdProduct = null;
  const db = updateDB((draft) => {
    createdProduct = {
      id: createId("prod"),
      name: payload.name,
      category: payload.category,
      volume: payload.volume || "",
      price: parseMoney(payload.price),
      originalPrice: parseMoney(payload.originalPrice || payload.price),
      stock: Number(payload.stock || 0),
      active: payload.active ?? true,
      featured: payload.featured ?? false,
      badge: payload.badge || "",
      description: payload.description || "",
      image: payload.image || "/products/combo.svg"
    };
    draft.products.push(createdProduct);
    return draft;
  });

  io.emit("catalog:updated", getStorePayload(db));
  return response.status(201).json(createdProduct);
});

app.put("/api/admin/products/:id", requireAdmin, (request, response) => {
  const payload = request.body || {};
  let updatedProduct = null;

  try {
    const db = updateDB((draft) => {
      const product = draft.products.find((entry) => entry.id === request.params.id);

      if (!product) {
        throw new Error("Produto nao encontrado.");
      }

      Object.assign(product, {
        name: payload.name ?? product.name,
        category: payload.category ?? product.category,
        volume: payload.volume ?? product.volume,
        price: payload.price !== undefined ? parseMoney(payload.price) : product.price,
        originalPrice:
          payload.originalPrice !== undefined
            ? parseMoney(payload.originalPrice)
            : product.originalPrice,
        stock: payload.stock !== undefined ? Number(payload.stock) : product.stock,
        active: payload.active ?? product.active,
        featured: payload.featured ?? product.featured,
        badge: payload.badge ?? product.badge,
        description: payload.description ?? product.description,
        image: payload.image ?? product.image
      });

      updatedProduct = product;
      return draft;
    });

    io.emit("catalog:updated", getStorePayload(db));
    return response.json(updatedProduct);
  } catch (error) {
    return response.status(400).json({ message: error.message || "Falha ao atualizar produto." });
  }
});

app.delete("/api/admin/products/:id", requireAdmin, (request, response) => {
  const db = updateDB((draft) => {
    draft.products = draft.products.filter((entry) => entry.id !== request.params.id);
    return draft;
  });

  io.emit("catalog:updated", getStorePayload(db));
  return response.status(204).end();
});

app.patch("/api/admin/products/:id/toggle", requireAdmin, (request, response) => {
  let updatedProduct = null;

  try {
    const db = updateDB((draft) => {
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

app.get("/api/admin/promotions", requireAdmin, (_request, response) => {
  response.json(readDB().promotions);
});

app.post("/api/admin/promotions", requireAdmin, (request, response) => {
  const payload = request.body || {};
  let createdPromotion = null;

  updateDB((draft) => {
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
});

app.put("/api/admin/promotions/:id", requireAdmin, (request, response) => {
  const payload = request.body || {};
  let updatedPromotion = null;

  try {
    updateDB((draft) => {
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

app.delete("/api/admin/promotions/:id", requireAdmin, (request, response) => {
  updateDB((draft) => {
    draft.promotions = draft.promotions.filter((entry) => entry.id !== request.params.id);
    return draft;
  });

  io.emit("catalog:updated");
  return response.status(204).end();
});

app.get("/api/admin/customers", requireAdmin, (_request, response) => {
  const db = readDB();
  const customers = db.customers.map((customer) => ({
    ...customer,
    previousOrders: customer.orderIds
      .map((orderId) => db.orders.find((order) => order.id === orderId))
      .filter(Boolean)
  }));

  response.json(customers.sort((left, right) => right.totalSpent - left.totalSpent));
});

app.put("/api/admin/settings/fees", requireAdmin, (request, response) => {
  const fees = request.body.fees || {};

  const db = updateDB((draft) => {
    draft.settings.deliveryFees = Object.fromEntries(
      Object.entries(fees)
        .map(([neighborhood, fee]) => [neighborhood, Number(fee)])
        .filter(([neighborhood]) => neighborhood.trim())
    );
    return draft;
  });

  io.emit("catalog:updated", getStorePayload(db));
  return response.json(db.settings.deliveryFees);
});

app.get("/api/admin/reports", requireAdmin, (_request, response) => {
  const db = readDB();
  const dashboard = buildDashboard(db);

  response.json({
    ...dashboard.kpis,
    topProducts: dashboard.topProducts,
    dailySales: dashboard.recentOrders
      .filter((order) => isWithinDays(order.createdAt, 7))
      .map((order) => ({
        day: new Date(order.createdAt).toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit"
        }),
        value: order.total
      }))
  });
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

initializeWhatsAppBot();

server.listen(port, () => {
  console.log(`Delivery server running on http://localhost:${port}`);
  console.log(`Admin padrao: ${ADMIN_USER} / ${ADMIN_PASSWORD}`);
  console.log(`Status disponiveis: ${STATUS_FLOW.map((status) => STATUS_LABELS[status]).join(", ")}`);
  console.log(`Loja publica: ${getPublicStoreUrl()}`);
  console.log(`WhatsApp: ${getWhatsAppStatus().enabled ? "habilitado" : "desativado"}`);
  console.log(`Exemplo de rastreio: ${buildTrackingUrl("pedido-exemplo")}`);
  console.log(`Exemplo de valor formatado: ${formatCurrency(99.9)}`);
});
