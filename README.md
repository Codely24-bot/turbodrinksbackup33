# Sistema de Delivery + WhatsApp

Sistema mobile-first para distribuidora de bebidas com:

- loja online para clientes
- painel administrativo em tempo real
- automacao de mensagens no WhatsApp com `whatsapp-web.js`

## Como rodar

1. Instale dependencias:

```bash
npm install
```

2. Rode o sistema:

```bash
npm run dev
```

3. Acesse:

- loja: `http://localhost:5173`
- API: `http://localhost:4000`
- admin: `http://localhost:5173/admin`
- QR do WhatsApp: `http://localhost:4000/api/whatsapp/qr`

## Login padrao

- usuario: `admin`
- senha: `123456`

## Variaveis uteis

- `PORT=4000`
- `PUBLIC_STORE_URL=http://localhost:5173`
- `ADMIN_USER=admin`
- `ADMIN_PASSWORD=123456`
- `ADMIN_TOKEN=delivery-admin-token`
- `WHATSAPP_ENABLED=true`
- `WHATSAPP_CLIENT_ID=delivery-distribuidora`
- `WHATSAPP_HEADLESS=true`
- `PUPPETEER_EXECUTABLE_PATH=/caminho/do/chrome`

## Fluxo do WhatsApp

- o bot recebe mensagens do cliente
- responde com menu, link da loja, bairros, taxa e horario
- consulta o ultimo pedido do numero que entrou em contato
- envia automaticamente updates quando o status do pedido muda
- envia as notificacoes de pedido para o numero real do cliente via WhatsApp Web
- resolve o chat do destinatario antes do envio para melhorar a compatibilidade com numeros reais

## Integracao ativa no sistema

- novo pedido: o cliente recebe a mensagem de `Pedido recebido`
- atualizacao no painel: cada troca de status dispara a mensagem correspondente
- consulta por mensagem: o cliente pode pedir o status do ultimo pedido pelo proprio WhatsApp
- painel e loja continuam respondendo mesmo se o envio do WhatsApp atrasar ou falhar

## Observacoes

- os dados ficam em `server/data/db.json`
- a sessao do WhatsApp fica em `.wwebjs_auth`
- o cache do WhatsApp Web fica em `.wwebjs_cache`
- para deploy com Chrome headless, o projeto inclui `nixpacks.toml`
- se quiser desligar o bot sem remover a integracao, use `WHATSAPP_ENABLED=false`
