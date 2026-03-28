import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sidebarMenuItems } from '@/components/sidebarMenuItems';

const MobileSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] md:hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="absolute inset-y-0 left-0 z-[90] flex w-[82vw] max-w-xs flex-col border-r border-[var(--layout-border)] bg-[var(--layout-bg)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--layout-border)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--layout-surface-2)]">
              <img src="/pedidoflow.png" alt="PedidoFlow" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">PedidoFlow</h1>
              <p className="text-[10px] font-medium text-[var(--layout-text-muted)]">Gestão Comercial</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--layout-border)] p-2 text-[var(--layout-text-muted)] hover:text-white"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-3">
          {sidebarMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200',
                  isActive
                    ? 'bg-[var(--layout-accent)] text-white shadow-md shadow-black/20'
                    : 'text-[var(--layout-text-muted)] hover:bg-[var(--layout-surface-2)] hover:text-white',
                )}
              >
                <Icon className={cn('h-5 w-5 transition-transform group-hover:scale-110', isActive ? 'scale-105' : '')} />
                <span className="font-medium">{item.label}</span>
                {isActive ? <div className="absolute right-2 h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--layout-border)] bg-[var(--layout-surface-2)] p-3">
          <div className="flex items-center justify-between px-2 text-[10px] text-[var(--layout-text-muted)]">
            <span>Versão 1.0.0</span>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--layout-accent)]" title="Online" />
              <span>Online</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default MobileSidebar;
