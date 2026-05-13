import { Search, Bell, User } from 'lucide-react';

export function TopNav() {
  return (
    <header className="h-16 px-10 flex items-center justify-between border-b border-slate-900/50 bg-slate-950/20 backdrop-blur-sm sticky top-0 z-10 w-full">
      <div className="flex-1 flex max-w-sm">
        <div className="relative w-full group">
          <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
            <Search className="h-3.5 w-3.5 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input
            type="text"
            className="w-full bg-transparent py-2 pl-7 pr-4 text-[12px] text-slate-300 placeholder:text-slate-600 focus:outline-none transition-all"
            placeholder="Pesquisar..."
          />
        </div>
      </div>
      
      <div className="flex items-center gap-5 ml-4">
        <button className="relative p-2 text-slate-500 hover:text-slate-300 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-600 rounded-full border border-slate-950"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-5 border-l border-slate-900">
          <div className="text-right hidden sm:block">
            <p className="text-[12px] font-semibold text-slate-200 tracking-tight">Bruno Simplicio</p>
            <p className="text-[10px] text-slate-600 font-medium">Proprietário</p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shadow-sm">
            <User className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>
    </header>
  );
}
