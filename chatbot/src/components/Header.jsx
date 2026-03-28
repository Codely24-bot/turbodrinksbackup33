import React, { useState, useEffect } from 'react';
import { LogOut, User, Clock, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Safe access to user data
  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Operador';
  const userEmail = user?.email || '';

  return (
    <header className="bg-[var(--layout-bg)] border-b border-[var(--layout-border)] px-4 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
      <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-3">
          {onMenuClick ? (
            <button
              type="button"
              onClick={onMenuClick}
              className="md:hidden rounded-lg border border-[var(--layout-border)] p-2 text-[var(--layout-text-muted)] hover:text-white"
              aria-label="Abrir menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          ) : null}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[var(--layout-accent)] rounded-full animate-pulse"></div>
            <span className="text-sm text-[var(--layout-text-muted)]">Sistema Online</span>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
        <div className="text-right hidden sm:block">
          <div className="text-sm text-[var(--layout-text-muted)] capitalize">{formatDate(currentTime)}</div>
          <div className="text-lg font-semibold text-white flex items-center justify-end gap-2">
            <Clock className="w-4 h-4 text-[var(--layout-accent)]" />
            {formatTime(currentTime)}
          </div>
        </div>

        <div className="h-10 w-px bg-[var(--layout-border)] hidden sm:block"></div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[var(--layout-surface-2)] px-3 py-2 rounded-lg w-full sm:w-auto">
            <User className="w-4 h-4 text-[var(--layout-accent)]" />
            <div className="text-sm min-w-0">
              <div className="text-white font-medium max-w-[200px] truncate">{userName}</div>
              <div className="text-[var(--layout-text-muted)] text-xs max-w-[200px] truncate">{userEmail}</div>
            </div>
          </div>

          <Button
            onClick={logout}
            variant="outline"
            size="sm"
            className="bg-transparent border-[var(--layout-border)] text-white hover:bg-red-500/10 hover:border-red-500 hover:text-red-400 transition-all"
          >
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
