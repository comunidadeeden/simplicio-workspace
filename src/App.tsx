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
import { Launches } from './components/Launches';
import { Leads } from './components/Leads';
import { Team } from './components/Team';
import { LoginScreen } from './components/LoginScreen';
import { hasPageAccess, loadOrCreateProfile, watchAuth, type AccessStatus, type AppPage, type UserProfile } from './lib/auth';

type ThemeMode = 'dark' | 'light';

export default function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    const savedTheme = window.localStorage.getItem('simplicio-theme');
    return savedTheme === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('simplicio-theme', theme);
  }, [theme]);

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
    const page = activePage as AppPage;
    if (!hasPageAccess(userProfile, page)) return <Dashboard />;
    if (activePage === 'activities') return <Activities userProfile={userProfile} />;
    if (activePage === 'settings') return <Settings userProfile={userProfile} />;
    if (activePage === 'finance') return <Finance />;
    if (activePage === 'launches') return <Launches />;
    if (activePage === 'leads') return <Leads />;
    if (activePage === 'team') return <Team />;

    return <Dashboard />;
  };

  useEffect(() => {
    if (userProfile && !hasPageAccess(userProfile, activePage as AppPage)) {
      setActivePage('dashboard');
    }
  }, [activePage, userProfile]);

  if (accessStatus !== 'authorized' || !userProfile) {
    return <LoginScreen status={accessStatus} />;
  }

  return (
    <div className={`app-shell ${theme === 'light' ? 'theme-light' : 'theme-dark'} flex h-screen overflow-hidden font-sans`}>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        activePage={activePage}
        setActivePage={setActivePage}
        userProfile={userProfile}
      />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <TopNav
          userProfile={userProfile}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto w-full custom-scrollbar">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
