import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, X, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { printOrder } from '@/utils/printOrder';
import { useAuth } from '@/contexts/AuthContext';

const PrintOrderModal = ({ 
  isOpen, 
  onClose, 
  venda, 
  itens, 
  pagamentos, 
  motoboy, 
  cliente 
}) => {
  const { user } = useAuth();
  // Usually company name might be in user metadata or settings. 
  // Using user name or a default for now based on context.
  const nomeEmpresa = user?.user_metadata?.name || 'MINHA LOJA';

  const handlePrint = () => {
    printOrder(venda, itens, pagamentos, motoboy, cliente, nomeEmpresa);
    onClose();
  };

  if (!isOpen || !venda) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-[var(--layout-bg)] rounded-xl border border-[var(--layout-border)] shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="bg-[var(--layout-surface-2)] p-4 border-b border-[var(--layout-border)] flex justify-between items-center">
            <div className="flex items-center gap-2 text-white font-bold">
              <Printer className="w-5 h-5 text-[var(--layout-accent)]" />
              <span>IMPRIMIR PEDIDO?</span>
            </div>
            <button 
              onClick={onClose}
              className="text-[var(--layout-text-muted)] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-[var(--layout-accent)]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Printer className="w-8 h-8 text-[var(--layout-accent)]" />
              </div>
              <h3 className="text-xl font-bold text-white">Venda Concluída!</h3>
              <p className="text-[var(--layout-text-muted)] text-sm">Deseja imprimir o comprovante desta venda?</p>
            </div>

            {/* Order Summary Card */}
            <div className="bg-[var(--layout-surface-2)] rounded-lg p-4 space-y-3 border border-[var(--layout-border)]">
              <div className="flex justify-between items-center border-b border-[var(--layout-border)] pb-2">
                <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Pedido</span>
                <span className="text-white font-mono font-bold">#{venda.numero_venda || String(venda.id).slice(0, 8)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[var(--layout-border)] pb-2">
                <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Data/Hora</span>
                <span className="text-white text-sm">
                  {venda.data_criacao ? format(new Date(venda.data_criacao), 'dd/MM/yyyy HH:mm') : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-[var(--layout-border)] pb-2">
                <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Tipo</span>
                <span className="text-white text-sm font-bold flex items-center gap-1">
                  {venda.tipo_venda === 'delivery' ? '🏍️ DELIVERY' : '🏪 LOJA'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Total</span>
                <span className="text-[var(--layout-accent)] text-xl font-black">
                  R$ {Number(venda.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={onClose}
                className="bg-[var(--layout-surface-2)] hover:bg-[var(--layout-border)] text-white font-semibold border border-[var(--layout-border)]"
              >
                <XCircle className="w-4 h-4 mr-2" />
                NÃO, OBRIGADO
              </Button>
              <Button
                onClick={handlePrint}
                className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white font-bold shadow-lg shadow-[var(--layout-accent)]/20"
              >
                <Printer className="w-4 h-4 mr-2" />
                SIM, IMPRIMIR
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PrintOrderModal;
