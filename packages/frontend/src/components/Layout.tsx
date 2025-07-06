import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMsal } from '@azure/msal-react';
import { useStore } from '../store';
import { TopNavigation, Sidebar } from './layouts';
import Changelog from './Changelog';

const Layout: React.FC = () => {
  const location = useLocation();
  const { instance } = useMsal();
  const { currentUser, theme } = useStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const handleSignOut = () => {
    instance.logoutRedirect();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/50 to-brand-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-navy-950">
      {/* Glass morphism background overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-navy-500/5 pointer-events-none" />
      
      {/* Top Navigation */}
      <TopNavigation
        onSignOut={handleSignOut}
        onShowChangelog={() => setShowChangelog(true)}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex h-[calc(100vh-6rem)] mt-16">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentPath={location.pathname}
        />

        {/* Main Content Area */}
        <main 
          className={`
            flex-1 transition-all duration-300 ease-spring relative
            ${sidebarCollapsed ? 'ml-16' : 'ml-48'}
          `}
        >
          {/* Content Background with glass effect */}
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-l border-white/20 dark:border-slate-700/50" />
          
          {/* Main content container */}
          <div className="relative h-full overflow-auto">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="p-6 h-full min-h-[calc(100vh-8rem)]"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
        </main>
      </div>

      {/* Status Bar removed */}

      {/* Changelog Modal */}
      <Changelog isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
    </div>
  );
};

export default Layout; 