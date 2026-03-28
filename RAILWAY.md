# Deploy no Railway

Este repositório fica mais estável no Railway quando é publicado como dois serviços:

1. `pedidoflow-frontend`
2. `pedidoflow-whatsapp-bot`

## 1. Frontend

- Root Directory: `/`
- Builder: `Dockerfile`
- Porta exposta pelo container: `8080`
- Domínio público: gerar em `Settings > Networking`

### Variáveis do frontend

- `VITE_WHATSAPP_BOT_URL=https://${{pedidoflow-whatsapp-bot.RAILWAY_PUBLIC_DOMAIN}}`

Essa variável já será usada como URL padrão do bot na tela de QR e nas sincronizações de bairros/configurações.

## 2. Backend WhatsApp

- Root Directory: `/chatbot/chatbot`
- Builder: `Dockerfile`
- Healthcheck Path: `/`
- Restart Policy: `On Failure`

### Volume persistente do backend

Anexe um volume ao serviço do bot com o mount path:

- `/app/data`

O bot agora salva sessão do WhatsApp, cache e arquivos de configuração dentro desse diretório.

### Variáveis do backend

Você pode importar o arquivo [chatbot/chatbot/.env.example](/c:/Users/Administrador/Downloads/pedidoflow2.0-main/chatbot/chatbot/.env.example) e preencher:

- `PORT=3001`
- `DATA_DIR=/app/data`
- `OPENAI_API_KEY=...` se usar OpenAI
- `GEMINI_API_KEY=...` se usar Gemini
- `GEMINI_MODEL=gemini-2.5-flash`
- `GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts`
- `GEMINI_TTS_VOICE=Kore`
- `AUDIO_REPLY_MODE=off`
- `WWEB_VERSION=` opcional
- `PUPPETEER_EXECUTABLE_PATH=` opcional
- `WPP_AUTO_CLEAR_SESSION=1`
- `WPP_AUTO_RESTART_ON_FAIL=1`

## 3. Ordem recomendada

1. Criar o serviço `pedidoflow-whatsapp-bot`
2. Anexar o volume `/app/data`
3. Configurar as variáveis do bot
4. Fazer o primeiro deploy do bot
5. Gerar domínio público do bot
6. Criar o serviço `pedidoflow-frontend`
7. Definir `VITE_WHATSAPP_BOT_URL` apontando para o domínio público do bot
8. Fazer deploy do frontend

## 4. O que foi preparado no código

- Frontend com `Dockerfile` e `Caddyfile` para servir SPA React com fallback de rota
- Backend com `Dockerfile` próprio para Puppeteer/WhatsApp
- Bot ajustado para usar volume persistente via `DATA_DIR` ou `RAILWAY_VOLUME_MOUNT_PATH`
- Frontend ajustado para usar `VITE_WHATSAPP_BOT_URL` como URL padrão do bot
