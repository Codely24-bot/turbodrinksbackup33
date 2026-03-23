# PDV separado

Esta pasta documenta a separacao do PDV do painel principal.

## O que ja foi separado neste repositorio

- O admin principal nao exibe mais a aba de PDV.
- O PDV ganhou uma tela propria em `/pdv`.
- O backend expõe um bootstrap proprio do PDV em `GET /api/admin/pos/bootstrap`.
- A venda do PDV continua baixando o mesmo estoque do delivery.
- Abertura, movimento e fechamento de caixa continuam compartilhando a mesma API.

## Arquivos do PDV dentro deste repositorio

- `pdv/index.html`
- `src/pdv/main.jsx`
- `src/pdv/PdvPage.jsx`

## Endpoints usados pelo PDV

- `POST /api/admin/login`
- `GET /api/admin/profile`
- `GET /api/admin/pos/bootstrap`
- `POST /api/admin/pos/orders`
- `POST /api/admin/cash/open`
- `POST /api/admin/cash/movement`
- `POST /api/admin/cash/close`

## Variaveis do frontend do PDV

- `VITE_API_URL`
- `VITE_SOCKET_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_URL`
- `VITE_STORE_URL`

## Estrutura recomendada para um repositorio proprio do PDV

```text
fortin-pdv/
  package.json
  vite.config.js
  index.html
  public/
    FORTIN SVG.svg
  src/
    main.jsx
    PdvPage.jsx
    api.js
    supabase.js
    styles.css
    components/
      BrandLogo.jsx
```

## O que copiar para o novo repositorio

1. `public/FORTIN SVG.svg`
2. `src/components/BrandLogo.jsx`
3. `src/api.js`
4. `src/supabase.js`
5. `src/styles.css`
6. `src/pdv/PdvPage.jsx`
7. `src/pdv/main.jsx`
8. `pdv/index.html`
9. `package.json`
10. `vite.config.js`
11. `pdv/Dockerfile.example` como base para o `Dockerfile` do novo repositorio

## Ajustes ao criar o novo repositorio

1. Mova `src/pdv/main.jsx` para `src/main.jsx`.
2. Mova `src/pdv/PdvPage.jsx` para `src/PdvPage.jsx`.
3. No novo `src/main.jsx`, troque o import para `./PdvPage`.
4. No novo `index.html`, troque o script para `/src/main.jsx`.
5. Se quiser enxugar o projeto separado, remova do `package.json` tudo que nao for usado pelo PDV.
6. Configure as variaveis da Railway apontando para o backend principal.
7. Renomeie `Dockerfile.example` para `Dockerfile` se quiser subir o PDV separado usando container na Railway.

## Observacao importante

Separar o frontend do PDV ajuda a aliviar o painel principal e deixa o deploy do PDV independente.
O estoque continua correto porque delivery e PDV usam a mesma API e a mesma base de dados.
