import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, X, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { printReport } from '@/utils/printReport';

const PrintReportModal = ({ isOpen, onClose, salesData }) => {
  const [reportType, setReportType] = useState('daily'); // daily, monthly, custom
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  
  const [filters, setFilters] = useState({
    includeCancelled: true,
    onlyLoja: false,
    onlyDelivery: false
  });

  if (!isOpen) return null;

  const handlePrint = () => {
    let range = { start: customStart, end: customEnd };
    
    if (reportType === 'daily') {
      const today = format(new Date(), 'yyyy-MM-dd');
      range = { start: today, end: today };
    } else if (reportType === 'monthly') {
      const date = new Date(selectedMonth + '-01');
      range = { 
        start: format(startOfMonth(date), 'yyyy-MM-dd'),
        end: format(endOfMonth(date), 'yyyy-MM-dd')
      };
    }

    // Filter logic here for printing
    let filteredSales = salesData;
    
    // Note: The salesData passed to this modal might be limited by the Page filters.
    // For a real robust report, we might want to fetch inside this modal or ensure Page provides enough data.
    // Assuming salesData passed is already relevant or we filter it further here.
    
    if (!filters.includeCancelled) {
      filteredSales = filteredSales.filter(s => s.status !== 'cancelado');
    }
    if (filters.onlyLoja) {
      filteredSales = filteredSales.filter(s => s.tipo_venda === 'loja');
    }
    if (filters.onlyDelivery) {
      filteredSales = filteredSales.filter(s => s.tipo_venda === 'delivery');
    }

    printReport(reportType, range, filters, filteredSales);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#1a2332] rounded-xl border border-gray-700 shadow-2xl w-full max-w-lg overflow-hidden"
        >
          <div className="bg-[#2d3e52] p-4 border-b border-gray-600 flex justify-between items-center">
            <div className="flex items-center gap-2 text-white font-bold">
              <Printer className="w-5 h-5 text-[#00d084]" />
              <span>IMPRIMIR RELATÓRIO</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div 
                className={`p-4 rounded-lg border cursor-pointer transition-all ${reportType === 'daily' ? 'bg-[#00d084]/10 border-[#00d084]' : 'bg-[#2d3e52] border-gray-600 hover:border-gray-500'}`}
                onClick={() => setReportType('daily')}
              >
                <div className="flex items-center gap-3">
                  <FileText className={`w-5 h-5 ${reportType === 'daily' ? 'text-[#00d084]' : 'text-gray-400'}`} />
                  <div>
                    <h4 className="text-white font-bold text-sm">RELATÓRIO DIÁRIO</h4>
                    <p className="text-xs text-gray-400">Vendas de hoje ({format(new Date(), 'dd/MM/yyyy')})</p>
                  </div>
                </div>
              </div>

              <div 
                className={`p-4 rounded-lg border cursor-pointer transition-all ${reportType === 'monthly' ? 'bg-[#00d084]/10 border-[#00d084]' : 'bg-[#2d3e52] border-gray-600 hover:border-gray-500'}`}
                onClick={() => setReportType('monthly')}
              >
                <div className="flex items-center gap-3">
                  <CalendarIcon className={`w-5 h-5 ${reportType === 'monthly' ? 'text-[#00d084]' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <h4 className="text-white font-bold text-sm">RELATÓRIO MENSAL</h4>
                    <input 
                      type="month" 
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 bg-[#1a2332] border border-gray-600 rounded px-2 py-1 text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              <div 
                className={`p-4 rounded-lg border cursor-pointer transition-all ${reportType === 'custom' ? 'bg-[#00d084]/10 border-[#00d084]' : 'bg-[#2d3e52] border-gray-600 hover:border-gray-500'}`}
                onClick={() => setReportType('custom')}
              >
                <div className="flex items-center gap-3">
                  <CalendarIcon className={`w-5 h-5 ${reportType === 'custom' ? 'text-[#00d084]' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <h4 className="text-white font-bold text-sm">PERSONALIZADO</h4>
                    <div className="flex gap-2 mt-2">
                       <input 
                        type="date" 
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[#1a2332] border border-gray-600 rounded px-2 py-1 text-white text-xs w-full"
                      />
                       <input 
                        type="date" 
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[#1a2332] border border-gray-600 rounded px-2 py-1 text-white text-xs w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#2d3e52] p-4 rounded-lg border border-gray-600 space-y-3">
              <h5 className="text-xs text-gray-400 font-bold uppercase">Opções de Filtro</h5>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={filters.includeCancelled}
                  onChange={(e) => setFilters(prev => ({ ...prev, includeCancelled: e.target.checked }))}
                  className="rounded border-gray-600 bg-[#1a2332] text-[#00d084] focus:ring-[#00d084]"
                />
                <span className="text-sm text-gray-300">Incluir vendas canceladas</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={filters.onlyLoja}
                  onChange={(e) => setFilters(prev => ({ ...prev, onlyLoja: e.target.checked, onlyDelivery: false }))}
                  className="rounded border-gray-600 bg-[#1a2332] text-[#00d084] focus:ring-[#00d084]"
                />
                <span className="text-sm text-gray-300">Apenas Loja</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={filters.onlyDelivery}
                  onChange={(e) => setFilters(prev => ({ ...prev, onlyDelivery: e.target.checked, onlyLoja: false }))}
                  className="rounded border-gray-600 bg-[#1a2332] text-[#00d084] focus:ring-[#00d084]"
                />
                <span className="text-sm text-gray-300">Apenas Delivery</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
              >
                CANCELAR
              </Button>
              <Button
                onClick={handlePrint}
                className="bg-[#00d084] hover:bg-[#00b872] text-white font-bold shadow-lg shadow-[#00d084]/20"
              >
                <Printer className="w-4 h-4 mr-2" />
                IMPRIMIR
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PrintReportModal;