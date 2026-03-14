import path from "node:path";
import { createRequire } from "node:module";
import { readDB } from "../data/store.js";
import { normalizePhone, phonesMatch, toWhatsAppChatId } from "./phone.js";
import {
  STATUS_LABELS,
  buildOrderLookupMessage,
  buildOrderStatusMessage,
  formatCurrency
} from "./whatsappTemplates.js";
import { getPublicStoreUrl } from "./publicLinks.js";

const require = createRequire(import.meta.url);
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const botState = {
  enabled: process.env.WHATSAPP_ENABLED !== "false",
  initialized: false,
  connected: false,
  lastDisconnectReason: "",
  lastError: "",
  lastUpdatedAt: null,
  qrDataUrl: null,
  qrPngBuffer: null
};

let client = null;

const sessions = new Map();
const antiSpam = new Map();

const normalizeText = (text = "") =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getSettings = () => readDB().settings;
const getStoreName = () => getSettings().storeName || "Distribuidora Delivery";
const getOpeningHoursText = () =>
  getSettings().openingHoursText ||
  "Horario de funcionamento indisponivel no momento. Digite menu para voltar.";
const getAddressText = () => {
  const settings = getSettings();
  const lines = ["*Nosso endereco*"];

  if (settings.addressLine) {
    lines.push("", settings.addressLine);
  }

  if (settings.city) {
    lines.push(settings.city);
  }

  if (settings.mapsUrl) {
    lines.push("", settings.mapsUrl);
  }

  return lines.join("\n");
};

const getDeliveryFees = () => getSettings().deliveryFees || {};

const buildNeighborhoodList = () =>
  Object.keys(getDeliveryFees())
    .sort((left, right) => left.localeCompare(right))
    .map((name) => `- ${name}`)
    .join("\n");

const getStoreLink = () => getPublicStoreUrl();

const buildMenuMessage = () =>
  [
    `*${getStoreName()}*`,
    "",
    "Seu pedido de bebidas esta a poucos cliques.",
    "",
    `Faca seu pedido pelo catalogo: ${getStoreLink()}`,
    "",
    "Escolha uma opcao:",
    "1. Taxa de entrega",
    "2. Bairros atendidos",
    "3. Horario de funcionamento",
    "4. Endereco",
    "5. Status do meu pedido"
  ].join("\n");

const buildCatalogMessage = () =>
  [
    `*${getStoreName()}*`,
    "",
    "Monte seu pedido no catalogo online e acompanhe o status em tempo real:",
    getStoreLink(),
    "",
    "Se precisar, digite *menu* para ver taxa, bairros, horario, endereco e pedido."
  ].join("\n");

const getLatestOrderByPhone = (phone) => {
  const db = readDB();

  return [...db.orders]
    .filter((order) => phonesMatch(order.customer.phone, phone))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
};

const findNeighborhoodFee = (input) => {
  const normalizedInput = normalizeText(input);

  return Object.entries(getDeliveryFees()).find(
    ([name]) => normalizeText(name) === normalizedInput
  );
};

const updateQrAssets = async (qr) => {
  botState.lastUpdatedAt = new Date().toISOString();

  try {
    botState.qrDataUrl = await QRCode.toDataURL(qr, {
      errorCorrectionLevel: "H",
      margin: 2,
      scale: 12,
      width: 420,
      type: "image/png"
    });
    botState.qrPngBuffer = await QRCode.toBuffer(qr, {
      errorCorrectionLevel: "H",
      margin: 2,
      scale: 12,
      width: 420,
      type: "image/png"
    });
  } catch (error) {
    botState.lastError = error.message;
    botState.qrDataUrl = null;
    botState.qrPngBuffer = null;
  }
};

const createClient = () => {
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN || undefined;

  return new Client({
    authStrategy: new LocalAuth({
      clientId: process.env.WHATSAPP_CLIENT_ID || "delivery-distribuidora",
      dataPath: path.resolve(process.cwd(), ".wwebjs_auth")
    }),
    puppeteer: {
      headless: process.env.WHATSAPP_HEADLESS !== "false",
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process"
      ]
    }
  });
};

const sendTypingAndMessage = async (chat, destination, text) => {
  await chat.sendStateTyping();
  await delay(1200);
  await client.sendMessage(destination, text);
};

const handleOrderLookup = async (message, chat) => {
  const latestOrder = getLatestOrderByPhone(message.from);

  if (!latestOrder) {
    await sendTypingAndMessage(
      chat,
      message.from,
      [
        `*${getStoreName()}*`,
        "",
        "Nao encontrei um pedido recente para este numero.",
        `Voce pode fazer um novo pedido aqui: ${getStoreLink()}`
      ].join("\n")
    );
    return true;
  }

  await sendTypingAndMessage(
    chat,
    message.from,
    buildOrderLookupMessage(latestOrder, getStoreName())
  );
  return true;
};

const handleIncomingMessage = async (message) => {
  if (!message.from || message.from === "status@broadcast" || message.fromMe) {
    return;
  }

  if (message.from.endsWith("@g.us") || !message.body) {
    return;
  }

  const now = Date.now();
  const lastMessageAt = antiSpam.get(message.from) || 0;

  if (now - lastMessageAt < 2500) {
    return;
  }

  antiSpam.set(message.from, now);

  const chat = await message.getChat();

  if (chat.isGroup) {
    return;
  }

  const text = normalizeText(message.body);

  if (!sessions.has(message.from)) {
    sessions.set(message.from, { step: "menu" });
  }

  const session = sessions.get(message.from);

  const menuTriggers = /^(menu|oi|ola|opa|bom dia|boa tarde|boa noite|pedido)$/i;
  const statusTriggers = ["status", "acompanhar", "meu pedido", "pedido saiu", "pedido chegou"];
  const catalogTriggers = [
    "cardapio",
    "catalogo",
    "menu",
    "cerveja",
    "cervejas",
    "bebida",
    "bebidas",
    "whisky",
    "vodka",
    "gin",
    "energetico",
    "refrigerante",
    "comprar",
    "pedir"
  ];
  const thanksTriggers = ["obrigado", "obrigada", "valeu", "tmj", "show"];
  const goodbyeTriggers = ["tchau", "falou", "ate mais", "boa noite"];

  if (menuTriggers.test(text)) {
    await sendTypingAndMessage(chat, message.from, buildMenuMessage());
    session.step = "menu";
    return;
  }

  if (statusTriggers.some((item) => text.includes(item))) {
    await handleOrderLookup(message, chat);
    session.step = "menu";
    return;
  }

  if (catalogTriggers.some((item) => text.includes(item))) {
    await sendTypingAndMessage(chat, message.from, buildCatalogMessage());
    session.step = "menu";
    return;
  }

  if (thanksTriggers.some((item) => text.includes(item))) {
    await sendTypingAndMessage(
      chat,
      message.from,
      [
        "Nos que agradecemos pelo contato!",
        "",
        `Quando quiser pedir sua bebida, e so acessar: ${getStoreLink()}`,
        "Se precisar, digite *menu*."
      ].join("\n")
    );
    session.step = "menu";
    return;
  }

  if (goodbyeTriggers.some((item) => text.includes(item))) {
    await sendTypingAndMessage(
      chat,
      message.from,
      [`Combinado! Quando quiser pedir, estaremos aqui:`, getStoreLink()].join("\n")
    );
    session.step = "menu";
    return;
  }

  if (session.step === "menu") {
    if (text === "1") {
      await sendTypingAndMessage(
        chat,
        message.from,
        "Me diga seu bairro para consultar a taxa de entrega."
      );
      session.step = "delivery_fee";
      return;
    }

    if (text === "2") {
      await sendTypingAndMessage(
        chat,
        message.from,
        [`*Bairros atendidos*`, "", buildNeighborhoodList(), "", "Digite seu bairro para consultar a taxa."].join(
          "\n"
        )
      );
      session.step = "delivery_fee";
      return;
    }

    if (text === "3") {
      await sendTypingAndMessage(chat, message.from, getOpeningHoursText());
      return;
    }

    if (text === "4") {
      await sendTypingAndMessage(chat, message.from, getAddressText());
      return;
    }

    if (text === "5") {
      await handleOrderLookup(message, chat);
      return;
    }
  }

  if (session.step === "delivery_fee") {
    const neighborhood = findNeighborhoodFee(text);

    if (neighborhood) {
      const [name, fee] = neighborhood;
      const feeNumber = Number(fee || 0);
      const lines = feeNumber === 0
        ? [
            `Entrega para *${name}* e *gratis*!`,
            "",
            `Monte seu pedido agora: ${getStoreLink()}`
          ]
        : [
            `Taxa para *${name}*: *${formatCurrency(feeNumber)}*`,
            "",
            `Monte seu pedido agora: ${getStoreLink()}`
          ];

      await sendTypingAndMessage(chat, message.from, lines.join("\n"));
      session.step = "menu";
      return;
    }

    await sendTypingAndMessage(
      chat,
      message.from,
      "Ainda nao encontrei esse bairro na area de entrega. Digite outro bairro ou *menu*."
    );
    return;
  }

  await sendTypingAndMessage(
    chat,
    message.from,
    [
      "Nao entendi sua mensagem.",
      "",
      `Para fazer um pedido agora, acesse: ${getStoreLink()}`,
      "Ou digite *menu* para ver as opcoes."
    ].join("\n")
  );
};

export const initializeWhatsAppBot = () => {
  if (!botState.enabled) {
    botState.lastUpdatedAt = new Date().toISOString();
    return;
  }

  if (botState.initialized) {
    return;
  }

  botState.initialized = true;
  client = createClient();

  client.on("qr", async (qr) => {
    botState.connected = false;
    botState.lastError = "";
    qrcodeTerminal.generate(qr, { small: false });
    await updateQrAssets(qr);
    console.log("[whatsapp] QR atualizado. Abra /api/whatsapp/qr para escanear.");
  });

  client.on("ready", () => {
    botState.connected = true;
    botState.lastDisconnectReason = "";
    botState.lastError = "";
    botState.lastUpdatedAt = new Date().toISOString();
    botState.qrDataUrl = null;
    botState.qrPngBuffer = null;
    console.log("[whatsapp] BOT ONLINE COM SUCESSO");
  });

  client.on("disconnected", (reason) => {
    botState.connected = false;
    botState.lastDisconnectReason = String(reason || "desconhecido");
    botState.lastUpdatedAt = new Date().toISOString();
    console.log("[whatsapp] desconectado:", reason);
  });

  client.on("auth_failure", (message) => {
    botState.lastError = String(message || "falha de autenticacao");
    botState.lastUpdatedAt = new Date().toISOString();
    console.log("[whatsapp] falha de autenticacao:", message);
  });

  client.on("message", async (message) => {
    try {
      await handleIncomingMessage(message);
    } catch (error) {
      botState.lastError = error.message;
      console.log("[whatsapp] erro ao processar mensagem:", error.message);
    }
  });

  client.initialize().catch((error) => {
    botState.lastError = error.message;
    botState.connected = false;
    botState.lastUpdatedAt = new Date().toISOString();
    console.log("[whatsapp] erro ao inicializar:", error.message);
  });
};

export const getWhatsAppStatus = () => ({
  enabled: botState.enabled,
  initialized: botState.initialized,
  connected: botState.connected,
  hasQr: Boolean(botState.qrPngBuffer),
  qrPagePath: "/api/whatsapp/qr",
  qrImagePath: "/api/whatsapp/qr.png",
  updatedAt: botState.lastUpdatedAt,
  lastDisconnectReason: botState.lastDisconnectReason,
  lastError: botState.lastError
});

export const getWhatsAppQrPngBuffer = () => botState.qrPngBuffer;

export const getWhatsAppQrPage = () => {
  const status = getWhatsAppStatus();

  if (!botState.enabled) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WhatsApp desativado</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f2e8; font-family: Arial, sans-serif; color: #1d2628; }
      main { max-width: 520px; padding: 32px; border-radius: 24px; background: #fffaf2; box-shadow: 0 18px 40px rgba(29, 38, 40, 0.12); text-align: center; }
    </style>
  </head>
  <body>
    <main>
      <h1>WhatsApp desativado</h1>
      <p>Defina <code>WHATSAPP_ENABLED=true</code> para iniciar o bot e gerar o QR Code.</p>
    </main>
  </body>
</html>`;
  }

  if (botState.qrDataUrl) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="15" />
    <title>QR Code WhatsApp</title>
    <style>
      :root { color-scheme: light; --bg: #f6f2e8; --card: #fffaf2; --text: #1d2628; --muted: #617074; --accent: #10825a; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at top, #fff2d5 0, transparent 32%), linear-gradient(180deg, #fff8ef 0%, var(--bg) 100%); font-family: Arial, sans-serif; color: var(--text); }
      main { width: min(100%, 560px); padding: 28px; border-radius: 28px; background: var(--card); box-shadow: 0 18px 40px rgba(29, 38, 40, 0.12); text-align: center; }
      img { width: min(100%, 420px); border-radius: 18px; background: #fff; padding: 14px; }
      p { color: var(--muted); line-height: 1.5; }
      .status { display: inline-block; margin-top: 14px; padding: 8px 12px; border-radius: 999px; background: rgba(16, 130, 90, 0.12); color: var(--accent); font-weight: bold; }
    </style>
  </head>
  <body>
    <main>
      <h1>Escaneie o QR Code</h1>
      <p>Abra esta pagina no celular ou no computador. Ela atualiza sozinha para facilitar o pareamento.</p>
      <img src="/api/whatsapp/qr.png?t=${encodeURIComponent(status.updatedAt || "")}" alt="QR Code do WhatsApp" />
      <div class="status">Atualizado em: ${status.updatedAt || "-"}</div>
    </main>
  </body>
</html>`;
  }

  if (botState.connected) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="20" />
    <title>WhatsApp conectado</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #eaf8f0; font-family: Arial, sans-serif; color: #14532d; }
      main { max-width: 520px; padding: 32px; border-radius: 24px; background: #fcfffd; box-shadow: 0 18px 40px rgba(20, 83, 45, 0.12); text-align: center; }
    </style>
  </head>
  <body>
    <main>
      <h1>WhatsApp conectado</h1>
      <p>O bot ja esta autenticado e pronto para receber e enviar mensagens.</p>
    </main>
  </body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="10" />
    <title>Aguardando QR</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f2e8; font-family: Arial, sans-serif; color: #1d2628; }
      main { max-width: 520px; padding: 32px; border-radius: 24px; background: #fffaf2; box-shadow: 0 18px 40px rgba(29, 38, 40, 0.12); text-align: center; }
      p { color: #617074; }
    </style>
  </head>
  <body>
    <main>
      <h1>Aguardando QR Code</h1>
      <p>Assim que o WhatsApp gerar um novo QR, esta pagina vai exibir a imagem automaticamente.</p>
    </main>
  </body>
</html>`;
};

export const sendWhatsAppText = async ({ phone, message }) => {
  if (!botState.enabled) {
    return { ok: false, mode: "disabled", error: "WHATSAPP_ENABLED=false" };
  }

  if (!client || !botState.connected) {
    return { ok: false, mode: "offline", error: "Bot WhatsApp ainda nao esta conectado." };
  }

  const chatId = toWhatsAppChatId(phone);

  if (!chatId) {
    return { ok: false, mode: "invalid", error: "Telefone invalido." };
  }

  try {
    const numberId = await client.getNumberId(chatId);
    const resolvedChatId =
      numberId?._serialized ||
      (typeof numberId === "string" ? numberId : "") ||
      chatId;

    await client.sendMessage(resolvedChatId, message);
    botState.lastError = "";
    return { ok: true, mode: "whatsapp-web", chatId: resolvedChatId };
  } catch (error) {
    botState.lastError = error.message;
    return { ok: false, mode: "whatsapp-web", error: error.message };
  }
};

export const sendOrderStatusUpdate = async (order, status) => {
  const settings = getSettings();
  const message = buildOrderStatusMessage(order, status, settings.storeName);
  return sendWhatsAppText({
    phone: normalizePhone(order.customer.phone),
    message
  });
};

export const getCustomerStatusSnapshot = (phone) => {
  const latestOrder = getLatestOrderByPhone(phone);

  if (!latestOrder) {
    return null;
  }

  return {
    orderId: latestOrder.id,
    orderNumber: latestOrder.number,
    status: latestOrder.status,
    statusLabel: STATUS_LABELS[latestOrder.status] || latestOrder.status,
    total: latestOrder.total
  };
};
