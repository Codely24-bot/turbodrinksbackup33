const { MessageMedia } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");

const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const geminiTtsModel = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const runtimeDataDir = path.resolve(
  process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname
);
const bundledConfigPath = path.join(__dirname, "config.json");
const carregarGeminiApiKeyDoConfig = () => {
  try {
    const runtimeConfigPath = path.join(runtimeDataDir, "config.json");
    const configPath = fs.existsSync(runtimeConfigPath) ? runtimeConfigPath : bundledConfigPath;
    if (!fs.existsSync(configPath)) return "";
    const raw = fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const key = parsed?.ai?.apiKey || parsed?.chatbotAi?.apiKey || "";
    return typeof key === "string" ? key.trim() : "";
  } catch {
    return "";
  }
};

const rawGeminiApiKey = (process.env.GEMINI_API_KEY || "").trim() || carregarGeminiApiKeyDoConfig();
const geminiApiKey =
  rawGeminiApiKey &&
  rawGeminiApiKey !== "coloque_sua_chave_aqui" &&
  rawGeminiApiKey !== "sua_chave"
    ? rawGeminiApiKey
    : null;
const geminiTtsVoice = (process.env.GEMINI_TTS_VOICE || "Kore").trim();

const normalizeAudioReplyMode = (value = "") => {
  const normalized = value.trim().toLowerCase();

  if (["off", "incoming_audio", "all"].includes(normalized)) {
    return normalized;
  }

  return "off";
};

const audioReplyMode = normalizeAudioReplyMode(process.env.AUDIO_REPLY_MODE || "off");
const isAudioTranscriptionEnabled = Boolean(geminiApiKey);
const isAudioReplyEnabled = Boolean(geminiApiKey) && audioReplyMode !== "off";

const audioTranscriptionStatusReason = isAudioTranscriptionEnabled
  ? `sim (Gemini - ${geminiModel})`
  : "nao - defina GEMINI_API_KEY para transcrever notas de voz";

const audioReplyStatusReason = isAudioReplyEnabled
  ? `sim (Gemini - ${geminiTtsModel}, modo=${audioReplyMode}, voz=${geminiTtsVoice})`
  : "nao - defina GEMINI_API_KEY e AUDIO_REPLY_MODE para enviar resposta em audio";

const extractTextFromGemini = (payload) => {
  const parts = payload?.candidates?.[0]?.content?.parts || [];

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
};

const sanitizeMimeType = (mimetype = "application/octet-stream") =>
  mimetype.split(";")[0].trim().toLowerCase();

const buildWaveHeader = ({ dataLength, sampleRate = 24000, channels = 1, bitsPerSample = 16 }) => {
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
};

const wrapPcmAsWave = (pcmBuffer) =>
  Buffer.concat([buildWaveHeader({ dataLength: pcmBuffer.length }), pcmBuffer]);

const isIncomingAudioMessage = (msg) =>
  Boolean(msg?.hasMedia && ["audio", "ptt"].includes(msg.type));

const shouldSendAudioReply = (messageType) =>
  audioReplyMode === "all" || (audioReplyMode === "incoming_audio" && ["audio", "ptt"].includes(messageType));

const transcribeAudioMessage = async (media) => {
  if (!isAudioTranscriptionEnabled || !media?.data) {
    return null;
  }

  const mimeType = sanitizeMimeType(media.mimetype);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "Transcreva fielmente a fala deste audio, preservando o idioma original. Responda somente com a transcricao limpa, sem aspas, sem resumo e sem comentarios. Se o audio estiver vazio, inaudivel ou sem fala util, responda apenas [inaudivel]."
                },
                {
                  inlineData: {
                    mimeType,
                    data: media.data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0
          }
        })
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      const error = new Error(payload?.error?.message || `Erro HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const transcript = extractTextFromGemini(payload);

    if (!transcript || transcript.trim().toLowerCase() === "[inaudivel]") {
      return null;
    }

    return transcript.trim();
  } catch (error) {
    console.log(`Falha ao transcrever audio com Gemini: ${error.message}`);
    return null;
  }
};

const synthesizeSpeech = async (text) => {
  if (!isAudioReplyEnabled || !text?.trim()) {
    return null;
  }

  try {
    const prompt = [
      "Leia exatamente o texto abaixo em portugues do Brasil.",
      "Use um tom humano, cordial, natural e profissional.",
      "Nao adicione nem remova palavras.",
      "",
      `<texto>${text.trim()}</texto>`
    ].join("\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiTtsModel)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: geminiTtsVoice
                }
              }
            }
          }
        })
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message || `Erro HTTP ${response.status}`);
    }

    const inlineData = payload?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

    if (!inlineData?.data) {
      return null;
    }

    const pcmBuffer = Buffer.from(inlineData.data, "base64");

    if (!pcmBuffer.length) {
      return null;
    }

    const waveBuffer = wrapPcmAsWave(pcmBuffer);

    return new MessageMedia("audio/wav", waveBuffer.toString("base64"), "resposta.wav", waveBuffer.length);
  } catch (error) {
    console.log(`Falha ao gerar resposta em audio com Gemini: ${error.message}`);
    return null;
  }
};

module.exports = {
  audioReplyMode,
  audioReplyStatusReason,
  audioTranscriptionStatusReason,
  isAudioReplyEnabled,
  isAudioTranscriptionEnabled,
  isIncomingAudioMessage,
  shouldSendAudioReply,
  synthesizeSpeech,
  transcribeAudioMessage
};
