// =====================================
// IMPORTAÃ‡Ã•ES
// =====================================
require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const puppeteer = require("puppeteer");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { DefaultOptions } = require("whatsapp-web.js/src/util/Constants");
const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  audioReplyStatusReason,
  audioTranscriptionStatusReason,
  isIncomingAudioMessage,
  shouldSendAudioReply,
  synthesizeSpeech,
  transcribeAudioMessage,
} = require("./audio-service");
let ultimoQr = null;
let qrDataUrl = null;
let qrPngBuffer = null;
let qrAtualizadoEm = null;
let botConectado = false;
let ultimoErroQr = null;
let ultimoErroAuth = null;
let reinicioEmAndamento = false;
let inicializandoCliente = false;
let cacheWwebPreparado = false;
let aiGeminiBloqueada = false;

const runtimeDataDir = path.resolve(
  process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname
);
if (!fs.existsSync(runtimeDataDir)) {
  fs.mkdirSync(runtimeDataDir, { recursive: true });
}
const authDataPath = path.join(runtimeDataDir, ".wwebjs_auth");
const cacheDataPath = path.join(runtimeDataDir, ".wwebjs_cache");
const AUTO_LIMPAR_SESSAO = process.env.WPP_AUTO_CLEAR_SESSION !== "0";
const AUTO_REINICIAR_EM_FALHA = process.env.WPP_AUTO_RESTART_ON_FAIL !== "0";
const WWEB_VERSION = process.env.WWEB_VERSION || DefaultOptions.webVersion;

const escapeHtml = (valor = "") =>
  valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizarChave = (texto = "") =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const limparJson = (texto = "") => String(texto || "").replace(/^\uFEFF/, "");

const bairrosFilePath = path.join(runtimeDataDir, "bairros.json");
const configFilePath = path.join(runtimeDataDir, "config.json");
const catalogoFilePath = path.join(runtimeDataDir, "catalogo.json");
const bundledBairrosFilePath = path.join(__dirname, "bairros.json");
const bundledConfigFilePath = path.join(__dirname, "config.json");
const bundledCatalogoFilePath = path.join(__dirname, "catalogo.json");
const bairrosData = {
  list: [],
  map: {},
  updatedAt: null,
};

const configData = {
  horarioFuncionamento: "",
  enderecoLoja: "",
  ai: {
    enabled: false,
    mode: "fallback",
    provider: "custom",
    endpoint: "",
    authType: "bearer",
    headerName: "Authorization",
    headerValue: "",
    payloadKey: "message",
    responsePath: "",
    apiKey: "",
    model: "",
    temperature: 0.4,
    maxTokens: 600,
    systemPrompt: "",
  },
  updatedAt: null,
};

const normalizarAiConfig = (value = {}) => ({
  ...configData.ai,
  ...(value || {}),
  enabled: Boolean(value?.enabled),
  mode: value?.mode === "always" ? "always" : "fallback",
  provider: value?.provider || "custom",
  endpoint: String(value?.endpoint || ""),
  authType: value?.authType || "bearer",
  headerName: String(value?.headerName || "Authorization"),
  headerValue: String(value?.headerValue || ""),
  payloadKey: String(value?.payloadKey || "message"),
  responsePath: String(value?.responsePath || ""),
  apiKey: String(value?.apiKey || ""),
  model: String(value?.model || ""),
  temperature: Number.isFinite(Number(value?.temperature))
    ? Number(value.temperature)
    : configData.ai.temperature,
  maxTokens: Number.isFinite(Number(value?.maxTokens))
    ? Number(value.maxTokens)
    : configData.ai.maxTokens,
  systemPrompt: String(value?.systemPrompt || ""),
});

const catalogoData = {
  list: [],
  updatedAt: null,
};

const salvarBairros = (lista) => {
  try {
    fs.writeFileSync(
      bairrosFilePath,
      JSON.stringify({ updatedAt: new Date().toISOString(), bairros: lista }, null, 2),
      "utf8"
    );
  } catch (erro) {
    console.log("Erro ao salvar bairros:", erro);
  }
};

const atualizarBairros = (lista) => {
  const bairrosLista = Array.isArray(lista) ? lista : [];
  const mapa = {};

  bairrosLista.forEach((item) => {
    const nome = String(item?.nome || item?.bairro || item?.name || "").trim();
    if (!nome) return;
    const chave = normalizarChave(nome);
    const taxa = Number(
      item?.taxaEntrega ?? item?.taxa ?? item?.taxa_entrega ?? item?.valor ?? 0
    );
    mapa[chave] = Number.isNaN(taxa) ? 0 : taxa;
  });

  bairrosData.list = bairrosLista;
  bairrosData.map = mapa;
  bairrosData.updatedAt = new Date().toISOString();
};

const carregarBairrosDoArquivo = () => {
  try {
    const sourcePath = fs.existsSync(bairrosFilePath)
      ? bairrosFilePath
      : fs.existsSync(bundledBairrosFilePath)
        ? bundledBairrosFilePath
        : "";
    if (!sourcePath) return false;
    const raw = limparJson(fs.readFileSync(sourcePath, "utf8"));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const lista = Array.isArray(parsed) ? parsed : parsed?.bairros;
    if (!Array.isArray(lista)) return false;
    atualizarBairros(lista);
    return true;
  } catch (erro) {
    console.log("Erro ao ler bairros do arquivo:", erro);
    return false;
  }
};

const carregarConfigDoArquivo = () => {
  try {
    const sourcePath = fs.existsSync(configFilePath)
      ? configFilePath
      : fs.existsSync(bundledConfigFilePath)
        ? bundledConfigFilePath
        : "";
    if (!sourcePath) return false;
    const raw = limparJson(fs.readFileSync(sourcePath, "utf8"));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;
    configData.horarioFuncionamento = String(parsed.horarioFuncionamento || "");
    configData.enderecoLoja = String(parsed.enderecoLoja || "");
    const aiPayload = parsed.ai || parsed.chatbotAi || {};
    configData.ai = normalizarAiConfig(aiPayload);
    configData.updatedAt = parsed.updatedAt || new Date().toISOString();
    return true;
  } catch (erro) {
    console.log("Erro ao ler configuracoes do arquivo:", erro);
    return false;
  }
};

const salvarConfig = (payload) => {
  try {
    fs.writeFileSync(
      configFilePath,
      JSON.stringify(
        {
          horarioFuncionamento: payload.horarioFuncionamento || "",
          enderecoLoja: payload.enderecoLoja || "",
          ai: normalizarAiConfig(payload.ai || configData.ai),
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (erro) {
    console.log("Erro ao salvar configuracoes:", erro);
  }
};

const salvarCatalogo = (lista) => {
  try {
    fs.writeFileSync(
      catalogoFilePath,
      JSON.stringify({ updatedAt: new Date().toISOString(), itens: lista }, null, 2),
      "utf8"
    );
  } catch (erro) {
    console.log("Erro ao salvar catalogo:", erro);
  }
};

const atualizarCatalogo = (lista) => {
  const itensLista = Array.isArray(lista) ? lista : [];
  catalogoData.list = itensLista;
  catalogoData.updatedAt = new Date().toISOString();
};

const carregarCatalogoDoArquivo = () => {
  try {
    const sourcePath = fs.existsSync(catalogoFilePath)
      ? catalogoFilePath
      : fs.existsSync(bundledCatalogoFilePath)
        ? bundledCatalogoFilePath
        : "";
    if (!sourcePath) return false;
    const raw = limparJson(fs.readFileSync(sourcePath, "utf8"));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const lista = Array.isArray(parsed) ? parsed : parsed?.itens;
    if (!Array.isArray(lista)) return false;
    atualizarCatalogo(lista);
    return true;
  } catch (erro) {
    console.log("Erro ao ler catalogo do arquivo:", erro);
    return false;
  }
};

// =====================================
// CLIENTE WHATSAPP
// =====================================
let chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || "";
try {
  if (!chromePath && typeof puppeteer.executablePath === "function") {
    chromePath = puppeteer.executablePath();
  }
} catch (erro) {
  chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || "";
}

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: authDataPath,
  }),
  webVersion: WWEB_VERSION,
  webVersionCache: {
    type: "local",
    path: cacheDataPath,
  },
  puppeteer: {
    headless: true,
    executablePath: chromePath || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  },
});

const baixarHtml = (url) =>
  new Promise((resolve, reject) => {
    const solicitar = (alvo) => {
      https
        .get(
          alvo,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept-Encoding": "identity",
            },
          },
          (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              solicitar(res.headers.location);
              return;
            }
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () => resolve(data));
          }
        )
        .on("error", reject);
    };
    solicitar(url);
  });

const prepararCacheWweb = async () => {
  if (cacheWwebPreparado) return;
  cacheWwebPreparado = true;
  try {
    if (!fs.existsSync(cacheDataPath)) {
      fs.mkdirSync(cacheDataPath, { recursive: true });
    }
    const cacheFile = path.join(cacheDataPath, `${WWEB_VERSION}.html`);
    if (fs.existsSync(cacheFile)) return;
    console.log(`Baixando pagina do WhatsApp Web para cache (${WWEB_VERSION})...`);
    const html = await baixarHtml("https://web.whatsapp.com/");
    if (html && html.toLowerCase().includes("<html")) {
      fs.writeFileSync(cacheFile, html, "utf8");
      console.log("Cache do WhatsApp Web salvo.");
    } else {
      console.log("Aviso: nao foi possivel salvar o cache do WhatsApp Web.");
    }
  } catch (erro) {
    console.log("Aviso: falha ao preparar cache do WhatsApp Web:", erro?.message || erro);
  }
};

// =====================================
// QR CODE
// =====================================
client.on("qr", (qr) => {
  console.log("ðŸ“² Escaneie o QR Code:");
  qrcode.generate(qr, { small: false });
});

// =====================================
// BOT ONLINE
// =====================================
client.on("ready", () => {
  console.log("âœ… BOT ONLINE COM SUCESSO");
});

client.on("authenticated", () => {
  console.log("ðŸ” WhatsApp autenticado com sucesso");
});

client.on("auth_failure", (msg) => {
  botConectado = false;
  ultimoErroAuth = String(msg || "Falha de autenticacao");
  ultimoQr = null;
  qrDataUrl = null;
  qrPngBuffer = null;
  console.log("âŒ Falha de autenticaÃ§Ã£o:", msg);

  if (AUTO_REINICIAR_EM_FALHA) {
    reiniciarCliente(ultimoErroAuth, { limparSessao: AUTO_LIMPAR_SESSAO });
  }
});

// =====================================
// DESCONEXÃƒO
// =====================================
client.on("disconnected", (reason) => {
  console.log("âš ï¸ WhatsApp desconectado:", reason);
});

// =====================================
// INICIAR BOT
// =====================================
const atualizarQrImagem = async (qr) => {
  botConectado = false;
  ultimoQr = qr;
  qrAtualizadoEm = new Date().toISOString();
  ultimoErroAuth = null;

  try {
    const opcoesQr = {
      errorCorrectionLevel: "H",
      margin: 2,
      scale: 12,
      width: 420,
      type: "image/png",
    };

    qrDataUrl = await QRCode.toDataURL(qr, opcoesQr);
    qrPngBuffer = await QRCode.toBuffer(qr, opcoesQr);
    ultimoErroQr = null;
    console.log("QR Code atualizado. Abra a rota /qr no Railway para escanear.");
  } catch (erro) {
    qrDataUrl = null;
    qrPngBuffer = null;
    ultimoErroQr = erro?.message || String(erro);
    console.log("Erro ao gerar imagem do QR:", erro);
  }
};

const limparSessaoLocal = () => {
  try {
    if (fs.existsSync(authDataPath)) {
      fs.rmSync(authDataPath, { recursive: true, force: true });
    }
    if (fs.existsSync(cacheDataPath)) {
      fs.rmSync(cacheDataPath, { recursive: true, force: true });
    }
    console.log("Sessao local removida (.wwebjs_auth/.wwebjs_cache).");
  } catch (erro) {
    console.log("Erro ao limpar sessao local:", erro);
  }
};

const iniciarCliente = async () => {
  if (inicializandoCliente) return;
  inicializandoCliente = true;
  try {
    await prepararCacheWweb();
    await Promise.resolve(client.initialize());
  } catch (erro) {
    const mensagem = erro?.message || String(erro);
    ultimoErroAuth = mensagem;
    console.log("Erro ao iniciar WhatsApp:", mensagem);
    if (AUTO_REINICIAR_EM_FALHA) {
      reiniciarCliente(mensagem, { limparSessao: false });
    }
  } finally {
    inicializandoCliente = false;
  }
};

const reiniciarCliente = async (motivo, { limparSessao = false } = {}) => {
  if (reinicioEmAndamento) return;
  reinicioEmAndamento = true;

  if (motivo) {
    console.log("Reiniciando WhatsApp:", motivo);
  } else {
    console.log("Reiniciando WhatsApp.");
  }

  try {
    await Promise.resolve(client.destroy());
  } catch (erro) {
    console.log("Aviso ao destruir cliente:", erro?.message || erro);
  }

  if (limparSessao) {
    limparSessaoLocal();
  }

  setTimeout(async () => {
    try {
      await iniciarCliente();
    } finally {
      reinicioEmAndamento = false;
    }
  }, 2000);
};

client.on("qr", atualizarQrImagem);

client.on("ready", () => {
  botConectado = true;
  ultimoQr = null;
  qrDataUrl = null;
  qrPngBuffer = null;
  qrAtualizadoEm = new Date().toISOString();
  ultimoErroAuth = null;
  ultimoErroQr = null;
});

client.on("disconnected", () => {
  botConectado = false;
  ultimoQr = null;
  qrDataUrl = null;
  qrPngBuffer = null;
});

const porta = Number(process.env.PORT) || 3001;

const headersSemCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const servidor = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const requestPath = requestUrl.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      ...headersSemCache,
      ...corsHeaders,
    });
    res.end();
    return;
  }

  if (requestPath === "/qr.png") {
    if (!qrPngBuffer) {
      res.writeHead(404, {
        ...headersSemCache,
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify({ status: botConectado ? "conectado" : "aguardando_qr" }));
      return;
    }

    res.writeHead(200, {
      ...headersSemCache,
      ...corsHeaders,
      "Content-Type": "image/png",
      "Content-Length": qrPngBuffer.length,
    });
    res.end(qrPngBuffer);
    return;
  }

  if (requestPath === "/bairros" && req.method === "GET") {
    res.writeHead(200, {
      ...headersSemCache,
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(
      JSON.stringify({
        status: "success",
        updatedAt: bairrosData.updatedAt,
        bairros: bairrosData.list,
      })
    );
    return;
  }

  if (requestPath === "/bairros" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const lista = Array.isArray(parsed) ? parsed : parsed?.bairros;
        if (!Array.isArray(lista)) {
          res.writeHead(400, {
            ...headersSemCache,
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
          });
          res.end(JSON.stringify({ status: "error", message: "Lista de bairros invalida." }));
          return;
        }

        atualizarBairros(lista);
        salvarBairros(lista);
        console.log(`âœ… Bairros sincronizados: ${lista.length}`);

        res.writeHead(200, {
          ...headersSemCache,
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify({ status: "success", total: lista.length }));
      } catch (erro) {
        res.writeHead(500, {
          ...headersSemCache,
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify({ status: "error", message: "Falha ao salvar bairros." }));
      }
    });
    return;
  }

  if (requestPath === "/catalogo" && req.method === "GET") {
    res.writeHead(200, {
      ...headersSemCache,
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(
      JSON.stringify({
        status: "success",
        updatedAt: catalogoData.updatedAt,
        itens: catalogoData.list,
      })
    );
    return;
  }

  if (requestPath === "/catalogo" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const lista = Array.isArray(parsed) ? parsed : parsed?.itens;
        if (!Array.isArray(lista)) {
          res.writeHead(400, {
            ...headersSemCache,
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
          });
          res.end(JSON.stringify({ status: "error", message: "Catalogo invalido." }));
          return;
        }

        atualizarCatalogo(lista);
        salvarCatalogo(lista);
        console.log(`Catalogo sincronizado: ${lista.length} itens`);

        res.writeHead(200, {
          ...headersSemCache,
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify({ status: "success", total: lista.length }));
      } catch (erro) {
        res.writeHead(500, {
          ...headersSemCache,
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(
          JSON.stringify({ status: "error", message: "Falha ao salvar catalogo." })
        );
      }
    });
    return;
  }

  if (requestPath === "/config" && req.method === "GET") {
    const aiResponse = {
      ...configData.ai,
      apiKey: configData.ai.apiKey ? "********" : "",
    };
    res.writeHead(200, {
      ...headersSemCache,
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(
      JSON.stringify({
        status: "success",
        horarioFuncionamento: configData.horarioFuncionamento,
        enderecoLoja: configData.enderecoLoja,
        ai: aiResponse,
        updatedAt: configData.updatedAt,
      })
    );
    return;
  }

  if (requestPath === "/config" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const hasHorario = Object.prototype.hasOwnProperty.call(parsed, "horarioFuncionamento");
        const hasEndereco = Object.prototype.hasOwnProperty.call(parsed, "enderecoLoja");

        if (hasHorario) {
          configData.horarioFuncionamento = String(parsed.horarioFuncionamento || "");
        }
        if (hasEndereco) {
          configData.enderecoLoja = String(parsed.enderecoLoja || "");
        }

        const aiPayload = parsed.ai || parsed.chatbotAi;
        if (aiPayload && typeof aiPayload === "object") {
          configData.ai = normalizarAiConfig({
            ...configData.ai,
            ...aiPayload,
          });
        }
        configData.updatedAt = new Date().toISOString();
        salvarConfig(configData);

        res.writeHead(200, {
          ...headersSemCache,
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify({ status: "success" }));
      } catch (erro) {
        res.writeHead(500, {
          ...headersSemCache,
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify({ status: "error", message: "Falha ao salvar configuracoes." }));
      }
    });
    return;
  }

  if (requestPath === "/qr") {
    const qrSrc = qrDataUrl
      ? qrDataUrl
      : `/qr.png?t=${encodeURIComponent(qrAtualizadoEm || "")}`;
    const pagina = qrDataUrl
      ? `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="15" />
    <title>QR Code WhatsApp</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe6;
        --card: #fffdf8;
        --text: #1f2937;
        --muted: #6b7280;
        --accent: #1d9b5f;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top, #fff7df 0, transparent 35%),
          linear-gradient(180deg, #f8f1e7 0%, var(--bg) 100%);
        font-family: Arial, sans-serif;
        color: var(--text);
        padding: 24px;
      }
      main {
        width: min(100%, 560px);
        background: var(--card);
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 18px 40px rgba(31, 41, 55, 0.12);
        text-align: center;
      }
      img {
        width: min(100%, 420px);
        height: auto;
        background: #fff;
        border-radius: 18px;
        padding: 16px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
      }
      p {
        margin: 0 0 12px;
        color: var(--muted);
        line-height: 1.5;
      }
      .status {
        display: inline-block;
        margin-top: 16px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(29, 155, 95, 0.12);
        color: var(--accent);
        font-size: 14px;
        font-weight: bold;
      }
      code {
        display: block;
        margin-top: 16px;
        word-break: break-all;
        color: var(--muted);
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Escaneie o QR Code</h1>
      <p>Abra esta pagina no celular ou no computador. Ela recarrega sozinha e usa uma imagem PNG sem cache para facilitar a leitura.</p>
      <img src="${qrSrc}" alt="QR Code do WhatsApp" />
      <div class="status">Atualizado em: ${escapeHtml(qrAtualizadoEm || "")}</div>
      <code>/qr.png</code>
    </main>
  </body>
</html>`
      : botConectado
      ? `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="20" />
    <title>WhatsApp Conectado</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top, #e8fff2 0, transparent 35%),
          linear-gradient(180deg, #effaf3 0%, #e5f7eb 100%);
        font-family: Arial, sans-serif;
        padding: 24px;
        text-align: center;
        color: #14532d;
      }
      main {
        max-width: 480px;
        background: #fcfffd;
        border-radius: 24px;
        padding: 28px;
        box-shadow: 0 18px 40px rgba(20, 83, 45, 0.12);
      }
      .status {
        display: inline-block;
        margin-top: 12px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(22, 163, 74, 0.14);
        color: #15803d;
        font-size: 14px;
        font-weight: bold;
      }
      p {
        color: #166534;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>WhatsApp conectado</h1>
      <p>O bot ja esta autenticado. Nao e preciso escanear um novo QR agora.</p>
      <div class="status">Atualizado em: ${escapeHtml(qrAtualizadoEm || new Date().toISOString())}</div>
    </main>
  </body>
</html>`
      : `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="10" />
    <title>QR Code WhatsApp</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f4efe6;
        font-family: Arial, sans-serif;
        padding: 24px;
        text-align: center;
        color: #1f2937;
      }
      main {
        max-width: 480px;
        background: #fffdf8;
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 18px 40px rgba(31, 41, 55, 0.12);
      }
      p {
        color: #6b7280;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Aguardando QR Code</h1>
      <p>Assim que o WhatsApp gerar um novo QR, esta pagina vai exibir a imagem automaticamente.</p>
      ${
        ultimoErroAuth || ultimoErroQr
          ? `<p><strong>Detalhe:</strong> ${escapeHtml(ultimoErroAuth || ultimoErroQr)}</p>`
          : ""
      }
    </main>
  </body>
</html>`;

    res.writeHead(200, {
      ...headersSemCache,
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
    });
    res.end(pagina);
    return;
  }

  const status = ultimoQr ? "qr_disponivel" : botConectado ? "conectado" : "aguardando_qr";

  res.writeHead(200, {
    ...headersSemCache,
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify({ status, qrPagePath: "/qr", qrImagePath: "/qr.png", updatedAt: qrAtualizadoEm }));
});

const iniciarServidor = (portaInicial) => {
  let portaAtual = portaInicial;
  const tentar = () => {
    servidor.listen(portaAtual, () => {
      console.log(`Painel do QR ativo na porta ${portaAtual}. Use /qr para abrir a imagem.`);
      console.log(`Diretorio de dados do bot: ${runtimeDataDir}`);
    });
  };

  servidor.on("error", (erro) => {
    if (erro.code === "EADDRINUSE") {
      const antiga = portaAtual;
      portaAtual += 1;
      console.log(`âš ï¸ Porta ${antiga} em uso. Tentando porta ${portaAtual}...`);
      setTimeout(tentar, 500);
      return;
    }

    console.log("âŒ Erro no servidor HTTP:", erro);
  });

  tentar();
};

iniciarServidor(porta);

iniciarCliente();

// =====================================
// CONTROLES
// =====================================
const sessions = new Map();
const antiSpam = new Map();

// =====================================
// LINK DO CARDÃPIO
// =====================================
const linkPrincipal = "https://instadelivery.com.br/fortindelivery";

// =====================================
// PALAVRAS-CHAVE DE VENDA
// =====================================
const gatilhosMenu = /^(menu|oi|ola|bom dia|boa tarde|boa noite|pedido|opa)$/i;
const gatilhosCompra = [
  "cerveja",
  "cervejas",
  "bebida",
  "bebidas",
  "whisky",
  "vodka",
  "gin",
  "energetico",
  "refrigerante",
  "refri",
  "agua",
  "suco",
  "carvao",
  "gelo",
  "comprar",
  "pedir",
  "pedido",
];
const gatilhosAgradecimento = [
  "obrigado",
  "obrigada",
  "obg",
  "obgd",
  "obgdo",
  "obgda",
  "obrigadÃ£o",
  "obrigadao",
  "valeu",
  "agradecido",
  "agradecida",
  "tmj",
  "show",
];
const gatilhosCordialidade = [
  "tudo bem",
  "tudo certo",
  "tudo ok",
  "tudo tranquilo",
  "como vai",
  "como voce esta",
  "como voce ta",
  "como vc ta",
  "e ai",
  "eai",
  "opa tudo bem",
];
const gatilhosConfirmacao = ["ok", "okay", "blz", "beleza", "certo", "fechou", "top"];
const gatilhosDespedida = ["ate mais", "atÃ© mais", "tchau", "falou", "fui", "boa noite", "bom descanso"];
const gatilhosPosterior = [
  "vou pedir depois",
  "depois eu peÃ§o",
  "depois eu faco",
  "mais tarde eu peco",
  "mais tarde eu peÃ§o",
  "vou ver depois",
];
const gatilhosCardapio = [
  "manda o cardapio",
  "me manda o cardapio",
  "envia o cardapio",
  "quero ver o cardapio",
  "cardapio",
];

const gatilhosConsultoria = [
  "quantidade",
  "quantidades",
  "quantos",
  "quantas",
  "pessoas",
  "pessoa",
  "qtd",
  "qtde",
  "evento",
  "festa",
  "aniversario",
  "churrasco",
  "final de semana",
  "mix",
  "misto",
  "combo",
  "consultoria",
  "sugestao",
  "sugestoes",
  "montar pedido",
];
const gatilhosOrcamento = ["orcamento", "preco", "valor", "custa", "quanto fica"];

// =====================================
// NORMALIZAR TEXTO
// =====================================
const normalizarTexto = (texto) => normalizarChave(texto);
const extrairNumeros = (texto = "") => {
  const encontrados = [];
  const regex = /\d{1,4}/g;
  let match = regex.exec(texto);
  while (match) {
    encontrados.push(Number(match[0]));
    match = regex.exec(texto);
  }
  return encontrados.filter((numero) => Number.isFinite(numero));
};

const corrigirTextoPossivelmenteMalCodificado = (texto = "") => {
  if (typeof texto !== "string") return "";
  const suspeito = /Ã|Â|�/.test(texto);
  if (!suspeito) return texto;
  try {
    const corrigido = Buffer.from(texto, "latin1").toString("utf8");
    if (corrigido.includes("�")) return texto;
    return corrigido;
  } catch {
    return texto;
  }
};

const normalizarParaBusca = (texto = "") => {
  const corrigido = corrigirTextoPossivelmenteMalCodificado(texto);
  return normalizarChave(corrigido)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const stopwordsCatalogo = new Set([
  "tem",
  "ai",
  "aqui",
  "disponivel",
  "disponibilidade",
  "estoque",
  "vende",
  "vendem",
  "voces",
  "voce",
  "vc",
  "o",
  "a",
  "os",
  "as",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "por",
  "pra",
  "pro",
  "com",
  "sem",
  "tem",
  "temos",
  "tem ai",
  "tem esse",
  "tem essa",
  "tem este",
  "tem esta",
]);

const extrairTokensCatalogo = (texto = "") => {
  const tokens = normalizarParaBusca(texto)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !stopwordsCatalogo.has(token));
  return tokens;
};

const buscaCatalogoPorTokens = (tokens = []) => {
  if (!tokens.length) return [];
  return catalogoData.list.filter((item) => {
    if (!item || item.ativo === false) return false;
    const nome = normalizarParaBusca(item.nome || "");
    if (!nome) return false;
    return tokens.every((token) => nome.includes(token));
  });
};

const montarRespostaDisponibilidade = (itens, tokensBusca) => {
  if (!Array.isArray(itens) || !itens.length) {
    if (!tokensBusca.length) return null;
    return "Nao encontrei esse item no catalogo. Pode me dizer o nome exato?";
  }

  const nomeFormatado = (item) => corrigirTextoPossivelmenteMalCodificado(item?.nome || "");
  const precoFormatado = (item) => {
    const preco = Number(item?.preco);
    return Number.isFinite(preco) && preco > 0 ? `R$ ${formatarPreco(preco)}` : null;
  };

  if (itens.length === 1) {
    const item = itens[0];
    const estoque = Number(item?.estoque);
    const nome = nomeFormatado(item) || "Item";
    const preco = precoFormatado(item);
    if (Number.isFinite(estoque)) {
      if (estoque > 0) {
        return `Sim, temos ${nome}${preco ? `. Preco: ${preco}` : ""}.`;
      }
      return `No momento nao temos ${nome}.`;
    }
    return `Temos ${nome}${preco ? ` (preco ${preco})` : ""}.`;
  }

  const linhas = itens.slice(0, 5).map((item) => {
    const nome = nomeFormatado(item) || "Item";
    const estoque = Number(item?.estoque);
    const preco = precoFormatado(item);
    const disponibilidade = Number.isFinite(estoque)
      ? estoque > 0
        ? "disponivel"
        : "indisponivel"
      : "disponibilidade nao informada";
    return `- ${nome}${preco ? ` (${preco})` : ""} - ${disponibilidade}`;
  });

  return `Encontrei mais de um item com esse nome:\n${linhas.join("\n")}\nQual deles voce quer?`;
};

const respostaCatalogoSeAplicavel = (textoOriginal = "") => {
  const textoNormalizado = normalizarParaBusca(textoOriginal);
  if (!textoNormalizado) return null;
  const pareceConsulta =
    /\b(tem|disponivel|disponibilidade|estoque|vende|vendem)\b/.test(textoNormalizado) ||
    /\b(voces vendem|voce vende|vc vende)\b/.test(textoNormalizado);
  if (!pareceConsulta) return null;
  const tokens = extrairTokensCatalogo(textoOriginal);
  if (!tokens.length) return null;
  const itens = buscaCatalogoPorTokens(tokens);
  return montarRespostaDisponibilidade(itens, tokens);
};

const classificarPerfilCompra = (textoNormalizado = "") => {
  const texto = String(textoNormalizado);
  if (
    texto.includes("sem alcool") ||
    texto.includes("semalcool") ||
    texto.includes("nao bebo") ||
    texto.includes("refri") ||
    texto.includes("refrigerante") ||
    texto.includes("agua")
  ) {
    return "sem_alcool";
  }
  if (
    texto.includes("destilado") ||
    texto.includes("whisky") ||
    texto.includes("vodka") ||
    texto.includes("gin")
  ) {
    return "destilados";
  }
  if (texto.includes("misto") || texto.includes("mix")) {
    return "misto";
  }
  if (texto.includes("cerveja")) {
    return "cerveja";
  }
  return null;
};

const formatarPreco = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return numero.toFixed(2).replace(".", ",");
};

const selecionarItemCatalogo = (categoria) => {
  const alvo = normalizarChave(categoria);
  const candidatos = catalogoData.list.filter((item) => {
    if (!item || item.ativo === false) return false;
    const categoriaItem = normalizarChave(item.categoria || item.tipo || "");
    return categoriaItem === alvo;
  });

  if (!candidatos.length) return null;

  let escolhido = candidatos[0];
  let menorPreco = Number.isFinite(Number(escolhido.preco))
    ? Number(escolhido.preco)
    : Number.POSITIVE_INFINITY;

  candidatos.forEach((item) => {
    const preco = Number(item.preco);
    if (Number.isFinite(preco) && preco > 0 && preco < menorPreco) {
      menorPreco = preco;
      escolhido = item;
    }
  });

  return escolhido;
};

const montarEstimativaCatalogo = (sugestao) => {
  const linhas = [];
  const avisos = [];
  let total = 0;

  const adicionarItem = (item, quantidade, labelFallback) => {
    if (!item || quantidade <= 0) {
      if (quantidade > 0) {
        avisos.push(`Sem item de ${labelFallback} no catalogo.`);
      }
      return;
    }

    const nome = item.nome || labelFallback;
    const preco = Number(item.preco);
    const possuiPreco = Number.isFinite(preco) && preco > 0;
    let subtotal = null;
    if (possuiPreco) {
      subtotal = preco * quantidade;
      total += subtotal;
    }

    const estoque = Number(item.estoque);
    if (Number.isFinite(estoque) && estoque > 0 && quantidade > estoque) {
      avisos.push(`Estoque baixo de ${nome} (disponivel ${estoque}).`);
    }

    const precoStr = possuiPreco ? `R$ ${formatarPreco(preco)}` : "preco nao informado";
    const subtotalStr = possuiPreco ? `R$ ${formatarPreco(subtotal)}` : "total sob consulta";
    linhas.push(`- ${nome}: ${quantidade} x ${precoStr} = ${subtotalStr}`);
  };

  if (sugestao.cervejaLatas > 0) {
    const item = selecionarItemCatalogo("cerveja");
    adicionarItem(item, sugestao.cervejaLatas, "cerveja");
  }

  if (sugestao.destiladosGarrafas > 0) {
    const item = selecionarItemCatalogo("destilado");
    adicionarItem(item, sugestao.destiladosGarrafas, "destilados");
  }

  if (sugestao.naoAlcoolLitros > 0) {
    const item = selecionarItemCatalogo("nao alcool");
    if (!item) {
      avisos.push("Sem item de nao alcool no catalogo.");
    } else {
      const volumeMl = Number(item.volumeMl) || 2000;
      const unidades = Math.max(
        1,
        Math.ceil((sugestao.naoAlcoolLitros * 1000) / volumeMl)
      );
      adicionarItem(item, unidades, "nao alcool");
    }
  }

  if (sugestao.geloSacos > 0) {
    const item = selecionarItemCatalogo("gelo");
    adicionarItem(item, sugestao.geloSacos, "gelo");
  }

  return {
    linhas,
    avisos,
    total: total > 0 ? total : null,
  };
};

const calcularSugestaoCompra = ({ pessoas, duracao, perfil }) => {
  const perfilFinal = perfil || "misto";
  const horas = Math.max(1, Number(duracao) || 1);
  const totalPessoas = Math.max(1, Number(pessoas) || 1);

  const taxaCervejaPorHora = {
    cerveja: 1.0,
    misto: 0.7,
    destilados: 0.4,
    sem_alcool: 0,
  };

  const taxaNaoAlcoolPorHora = {
    cerveja: 0.3,
    misto: 0.5,
    destilados: 0.4,
    sem_alcool: 0.7,
  };

  const cervejaLatas = Math.ceil(totalPessoas * horas * taxaCervejaPorHora[perfilFinal]);
  const naoAlcoolLitros = Math.ceil(
    totalPessoas * horas * taxaNaoAlcoolPorHora[perfilFinal]
  );
  const geloSacos = Math.max(1, Math.ceil(totalPessoas / 5) + (horas > 4 ? 1 : 0));

  let destiladosGarrafas = 0;
  if (perfilFinal === "destilados") {
    destiladosGarrafas = Math.max(1, Math.ceil(totalPessoas / 10));
  } else if (perfilFinal === "misto") {
    destiladosGarrafas = Math.max(1, Math.ceil(totalPessoas / 18));
  }

  return {
    perfil: perfilFinal,
    cervejaLatas,
    naoAlcoolLitros,
    geloSacos,
    destiladosGarrafas,
  };
};

const montarResumoConsultoria = ({ pessoas, duracao, perfil }) => {
  const sugestao = calcularSugestaoCompra({ pessoas, duracao, perfil });
  const perfilLabel = {
    cerveja: "mais cerveja",
    misto: "misto",
    destilados: "mais destilados",
    sem_alcool: "sem alcool",
  }[sugestao.perfil];

  const linhas = [
    `Perfeito! Para ${pessoas} pessoas e ${duracao} horas (${perfilLabel}),`,
    "minha sugestao inicial e:",
  ];

  if (sugestao.cervejaLatas > 0) {
    linhas.push(`- Cerveja: ~${sugestao.cervejaLatas} latas (350ml) ou equivalente`);
  }
  if (sugestao.destiladosGarrafas > 0) {
    linhas.push(
      `- Destilados: ~${sugestao.destiladosGarrafas} garrafas (1L) para o mix`
    );
  }
  linhas.push(`- Sem alcool: ~${sugestao.naoAlcoolLitros} L de agua/refri`);
  linhas.push(`- Gelo: ~${sugestao.geloSacos} sacos de 2kg`);
  linhas.push("");
  const estimativa = montarEstimativaCatalogo(sugestao);
  if (estimativa.linhas.length) {
    linhas.push("Estimativa com base no catalogo:");
    linhas.push(...estimativa.linhas);
    if (estimativa.total) {
      linhas.push(`Total estimado: R$ ${formatarPreco(estimativa.total)}`);
    }
    if (estimativa.avisos.length) {
      linhas.push("Observacoes:");
      estimativa.avisos.forEach((aviso) => linhas.push(`- ${aviso}`));
    }
    linhas.push("");
  } else if (estimativa.avisos.length) {
    linhas.push(`Obs: ${estimativa.avisos.join(" ")}`);
    linhas.push("");
  }
  linhas.push("Se quiser, me diga marcas preferidas ou um orcamento e eu ajusto.");
  linhas.push(`Cardapio rapido: ${linkPrincipal}`);
  linhas.push("Consumo responsavel.");

  return linhas.join("\n");
};

// =====================================
// BAIRROS
// =====================================

const catalogoPadrao = [
  {
    id: "cerveja_lata_350",
    nome: "Cerveja lata 350ml",
    categoria: "cerveja",
    unidade: "lata",
    volumeMl: 350,
    preco: 5.0,
    estoque: 0,
    ativo: true,
  },
  {
    id: "destilado_1l",
    nome: "Destilado 1L (vodka/whisky/gin)",
    categoria: "destilado",
    unidade: "garrafa",
    volumeMl: 1000,
    preco: 79.0,
    estoque: 0,
    ativo: true,
  },
  {
    id: "refrigerante_2l",
    nome: "Refrigerante 2L",
    categoria: "nao alcool",
    unidade: "garrafa",
    volumeMl: 2000,
    preco: 9.0,
    estoque: 0,
    ativo: true,
  },
  {
    id: "agua_500",
    nome: "Agua 500ml",
    categoria: "nao alcool",
    unidade: "garrafa",
    volumeMl: 500,
    preco: 3.0,
    estoque: 0,
    ativo: true,
  },
  {
    id: "gelo_2kg",
    nome: "Gelo 2kg",
    categoria: "gelo",
    unidade: "saco",
    pesoKg: 2,
    preco: 6.0,
    estoque: 0,
    ativo: true,
  },
];

if (!carregarBairrosDoArquivo()) {
  const listaPadrao = Object.entries(bairrosPadrao).map(([nome, taxaEntrega]) => ({
    nome,
    taxaEntrega,
  }));
  atualizarBairros(listaPadrao);
}

if (!carregarCatalogoDoArquivo()) {
  atualizarCatalogo(catalogoPadrao);
  salvarCatalogo(catalogoPadrao);
}

carregarConfigDoArquivo();

// =====================================
// MENSAGENS
// =====================================
const horarioFuncionamento = '';
const enderecoLoja = '';
const TEMPO_PAUSA_ATENDENTE_MS = 10 * 60 * 1000;

const TIMEZONE_PADRAO = process.env.TZ || "America/Sao_Paulo";

const obterHoraLocal = () => {
  try {
    const partes = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: TIMEZONE_PADRAO,
    }).formatToParts(new Date());
    const hora = partes.find((parte) => parte.type === "hour")?.value;
    return Number(hora);
  } catch (erro) {
    return new Date().getHours();
  }
};

const obterSaudacao = () => {
  const hora = obterHoraLocal();

  if (hora >= 0 && hora <= 11) return "Bom dia";
  if (hora >= 12 && hora <= 17) return "Boa tarde";
  return "Boa noite";
};

const montarMenuPrincipal = () => `${obterSaudacao()}!

Oi! Sou o assistente comercial da Fortin Delivery.
Posso orientar seu pedido e sugerir quantidades.

Cardapio e pedido rapido:
${linkPrincipal}

Escolha uma opcao:
1) Taxa de entrega
2) Bairros atendidos
3) Horario de funcionamento
4) Endereco
5) Falar com atendente`;

const mensagemCompraDireta = `Trabalhamos com bebidas e complementos (gelo, carvao, refrigerante, energetico).

Cardapio:
${linkPrincipal}

Se quiser consultoria de quantidades, responda com:
"10 pessoas, 4 horas, misto"

Ou escolha:
1) Taxa de entrega
2) Bairros atendidos
3) Horario de funcionamento
4) Endereco
5) Falar com atendente`;

const mensagemAtendente = `âœ… Certo! Vou pausar o robÃ´ por 10 minutos para vocÃª conversar com o atendente.

Depois desse perÃ­odo eu volto a responder por aqui.`;
const mensagemAudioNaoEntendido = "Recebi seu audio, mas nao consegui entender. Pode enviar novamente ou escrever por texto.";
const mensagemAgradecimento = `ðŸ˜Š Que bom falar com vocÃª! Muito obrigado pelo carinho.

Sempre que quiser, estou por aqui para ajudar.

Seu cardÃ¡pio estÃ¡ aqui:
ðŸ‘‰ ${linkPrincipal}

Se precisar, digite *menu* para ver as opÃ§Ãµes.`;

const mensagemConfirmacao = `Perfeito! ðŸ‘

Se quiser seguir com seu pedido, Ã© sÃ³ acessar:
ðŸ‘‰ ${linkPrincipal}

Se precisar de ajuda, digite *menu*.`;

const mensagemDespedida = `ðŸ˜Š Combinado! Estaremos por aqui.

Quando quiser pedir sua bebida:
ðŸ‘‰ ${linkPrincipal}

AtÃ© mais!`;

const mensagemCordialidade = `Tudo certo por aqui!

Se quiser, posso te ajudar com seu pedido de bebidas, taxa de entrega, horario ou endereco.

Digite *menu* para ver as opcoes.`;
const mensagemCardapio = `Claro!

Cardapio:
${linkPrincipal}

Se quiser, posso sugerir quantidades. Exemplo:
"12 pessoas, 4 horas, misto"`;
const mensagemConsultoriaInicio = `Posso te ajudar com quantidades e mix.

Responda com algo assim:
"12 pessoas, 4 horas, misto"

Se preferir, comece dizendo quantas pessoas.`;
const mensagemPerguntaPessoas = "Quantas pessoas vao participar?";
const mensagemPerguntaDuracao = "Quantas horas dura o evento?";
const mensagemPerguntaPerfil = "Qual o perfil? (cerveja / destilados / misto / sem alcool)";
const mensagemOrcamento = "Me diga um orcamento aproximado e as bebidas preferidas que eu ajusto a sugestao.";
// =====================================
// DELAY
// =====================================
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// =====================================
// IA - UTILITÃRIOS
// =====================================
const obterValorPorCaminho = (obj, caminho) => {
  if (!caminho || typeof caminho !== "string") return null;
  return caminho.split(".").reduce((acc, key) => {
    if (!acc || typeof acc !== "object") return null;
    return acc[key];
  }, obj);
};

const extrairRespostaAi = (data, responsePath) => {
  if (typeof data === "string") return data.trim();
  if (!data || typeof data !== "object") return null;

  const byPath = obterValorPorCaminho(data, responsePath);
  if (typeof byPath === "string") return byPath.trim();

  const candidatos = ["reply", "message", "text", "output", "answer", "content"];
  for (const campo of candidatos) {
    if (typeof data[campo] === "string") return data[campo].trim();
  }
  return null;
};

const buildAiContext = () => ({
  horarioFuncionamento: configData.horarioFuncionamento,
  enderecoLoja: configData.enderecoLoja,
  linkCardapio: linkPrincipal,
  bairros: bairrosData.list,
  taxasEntrega: bairrosData.map,
  catalogo: catalogoData.list,
  atualizadoEm: {
    bairros: bairrosData.updatedAt,
    catalogo: catalogoData.updatedAt,
    config: configData.updatedAt,
  },
});

const buildSystemPrompt = () => {
  const base = [
    "VocÃª Ã© o assistente virtual da Fortin Delivery.",
    "Responda em portuguÃªs, de forma objetiva e simpÃ¡tica.",
    "Use somente as informacoes do contexto fornecido.",
    "Use bairros e taxas de entrega do contexto para informar valores corretos.",
    "Use o catalogo do contexto para responder sobre produtos e precos.",
    "Quando perguntarem se tem um item, responda se existe no catalogo e informe o estoque (se for 0, diga que esta sem estoque).",
    "Use o horario de funcionamento configurado quando perguntarem.",
    "Se perguntarem taxa por bairro, use o mapa taxasEntrega; se nao encontrar, diga que nao atendemos.",
    "Se nÃ£o souber algo, peÃ§a mais detalhes ao cliente.",
    "Quando a pessoa pedir para comprar, envie o link do cardÃ¡pio.",
  ].join(" ");
  const extra = configData.ai.systemPrompt ? ` ${configData.ai.systemPrompt}` : "";
  return base + extra;
};

const fetchComTimeout = async (url, options, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const gerarRespostaCustom = async (mensagem, contexto) => {
  if (!configData.ai.endpoint) return null;

  const headers = { "Content-Type": "application/json" };
  if (configData.ai.authType === "bearer" && configData.ai.headerValue) {
    headers.Authorization = `Bearer ${configData.ai.headerValue}`;
  } else if (configData.ai.authType === "basic" && configData.ai.headerValue) {
    headers.Authorization = `Basic ${Buffer.from(configData.ai.headerValue).toString("base64")}`;
  } else if (configData.ai.authType === "header" && configData.ai.headerName) {
    headers[configData.ai.headerName] = configData.ai.headerValue || "";
  }

  const payloadKey = configData.ai.payloadKey || "message";
  const payload = {
    [payloadKey]: mensagem,
    contexto,
    system: buildSystemPrompt(),
  };

  const response = await fetchComTimeout(configData.ai.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    return extrairRespostaAi(data, configData.ai.responsePath);
  }

  const text = await response.text();
  return text ? text.trim() : null;
};

const gerarRespostaOpenAI = async (mensagem, contexto) => {
  const apiKey = configData.ai.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const client = new OpenAI({ apiKey });
  const messages = [
    { role: "system", content: `${buildSystemPrompt()}\nContexto: ${JSON.stringify(contexto)}` },
    { role: "user", content: mensagem },
  ];

  const response = await client.chat.completions.create({
    model: configData.ai.model || "gpt-4o-mini",
    messages,
    temperature: configData.ai.temperature,
    max_tokens: configData.ai.maxTokens,
  });

  const content = response?.choices?.[0]?.message?.content;
  return content ? content.trim() : null;
};

const gerarRespostaGemini = async (mensagem, contexto) => {
  if (aiGeminiBloqueada) return null;
  const apiKey = configData.ai.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const modelName = String(
    configData.ai.model || process.env.GEMINI_MODEL || "gemini-2.5-flash"
  ).trim();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
  });
  const prompt = `${buildSystemPrompt()}\nContexto: ${JSON.stringify(contexto)}\nMensagem: ${mensagem}`;
  try {
    const result = await model.generateContent(prompt);
    const text = result?.response?.text();
    return text ? text.trim() : null;
  } catch (erro) {
    const mensagemErro = String(erro?.message || erro);
    if (
      mensagemErro.includes("not found") ||
      mensagemErro.includes("not supported") ||
      mensagemErro.includes("models/")
    ) {
      console.log("IA Gemini desativada: modelo invalido. Ajuste ai.model no config.json.");
      aiGeminiBloqueada = true;
      return null;
    }
    console.log("IA Gemini: falha ao gerar resposta:", mensagemErro);
    return null;
  }
};

const gerarRespostaIA = async (mensagem) => {
  if (!configData.ai.enabled) return null;
  const contexto = buildAiContext();

  try {
    if (configData.ai.provider === "openai") {
      return await gerarRespostaOpenAI(mensagem, contexto);
    }
    if (configData.ai.provider === "gemini") {
      return await gerarRespostaGemini(mensagem, contexto);
    }
    return await gerarRespostaCustom(mensagem, contexto);
  } catch (erro) {
    console.log("Erro IA:", erro?.message || erro);
    return null;
  }
};

// =====================================
// RECEBER MENSAGENS
// =====================================
client.on("message", async (msg) => {

  try {

    // =====================================
    // BLOQUEIOS IMPORTANTES
    // =====================================

    if (!msg.from) return;

    // BLOQUEIA STORIES
    if (msg.from === "status@broadcast") return;

    // BLOQUEIA GRUPOS
    if (msg.from.endsWith("@g.us")) return;

    // BLOQUEIA MENSAGENS DO BOT
    if (msg.fromMe) return;

    const mensagemEhAudio = isIncomingAudioMessage(msg);

    // BLOQUEIA MENSAGEM VAZIA
    if (!msg.body && !mensagemEhAudio) return;

    // =====================================
    // ANTI SPAM
    // =====================================
    const agora = Date.now();
    const ultimo = antiSpam.get(msg.from) || 0;

    if (agora - ultimo < 3000) return;

    antiSpam.set(msg.from, agora);

    const chat = await msg.getChat();
    if (chat.isGroup) return;

    const typing = async () => {
      await chat.sendStateTyping();
      await delay(1500);
    };

    const responderComTexto = async (textoResposta) => {
      await typing();
      await client.sendMessage(msg.from, textoResposta);

      if (!shouldSendAudioReply(msg.type)) return;
      const audio = await synthesizeSpeech(textoResposta);
      if (!audio) return;

      await chat.sendStateRecording();
      await delay(1200);
      await client.sendMessage(msg.from, audio, { sendAudioAsVoice: true });
      await chat.clearState().catch(() => null);
    };

    let textoOriginal = msg.body?.trim() || "";

    if (mensagemEhAudio) {
      const media = await msg.downloadMedia();
      textoOriginal = (await transcribeAudioMessage(media)) || "";
      if (!textoOriginal) {
        await typing();
        await client.sendMessage(msg.from, mensagemAudioNaoEntendido);
        return;
      }
    }

    const texto = normalizarTexto(textoOriginal);
    if (!sessions.has(msg.from)) {
      sessions.set(msg.from, { etapa: "menu" });
    }

    const session = sessions.get(msg.from);

    if (session.pausadoAte) {
      if (Date.now() < session.pausadoAte) return;
      delete session.pausadoAte;
    }


    const aiSempreAtivo = configData.ai.enabled && configData.ai.mode === "always";
    const comandosMenu = ["1", "2", "3", "4", "5"];
    const isComandoProtegido =
      gatilhosMenu.test(texto) || (session.etapa === "menu" && comandosMenu.includes(texto));
    let aiTentada = false;

    const respostaCatalogo = respostaCatalogoSeAplicavel(textoOriginal);
    if (respostaCatalogo) {
      await responderComTexto(respostaCatalogo);
      session.etapa = "menu";
      return;
    }

    if (aiSempreAtivo && !isComandoProtegido) {
      aiTentada = true;
      const respostaAi = await gerarRespostaIA(textoOriginal);
      if (respostaAi) {
        await responderComTexto(respostaAi);
        return;
      }
    }

    // =====================================
    // MENU
    // =====================================
    if (gatilhosMenu.test(texto)) {

      await typing();

      await client.sendMessage(msg.from, montarMenuPrincipal());

      session.etapa = "menu";
      return;
    }

    // =====================================
    // INTERESSE DE COMPRA
    // =====================================
    if (gatilhosCardapio.some((item) => texto.includes(item))) {

      await typing();
      await client.sendMessage(msg.from, mensagemCardapio);
      session.etapa = "menu";
      return;
    }

    if (gatilhosCompra.some((item) => texto.includes(item))) {

      await typing();
      await client.sendMessage(msg.from, mensagemCompraDireta);
      session.etapa = "menu";
      return;
    }

    if (gatilhosConsultoria.some((item) => texto.includes(item))) {
      const numeros = extrairNumeros(textoOriginal);
      const perfil = classificarPerfilCompra(texto);
      if (numeros.length >= 2 && perfil) {
        await typing();
        await client.sendMessage(
          msg.from,
          montarResumoConsultoria({
            pessoas: numeros[0],
            duracao: numeros[1],
            perfil,
          })
        );
        session.etapa = "menu";
        return;
      }

      await typing();
      await client.sendMessage(msg.from, mensagemConsultoriaInicio);
      session.etapa = "consultoria_pessoas";
      return;
    }

    if (gatilhosOrcamento.some((item) => texto.includes(item))) {
      await typing();
      await client.sendMessage(msg.from, mensagemOrcamento);
      session.etapa = "menu";
      return;
    }

    // =====================================
    // AGRADECIMENTO
    // =====================================
    if (gatilhosAgradecimento.some((item) => texto.includes(item))) {

      await typing();
      await client.sendMessage(msg.from, mensagemAgradecimento);
      session.etapa = "menu";
      return;
    }

    // =====================================
    // CORDIALIDADE
    // =====================================
    if (gatilhosCordialidade.some((item) => texto.includes(item))) {

      await typing();
      await client.sendMessage(msg.from, mensagemCordialidade);
      session.etapa = "menu";
      return;
    }

    // =====================================
    // CONFIRMACAO
    // =====================================
    if (gatilhosConfirmacao.some((item) => texto === item || texto.includes(`${item} `) || texto.endsWith(item))) {

      await typing();
      await client.sendMessage(msg.from, mensagemConfirmacao);
      session.etapa = "menu";
      return;
    }

    // =====================================
    // PEDIR DEPOIS
    // =====================================
    if (gatilhosPosterior.some((item) => texto.includes(item))) {

      await typing();
      await client.sendMessage(msg.from, mensagemPosterior);
      session.etapa = "menu";
      return;
    }

    // =====================================
    // DESPEDIDA
    // =====================================
    if (gatilhosDespedida.some((item) => texto.includes(item))) {

      await typing();
      await client.sendMessage(msg.from, mensagemDespedida);
      session.etapa = "menu";
      return;
    }

    // =====================================
    // MENU OPÃ‡Ã•ES
    // =====================================
    if (session.etapa === "menu") {

      if (texto === "1") {

        await typing();

        await client.sendMessage(
          msg.from,
          "ðŸšš Me diga seu *bairro* para consultar a taxa e agilizar seu pedido."
        );

        session.etapa = "taxa";
        return;
      }

      if (texto === "2") {

        await typing();

        const lista = bairrosData.list.length
          ? bairrosData.list.map((b) => `â€¢ ${b.nome}`).join("\n")
          : "Nenhum bairro cadastrado.";

        await client.sendMessage(
          msg.from,
`ðŸ“ *Bairros atendidos*

${lista}

Digite seu bairro para consultar a taxa e seguir para o pedido.`
        );

        session.etapa = "taxa";
        return;
      }

    if (texto === "3") {
        await typing();
        const mensagemHorario = configData.horarioFuncionamento
          ? `\nðŸ•’ *HorÃ¡rio de Funcionamento*\n\n${configData.horarioFuncionamento}\n\nðŸ» Estamos esperando seu pedido!\n`
          : "HorÃ¡rio de funcionamento nÃ£o configurado no painel.";
        await client.sendMessage(msg.from, mensagemHorario);
        return;
      }

      if (texto === "4") {
        await typing();
        const mensagemEndereco = configData.enderecoLoja
          ? `\nðŸ“ *Nosso EndereÃ§o*\n\n${configData.enderecoLoja}\n`
          : "EndereÃ§o da loja nÃ£o configurado no painel.";
        await client.sendMessage(msg.from, mensagemEndereco);
        return;
      }

      if (texto === "5") {
        await typing();
        await client.sendMessage(msg.from, mensagemAtendente);
        session.pausadoAte = Date.now() + TEMPO_PAUSA_ATENDENTE_MS;
        session.etapa = "menu";
        return;
      }

    }

    // =====================================
    // CONSULTORIA DE COMPRA
    // =====================================
    if (session.etapa === "consultoria_pessoas") {
      const numeros = extrairNumeros(textoOriginal);
      const pessoas = numeros[0];
      const duracao = numeros[1];

      if (!pessoas || pessoas <= 0) {
        await typing();
        await client.sendMessage(msg.from, mensagemPerguntaPessoas);
        return;
      }

      session.consultoria = session.consultoria || {};
      session.consultoria.pessoas = pessoas;

      if (duracao && duracao > 0) {
        session.consultoria.duracao = duracao;
        const perfil = classificarPerfilCompra(texto);
        if (perfil) {
          session.consultoria.perfil = perfil;
          await typing();
          await client.sendMessage(
            msg.from,
            montarResumoConsultoria(session.consultoria)
          );
          session.etapa = "menu";
          return;
        }

        await typing();
        await client.sendMessage(msg.from, mensagemPerguntaPerfil);
        session.etapa = "consultoria_perfil";
        return;
      }

      await typing();
      await client.sendMessage(msg.from, mensagemPerguntaDuracao);
      session.etapa = "consultoria_duracao";
      return;
    }

    if (session.etapa === "consultoria_duracao") {
      const numeros = extrairNumeros(textoOriginal);
      const duracao = numeros[0];

      if (!duracao || duracao <= 0) {
        await typing();
        await client.sendMessage(msg.from, mensagemPerguntaDuracao);
        return;
      }

      session.consultoria = session.consultoria || {};
      session.consultoria.duracao = duracao;

      const perfil = classificarPerfilCompra(texto);
      if (perfil) {
        session.consultoria.perfil = perfil;
        await typing();
        await client.sendMessage(
          msg.from,
          montarResumoConsultoria(session.consultoria)
        );
        session.etapa = "menu";
        return;
      }

      await typing();
      await client.sendMessage(msg.from, mensagemPerguntaPerfil);
      session.etapa = "consultoria_perfil";
      return;
    }

    if (session.etapa === "consultoria_perfil") {
      const perfil = classificarPerfilCompra(texto);
      if (!perfil) {
        await typing();
        await client.sendMessage(msg.from, mensagemPerguntaPerfil);
        return;
      }

      session.consultoria = session.consultoria || {};
      session.consultoria.perfil = perfil;

      if (!session.consultoria.pessoas) {
        await typing();
        await client.sendMessage(msg.from, mensagemPerguntaPessoas);
        session.etapa = "consultoria_pessoas";
        return;
      }

      if (!session.consultoria.duracao) {
        await typing();
        await client.sendMessage(msg.from, mensagemPerguntaDuracao);
        session.etapa = "consultoria_duracao";
        return;
      }

      await typing();
      await client.sendMessage(
        msg.from,
        montarResumoConsultoria(session.consultoria)
      );
      session.etapa = "menu";
      return;
    }

    // =====================================
    // CONSULTA TAXA
    // =====================================
    if (session.etapa === "taxa") {

      if (texto in bairrosData.map) {

        const taxa = bairrosData.map[texto];

        await typing();

        if (taxa === 0) {

          await client.sendMessage(
            msg.from,
`ðŸŽ‰ Entrega para *${texto}* Ã© *GRÃTIS*!

Pode aproveitar e fazer seu pedido agora:
ðŸ‘‰ ${linkPrincipal}`
          );

        } else {

          await client.sendMessage(
            msg.from,
`ðŸšš Taxa para *${texto}*

R$ ${taxa},00

FaÃ§a seu pedido aqui:
ðŸ‘‰ ${linkPrincipal}`
          );

        }

        session.etapa = "menu";
        return;

      } else {

        await typing();

        await client.sendMessage(
          msg.from,
`ðŸ˜• Ainda nÃ£o atendemos esse bairro.

Digite outro bairro ou *menu*.`
        );

        return;
      }

    }

    // =====================================
    // FALLBACK
    // =====================================
    if (configData.ai.enabled && !aiTentada) {
      aiTentada = true;
      const respostaAi = await gerarRespostaIA(textoOriginal);
      if (respostaAi) {
        await responderComTexto(respostaAi);
        return;
      }
    }

    await typing();

    await client.sendMessage(
      msg.from,
      `Nao entendi.

Se quiser pedir agora:
${linkPrincipal}

Se precisar de consultoria, envie:
"12 pessoas, 4 horas, misto"

Ou digite *menu* para ver opcoes.`
    );

  } catch (erro) {

    console.log("âŒ ERRO:", erro);

  }

});

























