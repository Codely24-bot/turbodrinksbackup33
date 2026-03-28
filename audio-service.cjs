const { MessageMedia } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");

const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const geminiTtsModel = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const openaiTranscribeModel =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
const openaiTtsModel = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const openaiTtsVoice = (process.env.OPENAI_TTS_VOICE || "marin").trim();

const carregarConfigAi = () => {
  try {
    const configPath = path.join(__dirname, "config.json");
    if (!fs.existsSync(configPath)) return "";
    const raw = fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const ai = parsed?.ai || parsed?.chatbotAi || {};
    const key = typeof ai?.apiKey === "string" ? ai.apiKey.trim() : "";
    const provider = typeof ai?.provider === "string" ? ai.provider.trim().toLowerCase() : "";
    return { apiKey: key, provider };
  } catch {
    return { apiKey: "", provider: "" };
  }
};

const configAi = carregarConfigAi();
const configProvider = configAi.provider;
const configApiKey = configAi.apiKey;

const rawGeminiApiKey =
  (process.env.GEMINI_API_KEY || "").trim() ||
  (configProvider === "gemini" ? configApiKey : "");
const geminiApiKey =
  rawGeminiApiKey &&
  rawGeminiApiKey !== "coloque_sua_chave_aqui" &&
  rawGeminiApiKey !== "sua_chave"
    ? rawGeminiApiKey
    : null;
const geminiTtsVoice = (process.env.GEMINI_TTS_VOICE || "Kore").trim();

const rawOpenaiApiKey =
  (process.env.OPENAI_API_KEY || "").trim() ||
  (configProvider === "openai" ? configApiKey : "");
const openaiApiKey = rawOpenaiApiKey ? rawOpenaiApiKey : null;

const resolveAudioProvider = () => {
  const desired = (process.env.AUDIO_PROVIDER || configProvider || "").trim().toLowerCase();
  const hasOpenai = Boolean(openaiApiKey);
  const hasGemini = Boolean(geminiApiKey);

  if (desired === "openai" && hasOpenai) return "openai";
  if (desired === "gemini" && hasGemini) return "gemini";
  if (hasOpenai) return "openai";
  if (hasGemini) return "gemini";
  return "none";
};

const normalizeAudioReplyMode = (value = "") => {
  const normalized = value.trim().toLowerCase();

  if (["off", "incoming_audio", "all"].includes(normalized)) {
    return normalized;
  }

  return "off";
};

const audioReplyMode = normalizeAudioReplyMode(process.env.AUDIO_REPLY_MODE || "off");
const audioProvider = resolveAudioProvider();
const isAudioTranscriptionEnabled = audioProvider !== "none";
const isAudioReplyEnabled = audioProvider !== "none" && audioReplyMode !== "off";

const audioProviderLabel = audioProvider === "openai" ? "OpenAI" : audioProvider === "gemini" ? "Gemini" : "indefinido";
const transcriptionModelLabel =
  audioProvider === "openai" ? openaiTranscribeModel : geminiModel;
const ttsModelLabel = audioProvider === "openai" ? openaiTtsModel : geminiTtsModel;
const ttsVoiceLabel = audioProvider === "openai" ? openaiTtsVoice : geminiTtsVoice;

const audioTranscriptionStatusReason = isAudioTranscriptionEnabled
  ? `sim (${audioProviderLabel} - ${transcriptionModelLabel})`
  : "nao - defina OPENAI_API_KEY (ou GEMINI_API_KEY) para transcrever notas de voz";

const audioReplyStatusReason = isAudioReplyEnabled
  ? `sim (${audioProviderLabel} - ${ttsModelLabel}, modo=${audioReplyMode}, voz=${ttsVoiceLabel})`
  : "nao - defina OPENAI_API_KEY (ou GEMINI_API_KEY) e AUDIO_REPLY_MODE para enviar resposta em audio";

const extractTextFromGemini = (payload) => {
  const parts = payload?.candidates?.[0]?.content?.parts || [];

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
};

const sanitizeMimeType = (mimetype = "application/octet-stream") =>
  mimetype.split(";")[0].trim().toLowerCase();

const extFromMimeType = (mimeType) => {
  const value = String(mimeType || "").toLowerCase();
  if (value.includes("audio/ogg")) return "ogg";
  if (value.includes("audio/webm")) return "webm";
  if (value.includes("audio/wav")) return "wav";
  if (value.includes("audio/mpeg") || value.includes("audio/mp3")) return "mp3";
  if (value.includes("audio/mp4") || value.includes("audio/m4a")) return "m4a";
  if (value.includes("audio/opus")) return "opus";
  if (value.includes("audio/flac")) return "flac";
  return "dat";
};

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

const transcribeWithGemini = async (media) => {
  if (!geminiApiKey || !media?.data) {
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

const transcribeWithOpenAI = async (media) => {
  if (!openaiApiKey || !media?.data) {
    return null;
  }

  const mimeType = sanitizeMimeType(media.mimetype);
  const extension = extFromMimeType(mimeType);

  try {
    const audioBuffer = Buffer.from(media.data, "base64");
    const form = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    form.append("file", audioBlob, `audio.${extension}`);
    form.append("model", openaiTranscribeModel);
    form.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`
      },
      body: form
    });

    const payload = await response.json();

    if (!response.ok) {
      const error = new Error(payload?.error?.message || `Erro HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const transcript = typeof payload?.text === "string" ? payload.text.trim() : "";
    return transcript ? transcript : null;
  } catch (error) {
    console.log(`Falha ao transcrever audio com OpenAI: ${error.message}`);
    return null;
  }
};

const transcribeAudioMessage = async (media) => {
  if (!isAudioTranscriptionEnabled || !media?.data) {
    return null;
  }

  if (audioProvider === "openai") {
    const result = await transcribeWithOpenAI(media);
    if (result) return result;
    return geminiApiKey ? transcribeWithGemini(media) : null;
  }

  if (audioProvider === "gemini") {
    const result = await transcribeWithGemini(media);
    if (result) return result;
    return openaiApiKey ? transcribeWithOpenAI(media) : null;
  }

  return null;
};

const synthesizeWithGemini = async (text) => {
  if (!geminiApiKey || !text?.trim()) {
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

const synthesizeWithOpenAI = async (text) => {
  if (!openaiApiKey || !text?.trim()) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: openaiTtsModel,
        voice: openaiTtsVoice,
        input: text.trim(),
        response_format: "wav",
        instructions:
          "Fale em portugues do Brasil, com tom cordial, natural e profissional."
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error?.message || `Erro HTTP ${response.status}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    if (!audioBuffer.length) {
      return null;
    }

    return new MessageMedia("audio/wav", audioBuffer.toString("base64"), "resposta.wav", audioBuffer.length);
  } catch (error) {
    console.log(`Falha ao gerar resposta em audio com OpenAI: ${error.message}`);
    return null;
  }
};

const synthesizeSpeech = async (text) => {
  if (!isAudioReplyEnabled || !text?.trim()) {
    return null;
  }

  if (audioProvider === "openai") {
    const result = await synthesizeWithOpenAI(text);
    if (result) return result;
    return geminiApiKey ? synthesizeWithGemini(text) : null;
  }

  if (audioProvider === "gemini") {
    const result = await synthesizeWithGemini(text);
    if (result) return result;
    return openaiApiKey ? synthesizeWithOpenAI(text) : null;
  }

  return null;
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
