import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Collapsible from '@radix-ui/react-collapsible';
import { 
  Home, 
  Server, 
  Plus, 
  BarChart3, 
  Settings,
  Users,
  MapPin,
  Building,
  Package,
  ChevronDown,
  Activity,
  FileText,
  Upload,
  Download,
  Sliders,
  UserCheck,
  UserCog
} from 'lucide-react';
import { useStore } from '../../store';
import clsx from 'clsx';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentPath: string;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresWrite?: boolean;
  requiresAdmin?: boolean;
  badge?: string;
  children?: NavigationItem[];
}

const navigation: NavigationItem[] = [
  { 
    name: 'Dashboard', 
    href: '/', 
    icon: Home,
    badge: 'New'
  },
  { 
    name: 'Assets', 
    href: '/assets', 
    icon: Server,
    children: [
      { name: 'All Assets', href: '/assets', icon: Server },
      { name: 'Add Asset', href: '/assets/new', icon: Plus, requiresWrite: true },
      { name: 'Bulk Upload', href: '/assets/bulk', icon: Upload, requiresWrite: true },
      { name: 'Export', href: '/assets/export', icon: Download },
    ]
  },
  { 
    name: 'Management', 
    href: '/management', 
    icon: Building,
    children: [
      { name: 'Users', href: '/management/technicians', icon: UserCog, requiresAdmin: true },
      { name: 'Staff', href: '/management/staff', icon: UserCheck, requiresAdmin: true },
      { name: 'Workload Categories', href: '/workload-categories', icon: Building, requiresAdmin: true },
      { name: 'Locations', href: '/locations', icon: MapPin, requiresAdmin: true },
      { name: 'Vendors', href: '/vendors', icon: Package, requiresAdmin: true },
    ]
  },
  { 
    name: 'Reports', 
    href: '/reports', 
    icon: BarChart3,
    children: [
      { name: 'Analytics', href: '/reports/analytics', icon: BarChart3 },
      { name: 'Activity Log', href: '/reports/activity', icon: Activity },
      { name: 'Custom Reports', href: '/reports/custom', icon: FileText },
    ]
  },
  { 
    name: 'Settings', 
    href: '/settings', 
    icon: Settings, 
    requiresAdmin: true,
    children: [
      { name: 'Custom Fields', href: '/settings/custom-fields', icon: Sliders, requiresAdmin: true },
    ]
  },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, currentPath }) => {
  const { currentUser } = useStore();
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  const isActive = (path: string) => {
    if (path === '/' && currentPath !== '/') return false;
    return currentPath.startsWith(path);
  };

  const hasPermission = (item: NavigationItem) => {
    if (item.requiresWrite && currentUser?.role === 'READ') return false;
    if (item.requiresAdmin && currentUser?.role !== 'ADMIN') return false;
    return true;
  };

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  const filteredNavigation = navigation.filter(hasPermission);

  const sidebarVariants = {
    expanded: { width: '16rem' },
    collapsed: { width: '4rem' }
  };

  const contentVariants = {
    expanded: { opacity: 1, x: 0 },
    collapsed: { opacity: 0, x: -20 }
  };

  return (
    <motion.aside
      initial={false}
      animate={collapsed ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-16 bottom-8 z-40"
    >
      {/* Glass morphism background */}
      <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-r border-white/20 dark:border-slate-700/50" />
      
      <div className="relative h-full flex flex-col">
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {filteredNavigation.map((item) => (
            <div key={item.name}>
              {item.children ? (
                <Collapsible.Root 
                  open={!collapsed && expandedItems.includes(item.name)}
                  onOpenChange={() => !collapsed && toggleExpanded(item.name)}
                >
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <Collapsible.Trigger 
                          className={clsx(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left",
                            isActive(item.href)
                              ? "bg-gradient-to-r from-brand-500/20 to-navy-500/20 text-brand-700 dark:text-brand-300 shadow-glass-sm"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50"
                          )}
                        >
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          <AnimatePresence>
                            {!collapsed && (
                              <motion.div
                                variants={contentVariants}
                                initial="collapsed"
                                animate="expanded"
                                exit="collapsed"
                                className="flex-1 flex items-center justify-between"
                              >
                                <span className="font-medium">{item.name}</span>
                                {item.badge && (
                                  <span className="px-2 py-0.5 text-xs font-semibold bg-brand-500/20 text-brand-700 dark:text-brand-300 rounded-full">
                                    {item.badge}
                                  </span>
                                )}
                                <ChevronDown className={clsx(
                                  "w-4 h-4 transition-transform duration-200",
                                  expandedItems.includes(item.name) && "rotate-180"
                                )} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Collapsible.Trigger>
                      </Tooltip.Trigger>
                      {collapsed && (
                        <Tooltip.Content side="right" className="px-3 py-1 text-sm bg-slate-900 text-white rounded-lg shadow-lg ml-2">
                          {item.name}
                        </Tooltip.Content>
                      )}
                    </Tooltip.Root>
                  </Tooltip.Provider>

                  <Collapsible.Content className="overflow-hidden">
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-2 ml-6 space-y-1"
                    >
                      {item.children?.filter(hasPermission).map((child) => (
                        <Link
                          key={child.name}
                          to={child.href}
                          className={clsx(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                            isActive(child.href)
                              ? "bg-brand-500/10 text-brand-700 dark:text-brand-300"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/30"
                          )}
                        >
                          <child.icon className="w-4 h-4" />
                          {child.name}
                        </Link>
                      ))}
                    </motion.div>
                  </Collapsible.Content>
                </Collapsible.Root>
              ) : (
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <Link
                        to={item.href}
                        className={clsx(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                          isActive(item.href)
                            ? "bg-gradient-to-r from-brand-500/20 to-navy-500/20 text-brand-700 dark:text-brand-300 shadow-glass-sm"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.div
                              variants={contentVariants}
                              initial="collapsed"
                              animate="expanded"
                              exit="collapsed"
                              className="flex-1 flex items-center justify-between"
                            >
                              <span className="font-medium">{item.name}</span>
                              {item.badge && (
                                <span className="px-2 py-0.5 text-xs font-semibold bg-brand-500/20 text-brand-700 dark:text-brand-300 rounded-full">
                                  {item.badge}
                                </span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Link>
                    </Tooltip.Trigger>
                    {collapsed && (
                      <Tooltip.Content side="right" className="px-3 py-1 text-sm bg-slate-900 text-white rounded-lg shadow-lg ml-2">
                        {item.name}
                      </Tooltip.Content>
                    )}
                  </Tooltip.Root>
                </Tooltip.Provider>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/20 dark:border-slate-700/50">
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                variants={contentVariants}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                className="text-center"
              >
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  AssetOrbit v0.6
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Enterprise Edition
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar; 