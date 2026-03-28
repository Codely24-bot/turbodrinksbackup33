import { format } from 'date-fns';

export const generateReportContent = (reportType, dateRange, filters, salesData) => {
  const width = '210mm'; // A4 width approx
  const separator = '═'.repeat(90);
  const thinSeparator = '─'.repeat(90);

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

  // Calculations
  const totalSales = salesData.length;
  const totalRevenue = salesData.reduce((acc, sale) => acc + Number(sale.total), 0);
  const totalItems = salesData.reduce((acc, sale) => acc + (sale.itens?.length || 0), 0);
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  // Group by Type
  const salesByType = {
    loja: salesData.filter(s => s.tipo_venda === 'loja'),
    delivery: salesData.filter(s => s.tipo_venda === 'delivery')
  };

  // Group by Payment
  const salesByPayment = {};
  salesData.forEach(sale => {
    const method = sale.forma_pagamento || 'Outros';
    if (!salesByPayment[method]) salesByPayment[method] = { count: 0, total: 0 };
    salesByPayment[method].count += 1;
    salesByPayment[method].total += Number(sale.total);
  });

  let html = `
    <html>
    <head>
      <style>
        @media print {
          @page { margin: 10mm; size: A4; }
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 100%; color: black; }
          .header { text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 10px; }
          .section-title { font-weight: bold; margin-top: 15px; margin-bottom: 5px; font-size: 14px; background: #eee; padding: 2px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 5px; }
          .table th { text-align: left; border-bottom: 1px solid black; padding: 2px; font-size: 11px; }
          .table td { padding: 2px; font-size: 11px; vertical-align: top; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .summary-box { border: 1px solid black; padding: 5px; margin: 10px 0; display: flex; justify-content: space-around; }
          .sep { border-bottom: 1px dashed #ccc; margin: 5px 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">RELATÓRIO DE VENDAS - FORTIN FRP PRO</div>
      <div class="text-center">Período: ${dateRange.start} até ${dateRange.end}</div>
      <div class="text-center" style="font-size: 10px; margin-bottom: 10px;">Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</div>
      
      <div class="summary-box">
        <div class="text-center">
          <div class="bold">VENDAS TOTAIS</div>
          <div>${totalSales}</div>
        </div>
        <div class="text-center">
          <div class="bold">FATURAMENTO</div>
          <div>${formatCurrency(totalRevenue)}</div>
        </div>
        <div class="text-center">
          <div class="bold">TICKET MÉDIO</div>
          <div>${formatCurrency(averageTicket)}</div>
        </div>
        <div class="text-center">
          <div class="bold">ITENS VENDIDOS</div>
          <div>${totalItems}</div>
        </div>
      </div>

      <div class="section-title">VENDAS POR TIPO</div>
      <div class="row">
        <span>LOJA: ${salesByType.loja.length} vendas</span>
        <span>${formatCurrency(salesByType.loja.reduce((acc, s) => acc + Number(s.total), 0))}</span>
      </div>
      <div class="row">
        <span>DELIVERY: ${salesByType.delivery.length} vendas</span>
        <span>${formatCurrency(salesByType.delivery.reduce((acc, s) => acc + Number(s.total), 0))}</span>
      </div>

      <div class="section-title">VENDAS POR FORMA DE PAGAMENTO</div>
      ${Object.entries(salesByPayment).map(([method, data]) => `
        <div class="row">
          <span style="text-transform: uppercase;">${method} (${data.count})</span>
          <span>${formatCurrency(data.total)}</span>
        </div>
      `).join('')}

      <div class="section-title">DETALHES DAS VENDAS</div>
      <table class="table">
        <thead>
          <tr>
            <th width="10%">PEDIDO</th>
            <th width="15%">DATA/HORA</th>
            <th width="10%">TIPO</th>
            <th width="20%">CLIENTE</th>
            <th width="15%">PAGAMENTO</th>
            <th width="10%">ITENS</th>
            <th width="10%">STATUS</th>
            <th width="10%" class="text-right">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${salesData.map(sale => `
            <tr>
              <td>#${sale.numero_venda || String(sale.id).slice(0, 8)}</td>
              <td>${formatDate(sale.data_criacao)}</td>
              <td>${sale.tipo_venda === 'delivery' ? 'DELIVERY' : 'LOJA'}</td>
              <td>${sale.cliente?.nome || '-'}</td>
              <td>${sale.forma_pagamento || '-'}</td>
              <td class="text-center">${sale.itens?.length || 0}</td>
              <td>${sale.status === 'cancelado' ? 'CANCELADO' : 'CONCLUÍDO'}</td>
              <td class="text-right bold">${formatCurrency(sale.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div style="margin-top: 20px; text-align: center; font-size: 10px;">
        Documento para conferência interna.
      </div>
    </body>
    </html>
  `;

  return html;
};

export const printReport = (reportType, dateRange, filters, salesData) => {
  const content = generateReportContent(reportType, dateRange, filters, salesData);
  
  const printWindow = window.open('', '_blank', 'width=800,height=800');
  if (printWindow) {
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  } else {
    alert('Por favor, permita popups para imprimir o relatório.');
  }
};