import React, { Fragment, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  ServerIcon,
  PlusIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useMsal } from '@azure/msal-react';
import { useStore } from '../store';
import clsx from 'clsx';
import Changelog from './Changelog';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Assets', href: '/assets', icon: ServerIcon },
  { name: 'Add Asset', href: '/assets/new', icon: PlusIcon, requiresWrite: true },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, requiresAdmin: true },
];

const Layout: React.FC = () => {
  const location = useLocation();
  const { instance, accounts } = useMsal();
  const { currentUser, theme, toggleTheme } = useStore();
  const [showChangelog, setShowChangelog] = useState(false);
  
  const isActive = (path: string) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };
  
  const handleSignOut = () => {
    instance.logoutRedirect();
  };
  
  // Filter navigation based on user role
  const filteredNavigation = navigation.filter((item) => {
    if (item.requiresWrite && currentUser?.role === 'READ') return false;
    if (item.requiresAdmin && currentUser?.role !== 'ADMIN') return false;
    return true;
  });
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Disclosure as="nav" className="bg-white shadow dark:bg-gray-800">
        {({ open }) => (
          <>
            <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                        AssetOrbit
                      </h1>
                      <button
                        onClick={() => setShowChangelog(true)}
                        className="inline-flex items-center rounded-md bg-primary-100 dark:bg-primary-900 px-2 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
                      >
                        v0.08
                      </button>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <div className="ml-10 flex items-baseline space-x-4">
                      {filteredNavigation.map((item) => (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={clsx(
                            isActive(item.href)
                              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
                            'rounded-md px-3 py-2 text-sm font-medium flex items-center gap-2'
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="hidden md:block">
                  <div className="ml-4 flex items-center md:ml-6">
                    {/* Theme toggle */}
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                    >
                      {theme === 'light' ? (
                        <MoonIcon className="h-5 w-5" />
                      ) : (
                        <SunIcon className="h-5 w-5" />
                      )}
                    </button>
                    
                    {/* Profile dropdown */}
                    <Menu as="div" className="relative ml-3">
                      <div>
                        <Menu.Button className="flex max-w-xs items-center rounded-full bg-white p-2 text-sm hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700">
                          <UserCircleIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                        </Menu.Button>
                      </div>
                      <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-700">
                          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {currentUser?.displayName || accounts[0]?.name || 'User'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {currentUser?.email || accounts[0]?.username || ''}
                            </p>
                            {currentUser && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Role: {currentUser.role}
                              </p>
                            )}
                          </div>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={handleSignOut}
                                className={clsx(
                                  active ? 'bg-gray-100 dark:bg-gray-600' : '',
                                  'block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200'
                                )}
                              >
                                Sign out
                              </button>
                            )}
                          </Menu.Item>
                        </Menu.Items>
                      </Transition>
                    </Menu>
                  </div>
                </div>
                <div className="-mr-2 flex md:hidden">
                  {/* Mobile menu button */}
                  <Disclosure.Button className="inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:bg-gray-800 dark:hover:bg-gray-700">
                    <span className="sr-only">Open main menu</span>
                    {open ? (
                      <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                    )}
                  </Disclosure.Button>
                </div>
              </div>
            </div>
            
            <Disclosure.Panel className="md:hidden">
              <div className="space-y-1 px-2 pb-3 pt-2 sm:px-3">
                {filteredNavigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      isActive(item.href)
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
                      'block rounded-md px-3 py-2 text-base font-medium flex items-center gap-2'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                ))}
              </div>
              <div className="border-t border-gray-200 pb-3 pt-4 dark:border-gray-700">
                <div className="flex items-center px-5">
                  <div>
                    <div className="text-base font-medium text-gray-800 dark:text-white">
                      {currentUser?.displayName || accounts[0]?.name || 'User'}
                    </div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {currentUser?.email || accounts[0]?.username || ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="ml-auto rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    {theme === 'light' ? (
                      <MoonIcon className="h-5 w-5" />
                    ) : (
                      <SunIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <div className="mt-3 space-y-1 px-2">
                  <button
                    onClick={handleSignOut}
                    className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
      
      <main className="mx-auto max-w-full">
        <Outlet />
      </main>
      
      {/* Changelog Modal */}
      <Changelog isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
    </div>
  );
};

export default Layout; 