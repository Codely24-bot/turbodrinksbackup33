import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, AlertTriangle, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validateAdminPassword } from '@/utils/passwordValidation';

const AdminPasswordModal = ({ isOpen, onClose, onConfirm, actionType = 'edit', actionLabel }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(3);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      // Check initial state
      const validation = validateAdminPassword('');
      if (validation.isLocked) {
        setIsLocked(true);
        setLockoutTimer(validation.lockoutTimeRemaining);
      } else {
        const storedAttempts = parseInt(localStorage.getItem('admin_attempts') || '0');
        setAttempts(3 - storedAttempts);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    let interval;
    if (isLocked && lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer((prev) => {
          if (prev <= 1) {
            setIsLocked(false);
            setAttempts(3);
            setError('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLocked, lockoutTimer]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLocked) return;

    const validation = validateAdminPassword(password);

    if (validation.isValid) {
      onConfirm();
      onClose();
    } else {
      setError(validation.message);
      setAttempts(validation.attemptsRemaining);
      if (validation.isLocked) {
        setIsLocked(true);
        setLockoutTimer(validation.lockoutTimeRemaining);
      }
      setPassword('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#1a2332] rounded-xl border border-gray-700 shadow-2xl w-full max-w-sm overflow-hidden"
        >
          <div className="bg-[#2d3e52] p-4 border-b border-gray-600 flex justify-between items-center">
            <div className="flex items-center gap-2 text-white font-bold">
              <Lock className="w-5 h-5 text-[#EF4444]" />
              <span>AUTORIZAÇÃO NECESSÁRIA</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#EF4444]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-8 h-8 text-[#EF4444]" />
              </div>
              <p className="text-gray-300 text-sm">
                Esta ação requer senha de administrador.
              </p>
              <p className="text-xs text-gray-500 mt-1 uppercase font-bold">
                {actionLabel || (actionType === 'cancel' ? 'Cancelar Item' : 'Editar Item')}
              </p>
            </div>

            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de Admin"
                maxLength={10}
                disabled={isLocked}
                autoFocus
                className="w-full bg-[#0d1117] border border-gray-600 rounded-lg px-4 py-3 text-white text-center text-lg tracking-widest focus:border-[#EF4444] focus:outline-none disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-2 flex items-center gap-2 text-red-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error} {isLocked && `(${lockoutTimer}s)`}</span>
              </div>
            )}

            {!isLocked && (
              <div className="text-center text-xs text-gray-500">
                Tentativas restantes: {attempts}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLocked || password.length === 0}
                className="bg-[#EF4444] hover:bg-red-600 text-white font-bold"
              >
                Confirmar
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AdminPasswordModal;
