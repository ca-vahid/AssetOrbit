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
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Background overlay removed to prevent grey bar */}
      
      {/* Top Navigation */}
      <TopNavigation
        onSignOut={handleSignOut}
        onShowChangelog={() => setShowChangelog(true)}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex mt-16">
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
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-l border-white/20 dark:border-slate-700/50 pointer-events-none" />
          
          {/* Main content container */}
          <div className="relative h-full overflow-auto">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="p-6 h-full"
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