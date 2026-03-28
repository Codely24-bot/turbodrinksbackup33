Modulo separado para o ecossistema de delivery e aplicativo de clientes.

Estrutura principal:
- `components/`: cards, shell e badges compartilhados pelo painel e pelo app.
- `hooks/`: `useDeliveryHub`, usado pela aba administrativa e integrações.
- `pages/`: `AppPedidosPage` e `PedidoClienteAppPage`.
- `services/`: regras, sincronização, pedidos e utilitários do delivery.

Para publicar na Hostinger:
- gere o build completo com `npm run build`
- suba o conteúdo de `dist/`
- a rota do app do cliente continua em `/app/pedidos-cliente?store=ID_DA_LOJA`

Observacao:
- o app do cliente depende do build completo do sistema, porque compartilha autenticação, roteamento, UI e integração Supabase com o restante do projeto.
