import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    features?: string[];
    improvements?: string[];
    bugFixes?: string[];
  };
}

interface ChangelogProps {
  isOpen: boolean;
  onClose: () => void;
}

const changelog: ChangelogEntry[] = [
  {
    version: 'v0.6',
    date: 'July 5, 2025',
    changes: {
      features: [
        'Compact UI overhaul: reduced font sizes, padding, and spacing across Asset forms',
        'Updated Workload Category selector with denser layout and smaller chips',
      ],
      improvements: [
        'Refined SmartDropdown, buttons, and section headers for consistency',
        'Overall form height reduced by ~30% while maintaining readability',
      ],
    },
  },
  {
    version: 'v0.5',
    date: 'July 2, 2025',
    changes: {
      features: [
        'Universal Users page: lists all local DB users with role management',
        'Stats cards showing total users and counts by role',
        'Dynamic custom-field filtering in Assets list (GPU Yes/No, Ticket text, etc.)',
      ],
      improvements: [
        'Last-login timestamp tracked and displayed; deleted users auto-reactivate on login',
        'Modern confirmation modal for asset deletion with spinner & dark-mode support',
        'Filter chips now show custom-field labels and Yes/No values',
        'Backend GET /assets supports cf_<fieldId>=value query filtering',
      ],
      bugFixes: [
        'Fixed Radix Select crash on empty value',
        'Serial-number uniqueness migrated to non-unique index',
        'Resolved 500 error on asset create when customFields empty',
      ],
    },
  },
  {
    version: 'v0.4',
    date: 'July 1, 2025',
    changes: {
      features: [
        'Created shared AssetForm component for Add and Edit asset pages',
        'Implemented modern workload category selector with checkbox interface',
        'Enhanced form styling with gradient cards and improved UX',
        'Added consistent modern styling across all asset forms',
        'Integrated staff search with proper state management',
        'Implemented DRY principle for maintainable asset forms',
        'Added flexible props system for form customization',
        'Enhanced TypeScript support with shared interfaces',
      ],
      improvements: [
        'Eliminated code duplication - reduced AddAsset from 540 to 70 lines (87% reduction)',
        'Simplified EditAsset from 830 to 150 lines (82% reduction)',
        'Single source of truth for asset form logic',
        'Consistent UI/UX across Add and Edit operations',
        'Better form state management and validation',
        'Improved workload category selection experience',
        'Enhanced form layout with sectioned cards',
        'Better accessibility and keyboard navigation',
        'Updated application version badge to v0.4',
      ],
      bugFixes: [
        'Fixed dropdown values resetting to defaults in Add Asset page',
        'Resolved form state conflicts between Add and Edit modes',
        'Fixed workload category multi-select functionality',
        'Corrected staff assignment state management',
        'Fixed form validation and error handling',
      ],
    },
  },
  {
    version: 'v0.3',
    date: 'July 1, 2025',
    changes: {
      features: [
        'Full Users Management section with separate Technicians & Staff pages',
        'Role dropdowns with inline editing and bulk role update dialog',
        'Delete user flow with asset reassignment guard and soft-delete',
        'Profile photos pulled from Entra ID via Microsoft Graph',
        'Department filter, advanced search, and pagination for staff list',
      ],
      improvements: [
        'Staff cards redesigned with responsive layout, truncation fixes, and real photos',
        'Staff Details modal two-column facelift with richer data and animations',
        'Improved logging, caching, and debug endpoints for Graph integration',
        'Updated application version badge to v0.3',
      ],
      bugFixes: [
        'Resolved text overflow in staff cards',
        'Prevented duplicate Graph photo requests in dev mode',
      ],
    },
  },
  {
    version: 'v0.2',
    date: 'July 1, 2025',
    changes: {
      features: [
        'End-to-end dynamic custom fields (schema, CRUD API, admin UI)',
        'Dynamic asset Add/Edit forms that render custom fields with validation',
        'Asset Detail modal with inline editing, Additional Attributes section, and activity timeline',
        'Activities API endpoint and React Query integration',
        'Role-management CLI utilities (promote, delete, fix email) and token debug helper',
      ],
      improvements: [
        'Seed script now inserts initial custom-field definitions',
        'Sidebar permission casing fix (ADMIN)',
        'Activity logs now capture custom-field changes with meaningful descriptions',
        'Better error logging and user-ID handling in backend',
        'Updated application version badge to v0.2',
      ],
      bugFixes: [
        'Fixed missing customFields object in single-asset API responses',
        'Resolved infinite re-render in EditAsset when custom fields were undefined',
        'Corrected activity log change serialization showing empty {}',
      ],
    },
  },
  {
    version: 'v0.10',
    date: 'July 1, 2025',
    changes: {
      features: [
        'Enterprise-grade hybrid layout with glass morphism effects',
        'Collapsible sidebar with role-based navigation and tooltips',
        'Top navigation bar with search, status indicators, notifications, and theme toggle',
        'Bottom status bar displaying live system metrics and user info',
        'Dashboard connected to real API data with mock data toggle for demos',
        'Animated stats cards, asset breakdown chart, recent activity, and quick actions',
        'Responsive dark mode with persistence and smooth transitions',
        'Routing for assets, management, reports, and settings pages',
      ],
      improvements: [
        'Refined Tailwind CSS design tokens and blue color palette',
        'Enhanced micro-interactions using Framer Motion',
        'Integrated React Query for data fetching and caching',
        'Streamlined MSAL authentication flow and API interceptor setup',
        'Adjusted layout spacing to prevent header overlap',
        'Created robust loading and empty states for API-driven components',
        'Updated application version badge to v0.10',
      ],
      bugFixes: [
        'Fixed header covering content and adjusted main container margins',
        'Resolved module resolution errors by renaming layout directory',
        'Corrected import paths for TopNavigation, Sidebar, and StatusBar',
      ],
    },
  },
  {
    version: 'v0.08',
    date: 'June 30, 2025',
    changes: {
      features: [
        'Complete database schema with Azure SQL Server integration',
        'Full-featured REST API with authentication and authorization',
        'Asset management dashboard with real-time statistics',
        'Azure Active Directory SSO integration',
        'Role-based access control (Read, Write, Admin)',
        'Auto-provisioning of users from Azure AD tokens',
        'Comprehensive asset tracking with audit trails',
        'Export functionality for CSV and Excel formats',
      ],
      improvements: [
        'Responsive dark mode support throughout the application',
        'Real-time data updates with React Query',
        'Optimized database queries with proper indexing',
        'Enhanced error handling and logging',
        'Improved authentication flow with token management',
        'Modern UI with Tailwind CSS and Heroicons',
      ],
      bugFixes: [
        'Fixed Azure SQL connection string format for Prisma',
        'Resolved authentication strategy naming conflicts',
        'Fixed user lookup and auto-creation logic',
        'Corrected API interceptor token attachment timing',
        'Resolved database connection pooling issues',
      ],
    },
  },
  
];

const Changelog: React.FC<ChangelogProps> = ({ isOpen, onClose }) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title
                    as="h3"
                    className="text-2xl font-bold leading-6 text-gray-900 dark:text-white"
                  >
                    What's New in AssetOrbit
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {changelog.map((entry) => (
                    <div key={entry.version} className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="inline-flex items-center rounded-full bg-primary-100 dark:bg-primary-900 px-3 py-1 text-sm font-medium text-primary-800 dark:text-primary-200">
                          {entry.version}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {entry.date}
                        </span>
                      </div>

                      {entry.changes.features && entry.changes.features.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            New Features
                          </h4>
                          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300 ml-4">
                            {entry.changes.features.map((feature, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-green-500 mt-1">•</span>
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {entry.changes.improvements && entry.changes.improvements.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-lg font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            Improvements
                          </h4>
                          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300 ml-4">
                            {entry.changes.improvements.map((improvement, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-blue-500 mt-1">•</span>
                                {improvement}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {entry.changes.bugFixes && entry.changes.bugFixes.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-lg font-semibold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                            Bug Fixes
                          </h4>
                          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300 ml-4">
                            {entry.changes.bugFixes.map((fix, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-orange-500 mt-1">•</span>
                                {fix}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default Changelog; 