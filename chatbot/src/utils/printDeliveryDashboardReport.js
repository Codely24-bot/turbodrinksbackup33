import { format } from 'date-fns';

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const generateDeliveryDashboardReportContent = (report) => {
  const paymentRows = Object.entries(report.paymentSummary);

  return `
    <html>
    <head>
      <style>
        @media print {
          @page { margin: 10mm; size: A4; }
          body { font-family: Arial, sans-serif; color: #111827; }
        }
        body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 24px; }
        .header { text-align: center; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: 700; }
        .subtitle { font-size: 13px; color: #4b5563; margin-top: 4px; }
        .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; }
        .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 14px; }
        .label { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
        .value { font-size: 24px; font-weight: 700; }
        .section { margin-top: 24px; }
        .section-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 13px; }
        th { font-size: 11px; text-transform: uppercase; color: #6b7280; }
        .text-right { text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">Relatório do Painel da Loja</div>
        <div class="subtitle">Resumo diário do aplicativo de clientes</div>
        <div class="subtitle">Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="label">Pedidos do dia</div>
          <div class="value">${report.totalPedidos}</div>
        </div>
        <div class="card">
          <div class="label">Pedidos cancelados</div>
          <div class="value">${report.cancelados}</div>
        </div>
        <div class="card">
          <div class="label">Pedidos entregues</div>
          <div class="value">${report.entregues}</div>
        </div>
        <div class="card">
          <div class="label">Pedidos em aberto</div>
          <div class="value">${report.pedidosFinanceiros}</div>
        </div>
        <div class="card">
          <div class="label">Faturamento do dia</div>
          <div class="value">${formatCurrency(report.totalFinanceiro)}</div>
        </div>
        <div class="card">
          <div class="label">Taxa de entrega</div>
          <div class="value">${formatCurrency(report.taxaEntregaTotal)}</div>
        </div>
        <div class="card">
          <div class="label">Ticket médio</div>
          <div class="value">${formatCurrency(report.ticketMedio)}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Resumo financeiro por pagamento</div>
        <table>
          <thead>
            <tr>
              <th>Forma de pagamento</th>
              <th>Pedidos</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${paymentRows.map(([method, data]) => `
              <tr>
                <td>${method}</td>
                <td>${data.count}</td>
                <td class="text-right">${formatCurrency(data.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Pedidos do dia</div>
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Data/Hora</th>
              <th>Cliente</th>
              <th>Pagamento</th>
              <th>Status</th>
              <th class="text-right">Taxa entrega</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${report.orders.map((order) => `
              <tr>
                <td>#${order.numero}</td>
                <td>${format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                <td>${order.cliente || '-'}</td>
                <td>${order.forma_pagamento || '-'}</td>
                <td>${order.status}</td>
                <td class="text-right">${formatCurrency(order.taxaEntrega || 0)}</td>
                <td class="text-right">${formatCurrency(order.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;
};

export const printDeliveryDashboardReport = (report) => {
  const content = generateDeliveryDashboardReportContent(report);
  const printWindow = window.open('', '_blank', 'width=1000,height=800');
  if (!printWindow) {
    alert('Por favor, permita popups para imprimir o relatório.');
    return;
  }

  printWindow.document.write(content);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
};
