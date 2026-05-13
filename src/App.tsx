/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { Dashboard } from './components/Dashboard';
import { Activities } from './components/Activities';
import { Settings } from './components/Settings';
import { Finance } from './components/Finance';

export default function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');

  const renderPage = () => {
    if (activePage === 'activities') return <Activities />;
    if (activePage === 'settings') return <Settings />;
    if (activePage === 'finance') return <Finance />;

    return <Dashboard />;
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 overflow-hidden font-sans">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        activePage={activePage}
        setActivePage={setActivePage}
      />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <TopNav />
        <main className="flex-1 overflow-x-hidden overflow-y-auto w-full custom-scrollbar">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
