/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { Dashboard } from './components/Dashboard';
import { Activities } from './components/Activities';
import { Settings } from './components/Settings';
import { Finance } from './components/Finance';
import { LoginScreen } from './components/LoginScreen';
import { loadOrCreateProfile, watchAuth, type AccessStatus, type UserProfile } from './lib/auth';

export default function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    return watchAuth(async (user) => {
      if (!user) {
        setUserProfile(null);
        setAccessStatus('signed-out');
        return;
      }

      setAccessStatus('loading');
      try {
        const profile = await loadOrCreateProfile(user);
        if (!profile) {
          setUserProfile(null);
          setAccessStatus('denied');
          return;
        }

        setUserProfile(profile);
        setAccessStatus('authorized');
      } catch (error) {
        console.error('Failed to load user profile.', error);
        setUserProfile(null);
        setAccessStatus('denied');
      }
    });
  }, []);

  const renderPage = () => {
    if (!userProfile) return null;
    if (activePage === 'activities') return <Activities userProfile={userProfile} />;
    if (activePage === 'settings') return <Settings userProfile={userProfile} />;
    if (activePage === 'finance') return userProfile.role === 'admin' ? <Finance /> : <Activities userProfile={userProfile} />;

    return <Dashboard />;
  };

  if (accessStatus !== 'authorized' || !userProfile) {
    return <LoginScreen status={accessStatus} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 overflow-hidden font-sans">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        activePage={activePage}
        setActivePage={setActivePage}
        userRole={userProfile.role}
      />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <TopNav userProfile={userProfile} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto w-full custom-scrollbar">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
