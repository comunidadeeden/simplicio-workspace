import { useState } from 'react';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Users, 
  PieChart, 
  ChevronLeft, 
  ChevronRight,
  Settings,
  Rocket
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { hasPageAccess, type AppPage, type UserProfile } from '../lib/auth';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  activePage: string;
  setActivePage: (value: string) => void;
  userProfile: UserProfile;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: CheckSquare, label: 'Atividades', id: 'activities' },
  { icon: PieChart, label: 'Financeiro', id: 'finance' },
  { icon: Rocket, label: 'Lançamentos', id: 'launches' },
  { icon: Users, label: 'Leads', id: 'leads' },
  { icon: Users, label: 'Equipe', id: 'team' },
];

export function Sidebar({ isCollapsed, setIsCollapsed, activePage, setActivePage, userProfile }: SidebarProps) {
  const visibleItems = NAV_ITEMS.filter((item) => hasPageAccess(userProfile, item.id as AppPage));
  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 70 : 240 }}
      className="h-screen bg-slate-950 border-r border-slate-900/50 flex flex-col relative z-20"
    >
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 bg-slate-900 border border-slate-800 rounded-full p-1 text-slate-400 hover:text-white transition-colors z-30 shadow-sm"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="flex items-center gap-3 h-20 px-6">
        <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/10">
          <Rocket size={14} className="text-white" />
        </div>
        {!isCollapsed && (
          <motion.span 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="font-display font-bold text-base text-slate-100 tracking-tight"
          >
            Simplicio.
          </motion.span>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.label}
              onClick={() => setActivePage(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group text-left",
                isActive 
                  ? "bg-blue-600/5 text-blue-400" 
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-900/40"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={18} className={cn("shrink-0 opacity-80", isActive && "opacity-100")} />
              {!isCollapsed && (
                <span className="text-[13px] font-medium tracking-tight whitespace-nowrap">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {hasPageAccess(userProfile, 'settings') && (
      <div className="p-3 border-t border-slate-900/50">
        <button
          onClick={() => setActivePage('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-900/40 transition-all duration-200",
            activePage === 'settings' ? "bg-blue-600/5 text-blue-400" : "text-slate-500 hover:text-slate-300"
          )}
          title={isCollapsed ? "Configurações" : undefined}
        >
          <Settings size={18} className="shrink-0 opacity-80" />
          {!isCollapsed && <span className="text-[13px] font-medium tracking-tight whitespace-nowrap">Configurações</span>}
        </button>
      </div>
      )}
    </motion.aside>
  );
}
