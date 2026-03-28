import { format } from 'date-fns';

export const generatePrintContent = (venda, itens, pagamentos, motoboy, cliente, nomeEmpresa) => {
  const width = '58mm';
  const pageHeight = '200mm';
  const separator = '='.repeat(48);
  const thinSeparator = '-'.repeat(48);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
    } catch (e) {
      return '';
    }
  };

  const formatCurrency = (val) => {
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  let html = `
    <html>
    <head>
      <style>
        @media print {
          @page { margin: 0; size: ${width} ${pageHeight}; }
          html, body { width: ${width}; height: ${pageHeight}; }
          body { margin: 0; padding: 8px; box-sizing: border-box; font-family: 'Courier New', monospace; font-size: 12px; width: ${width}; min-height: ${pageHeight}; color: black; overflow: hidden; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .row { display: flex; justify-content: space-between; }
          .separator { margin: 5px 0; overflow: hidden; white-space: nowrap; }
          .header { font-size: 14px; font-weight: bold; text-transform: uppercase; }
          .item-row { margin-bottom: 2px; }
          .payment-row { margin-bottom: 2px; }
        }
      </style>
    </head>
    <body>
      <div class="center header">${nomeEmpresa || 'EMPRESA'}</div>
      <div class="separator">${separator}</div>

      <div class="row">
        <span>VENDA: #${venda.numero_venda || String(venda.id).slice(0, 8)}</span>
        <span>${formatDate(venda.data_criacao || new Date())}</span>
      </div>

      <div class="separator">${thinSeparator}</div>

      <div class="bold">TIPO: ${venda.tipo_venda === 'delivery' ? 'DELIVERY' : 'LOJA'}</div>
      ${motoboy ? `<div>ENTREGADOR: ${motoboy.nome}</div>` : ''}

      <div class="separator">${separator}</div>
      <div class="center bold">ITENS DO PEDIDO</div>
      <div class="separator">${thinSeparator}</div>
  `;

  itens.forEach((item) => {
    html += `
      <div class="item-row">
        <div class="bold">${item.quantidade}x ${item.descricao}</div>
        <div class="row">
          <span>UN: ${formatCurrency(item.precoUnitario)}</span>
          <span>TOTAL: ${formatCurrency(item.total)}</span>
        </div>
      </div>
    `;
  });

  html += `
      <div class="separator">${separator}</div>

      <div class="row bold">
        <span>SUBTOTAL:</span>
        <span>${formatCurrency(venda.subtotal)}</span>
      </div>
  `;

  if (Number(venda.desconto || 0) > 0) {
    html += `
      <div class="row">
        <span>DESCONTO:</span>
        <span>-${formatCurrency(venda.desconto)}</span>
      </div>
    `;
  }

  if (Number(venda.acrescimo || 0) > 0) {
    html += `
      <div class="row">
        <span>ACRESCIMO:</span>
        <span>+${formatCurrency(venda.acrescimo)}</span>
      </div>
    `;
  }

  if (Number(venda.taxa_entrega || 0) > 0) {
    html += `
      <div class="row">
        <span>TAXA ENTREGA:</span>
        <span>${formatCurrency(venda.taxa_entrega)}</span>
      </div>
    `;
  }

  if (venda.precisa_troco && Number(venda.troco_para || 0) > 0) {
    html += `
      <div class="row">
        <span>TROCO PARA:</span>
        <span>${formatCurrency(venda.troco_para)}</span>
      </div>
    `;
  }

  html += `
      <div class="row bold" style="font-size: 14px; margin-top: 5px;">
        <span>TOTAL A PAGAR:</span>
        <span>${formatCurrency(venda.total)}</span>
      </div>

      <div class="separator">${separator}</div>
      <div class="center bold">FORMAS DE PAGAMENTO</div>
      <div class="separator">${thinSeparator}</div>
  `;

  pagamentos.forEach((pag) => {
    html += `
      <div class="row payment-row">
        <span>${String(pag.method || '').toUpperCase()}</span>
        <span>${formatCurrency(pag.value)}</span>
      </div>
    `;
  });

  if (venda.tipo_venda === 'delivery' && venda.endereco_entrega) {
    html += `
      <div class="separator">${separator}</div>
      <div class="center bold">DADOS DE ENTREGA</div>
      <div class="separator">${thinSeparator}</div>
      <div>ENDERECO: ${venda.endereco_entrega}</div>
      ${venda.observacoes_entrega ? `<div>OBS: ${venda.observacoes_entrega}</div>` : ''}
    `;
  }

  if (cliente) {
    html += `
      <div class="separator">${separator}</div>
      <div class="center bold">DADOS DO CLIENTE</div>
      <div class="separator">${thinSeparator}</div>
      <div>NOME: ${cliente.nome}</div>
      ${cliente.telefone ? `<div>TEL: ${cliente.telefone}</div>` : ''}
      ${cliente.cpf ? `<div>CPF: ${cliente.cpf}</div>` : ''}
    `;
  }

  html += `
      <div class="separator">${separator}</div>
      <div class="center bold" style="margin-top: 10px;">OBRIGADO PELA PREFERENCIA!</div>
      <div class="center" style="font-size: 10px; margin-top: 5px;">Sistema Fortin ERP Pro</div>
    </body>
    </html>
  `;

  return html;
};

export const printOrder = (venda, itens, pagamentos, motoboy, cliente, nomeEmpresa) => {
  const content = generatePrintContent(venda, itens, pagamentos, motoboy, cliente, nomeEmpresa);

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  } else {
    alert('Por favor, permita popups para imprimir o pedido.');
  }
};
