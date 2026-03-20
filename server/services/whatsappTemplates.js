import { buildTrackingUrl } from "./publicLinks.js";

export const STATUS_FLOW = [
  "received",
  "accepted",
  "preparing",
  "out_for_delivery",
  "delivered"
];

export const STATUS_LABELS = {
  received: "Pedido recebido",
  accepted: "Pedido aceito",
  preparing: "Em preparacao",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue"
};

export const STATUS_MESSAGES = {
  received: "Ola! Seu pedido foi recebido com sucesso. Em instantes iremos confirmar.",
  accepted: "Seu pedido foi aceito e ja entrou na fila de preparo.",
  preparing: "Seu pedido esta sendo preparado agora.",
  out_for_delivery: "Seu pedido saiu para entrega. Ja esta a caminho!",
  delivered: "Pedido entregue com sucesso! Muito obrigado pela preferencia."
};

export const PAYMENT_LABELS = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartao na entrega"
};

export const formatCurrency = (value) =>
  `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;

export const buildOrderStatusMessage = (order, status, storeName = "Fortin Delivery") => {
  const trackingUrl = buildTrackingUrl(order.id);
  const lines = [
    `*${storeName}*`,
    "",
    `Ola, ${order.customer.name}!`,
    STATUS_MESSAGES[status] || "Seu pedido teve uma atualizacao.",
    "",
    `Pedido: *#${order.number}*`,
    `Status: *${STATUS_LABELS[status] || status}*`,
    `Total: *${formatCurrency(order.total)}*`,
    `Pagamento: *${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}*`
  ];

  if (order.customer.neighborhood) {
    lines.push(`Bairro: *${order.customer.neighborhood}*`);
  }

  lines.push("", `Acompanhe seu pedido: ${trackingUrl}`);

  if (status === "delivered") {
    lines.push("", "Se quiser repetir o pedido depois, e so responder *menu*.");
  }

  return lines.join("\n");
};

export const buildOrderLookupMessage = (order, storeName = "Fortin Delivery") => {
  const trackingUrl = buildTrackingUrl(order.id);

  return [
    `*${storeName}*`,
    "",
    `Seu ultimo pedido foi o *#${order.number}*.`,
    `Status atual: *${STATUS_LABELS[order.status] || order.status}*`,
    `Total: *${formatCurrency(order.total)}*`,
    "",
    `Acompanhe em tempo real: ${trackingUrl}`
  ].join("\n");
};
