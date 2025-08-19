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
    version: 'v0.97',
    date: 'August 19, 2025',
    changes: {
      features: [
        'Asset Presence Tracking & Auto-Retirement: Comprehensive system to track asset presence per external source and automatically retire missing assets',
        'Full Snapshot Import Control: Toggle to distinguish between full snapshot imports (trigger retirement) vs partial imports (no retirement)',
        'Import Preview & Override System: Review "Will Retire" and "Will Reactivate" assets with per-item checkboxes to override decisions',
        'Multi-Source Asset Support: Assets present in multiple sources remain active even if missing from one source',
        'Import Run Auditing: Complete history of import runs with detailed statistics and affected assets',
        'Missing Assets Reporting: Dedicated reports to view assets currently missing from specific sources',
        'Asset Source Badges: Visual indicators showing which assets are missing from their source systems',
      ],
      improvements: [
        'Enhanced Import Wizard: Prominent Full Snapshot toggle with clear explanations and preview functionality',
        'Persistent Missing Asset Tracking: Skipped retirement assets continue to appear in subsequent import previews until resolved',
        'Improved Phone Asset Tags: Unique suffixes prevent conflicts when users have multiple phones (e.g., "PH-John Smith-123456-ABC-001")',
        'Optimized Import Performance: Increased batch size from 25 to 100 assets for faster processing',
        'Smart Asset Tag Logic: Unique suffixes only applied to new assets, preserving clean tags on re-imports (BGC2334 stays BGC2334)',
        'ExternalSourceLink Data Model: Tracks per-source asset presence with timestamps and metadata',
        'Import Override Handling: Backend properly honors user skip/allow decisions from confirmation dialog',
        'Enhanced Logging: Detailed import process logging for debugging and audit trails',
      ],
      bugFixes: [
        'Fixed Asset Tag Corruption: Resolved issue where clean asset tags (BGC2334) became ugly suffixed versions (BGC3262-729317-SI57) on re-import',
        'Fixed Retirement Override Logic: Backend now properly skips retirement for user-unchecked assets',
        'Fixed ExternalSourceLink Mismatches: Cleaned up orphaned links and implemented prevention logic',
        'Fixed Unique Constraint Violations: Resolved phone asset tag conflicts causing import failures',
        'Fixed Missing Asset Detection: Corrected logic to properly identify and retire assets missing from source systems',
        'Fixed Reactivation Logic: Assets reappearing in imports now properly revert from RETIRED to ASSIGNED/AVAILABLE status',
        'Fixed Preview Logic: Skipped retirement assets now correctly reappear in subsequent import previews',
      ],
    },
  },
  {
    version: 'v0.96',
    date: 'August 10, 2025',
    changes: {
      features: [
        'Invoice/PO Import via AI (Gemini): Upload PDF/JPG/PNG invoices to automatically extract Service Tags, hardware specs, warranty info, pricing, and vendor',
        'Real‑time streaming of LLM thoughts and JSON output with auto‑scroll and manual override',
        'Admin‑only persistent storage for invoice files with secure viewing from asset details',
        'Bypass Column Mapping for invoice imports with backend‑provided mappings',
      ],
      improvements: [
        'Lenovo pricing logic: purchase price = unit price + proportional support cost',
        'Accessory filtering: ignore mouse/keyboard lines without service tags',
        'Quantity validation: block import if quantity ≠ number of service tags (per line item)',
        'Make/model preservation: skip shared transformations for INVOICE to avoid defaulting make to Dell',
        'Specs mapping: CPU, RAM, Storage, GPU, Operating System stored under specifications JSON',
        'Source labeling: new INVOICE source with purple badge and filter option',
        'Auth resiliency: improved token refresh and error recovery during SSE extraction',
      ],
      bugFixes: [
        'Fixed 401 on invoice file view by opening with Authorization token',
        'Resolved JSON parsing errors from LLM streaming by extracting valid JSON window',
        'Removed vendorId auto‑mapping to prevent FK violations on invoice imports',
        'Fixed TypeScript error for nullable sourceType in invoice flow',
        'Corrected filename overflow in invoice link with truncation',
      ],
    },
  },
  {
    version: 'v0.95',
    date: 'August 2, 2025',
    changes: {
      features: [
        'Server Asset Import: Added comprehensive server import functionality with NinjaOne integration',
        'Server Location Mapping: Intelligent location detection from BGC server naming convention (BGC-VAN-BUILD1 → Vancouver)',
        'Virtual/Physical Detection: Automatic identification of virtual machines vs physical servers based on system model',
        'Azure Server Support: Added support for Azure cloud servers (BGC-AZU-xxxx naming pattern)',
        'Server Storage Calculation: Enhanced storage aggregation with granular TB rounding for server capacities',
        'Smart Conflict Resolution: Automatic resolution of asset tag conflicts during re-imports with audit trail',
      ],
      improvements: [
        'Enhanced Import Conflict Detection: Serial number priority over asset tag matching for more reliable updates',
        'Automatic Conflict Resolution: Conflicting assets automatically renamed with -OLD- suffix to preserve data integrity',
        'Server Navigation: Added Servers section to sidebar navigation for easy access to server assets',
        'Import Category Selection: Enabled Servers category in import wizard with NinjaOne source support',
        'Location Matcher Enhancement: Extended location matching to support all BGC office codes (FDR, KAM, COL, HFX, SA, AZU)',
        'Error Handling: Improved import error messages and conflict resolution logging',
      ],
      bugFixes: [
        'Fixed locationName field validation error during server asset creation',
        'Resolved unique constraint violations on asset tag updates during re-imports',
        'Fixed server transformation registry registration for ninjaone-servers source type',
        'Corrected server asset tag processing to handle case sensitivity and whitespace issues',
      ],
    },
  },
  {
    version: 'v0.94',
    date: 'August 1, 2025',
    changes: {
      features: [
        'Fully modular shared import engine – single source of truth across FE & BE',
        'NinjaOne OS details (Architecture, Build Number) auto-mapped into specifications',
      ],
      improvements: [
        'Case-insensitive CSV header matching',
        'Backend second-pass now overwrites placeholder values and preserves unsupported keys in JSON',
        'Updated import documentation (REFACTORED_IMPORT_ARCHITECTURE.md)',
      ],
      bugFixes: [
        'Fixed missing Make / Model in NinjaOne imports (System Model header now supported)',
        'Resolved Prisma errors by sanitising unsupported top-level keys before insert',
      ],
    },
  },
  {
    version: 'v0.93',
    date: 'July 9, 2025',
    changes: {
      features: [
        'BambooHR Integration: Added direct links to employee HR profiles using Employee ID from Azure AD',
        'Enhanced Staff Information Display: Comprehensive employee details across all view modes (Large, Medium, Compact)',
        'Advanced Staff Data Integration: Added mobile phone, business phone, email, office location, and employee ID to all staff views',
        'Subtle HR Profile Access: Integrated BambooHR links as unobtrusive external link icons within employee information',
      ],
      improvements: [
        'Large View Enhancement: Added detailed contact information cards with mobile phone, business phone, email, and office location',
        'Medium View Expansion: Included job title, department, office location, employee ID, and mobile phone in card layout',
        'Compact View Redesign: Restructured table columns to show job title, contact information (email, phone, employee ID), and optimized space allocation',
        'Staff Details Modal: Enhanced employee information display with comprehensive contact and organizational details',
        'Backend Azure AD Integration: Updated Microsoft Graph API calls to retrieve employeeId field from Azure AD user profiles',
        'Consistent Styling: Maintained existing design language while integrating new functionality seamlessly',
        'BambooHR Link Subtlety: Changed from prominent orange styling to subtle gray external link icons for better visual hierarchy',
      ],
      bugFixes: [
        'Fixed staff information display to show all available Azure AD fields consistently across view modes',
        'Resolved type definitions to include employeeId in staff member interfaces',
        'Corrected compact view column layout to properly display contact information without overflow',
        'Fixed BambooHR link generation to handle missing employee IDs gracefully',
      ],
    },
  },
  {
    version: 'v0.92',
    date: 'July 9, 2025',
    changes: {
      features: [
        'Telus Bulk Import Feature: Added comprehensive Telus phone import with device name parsing and automatic make/model extraction',
        'Enhanced Phone Asset Management: Added Contract End Date and Balance fields to phone specifications',
        'Phone Model Field Enhancement: Renamed "Operating System" to "Phone" for better data representation (e.g., "iPhone 16 Pro Max")',
        'BGC CSV Import Fix: Resolved Brand column mapping issue that was causing "unknown" manufacturers',
        'Smartphone Icon Integration: Added Smartphone icon from Lucide React for better phone field representation',
      ],
      improvements: [
        'Phone Asset Type Configuration: Updated PHONE asset type with new contractEndDate and balance specification fields',
        'Backend Field Support: Added contractEndDate and balance to canonical asset fields and workload category rules',
        'Import Source Flexibility: Enhanced BGC template mapping to handle both "Brand" and "Brand " (with trailing space) column headers',
        'Device Name Parser: Intelligent parsing of Telus device names to extract make, model, and storage capacity',
        'Phone Specifications Enhancement: Expanded phone asset specifications to include contract management and billing information',
      ],
      bugFixes: [
        'Fixed BGC CSV import Brand column mapping causing all assets to show "unknown" manufacturer',
        'Resolved TypeScript error in BulkUpload component with StepSelectCategory selectedCategory prop',
        'Fixed header matching logic to handle CSV columns with trailing spaces',
        'Corrected phone asset form field configuration for better data entry',
      ],
    },
  },
  {
    version: 'v0.91',
    date: 'July 8, 2025',
    changes: {
      features: [
        'Asset Source Indicators: Added visual source badges to the assets table showing how each asset was imported (NinjaOne, Manual Entry, Excel, etc.)',
        'Source Badge Component: Created reusable component that displays source logos with tooltips and fallback text',
        'Clickable User Navigation: Made assigned user names in assets table clickable to navigate directly to staff detail pages',
        'Logo Integration System: Established `/public/logos/` directory structure for custom source logos',
      ],
      improvements: [
        'Enhanced Asset Table Layout: Source badges are positioned as overlays next to asset tags to save horizontal space',
        'Responsive Source Display: Source badges adapt to screen size and viewing density settings',
        'Professional Logo Display: Rectangular containers optimized for company logos with subtle borders',
        'Staff Navigation Integration: Seamless navigation from assets to staff management with automatic detail modal opening',
        'URL Parameter Support: Staff page now supports direct linking to specific users via URL parameters',
      ],
      bugFixes: [
        'Fixed TypeScript compatibility issues with AssetSource enum imports',
        'Resolved navigation routing for staff detail pages',
        'Corrected source badge sizing and aspect ratio for better logo visibility',
        'Fixed staff page URL parameter handling and cleanup',
      ],
    },
  },
  {
    version: 'v0.9',
    date: 'July 8, 2025',
    changes: {
      features: [
        'BGC Asset Template import source with automatic column mappings and sample files',
        'Completed modular Import Wizard architecture (shell + step components + generic hooks)',
        'Live import statistics overhaul – real-time success / failed / skipped counts, asset-type + status breakdown, workload-category detection',
        'Automatic BGC prefix normalisation on asset tags (front- & back-end safety net)',
        'Smarter asset status logic – laptops auto-marked ASSIGNED when an owner exists, never downgraded on lookup failure',
        'Dual Azure AD user resolution: supports usernames *and* display names with corporate-account prioritisation',
        'Multi-strategy location matcher with city / province parsing and abbreviation map',
        'Enhanced Server-Sent Events pipeline with richer payload (unique users, locations, categorised assets)',
        'New IMPORT_MODULE_GUIDE_V2.md documenting the modular import system and extension guidelines',
      ],
      improvements: [
        'Unified username normalisation (trim spaces, strip DOMAIN\) and single-pass resolution – eliminates edge-case whitespace bugs',
        'ColumnMapper now tolerant to trailing-space headers and suggests default mappings automatically',
        'Extensive backend & frontend logging for user/location resolution and progress tracking',
        'Conflict-safe asset-tag generation now adds suffix only when truly necessary',
        'Removed redundant user-resolution branches for cleaner, faster import processing',
        'Prisma insert/update now filters null locationId values to avoid foreign-key violations',
        'Sample files updated & added: NinjaOne CSV, BGC endpoint template',
      ],
      bugFixes: [
        'Fixed Brand column trailing-space mapping issue preventing make field population',
        'Resolved numeric-only asset tags importing without BGC prefix',
        'Fixed leading-space usernames being stored/imported incorrectly',
        'Eliminated false AVAILABLE statuses when owner present but AD lookup transiently fails',
        'Resolved foreign-key constraint crashes caused by null locationId',
        'SSE progress now always streams final statistics snapshot',
      ],
    },
  },
  {
    version: 'v0.8',
    date: 'July 6, 2025',
    changes: {
      features: [
        'Enhanced Import Results UI with clickable Failed and Skipped sections showing detailed error information',
        'Comprehensive Import Statistics tracking with auto-categorized assets, unique users, locations, asset types, and status breakdowns',
        'Interactive statistics cards with expandable details and copy functionality',
        'Real-time statistics updates during import progress via Server-Sent Events (SSE)',
        'Detailed skipped items tracking with specific reasons (missing serial numbers, duplicates, etc.)',
        'Improved import results display with compact layout and better visual hierarchy',
      ],
      improvements: [
        'Disabled automatic User record creation during imports - only IT technicians who log in get User records',
        'Enhanced user assignment handling - preserves full usernames (including domain) when Azure AD resolution fails',
        'Simplified frontend user resolution logic - always sends usernames to backend for consistent processing',
        'Updated import results to show both failed and skipped items as clickable sections with detailed breakdowns',
        'Improved statistics collection and display with categorized assets, unique user counts, and type/status breakdowns',
        'Enhanced backend user resolution to handle both GUIDs and usernames gracefully',
        'Added comprehensive debugging and logging for user resolution processes',
        'Updated IMPORT_MODULE_GUIDE.md with v0.8 changes and user handling documentation',
      ],
      bugFixes: [
        'Fixed user resolution consistency issue where first import showed GUIDs but subsequent imports showed usernames',
        'Resolved "Staff member not found" warnings by improving asset enrichment logic',
        'Fixed statistics not being returned properly from backend during imports',
        'Corrected frontend display logic to handle missing User records gracefully',
        'Fixed import results layout issues with overlapping buttons and excessive spacing',
        'Resolved issue where skipped items only showed counts without detailed information',
        'Fixed asset assignment display to show usernames directly when no User record exists',
      ],
    },
  },
  {
    version: 'v0.7',
    date: 'July 5, 2025',
    changes: {
      features: [
        'End-to-end Bulk Import Module with multi-step wizard (file upload, mapping, validation, confirmation)',
        'Real-time import progress tracking via Server-Sent Events (SSE) with automatic reconnection',
        'User & Location auto-resolution with Azure AD and location matching',
        'Serial-number conflict detection with skip / overwrite strategies',
        'Automatic unique Asset-Tag generation when missing or conflicting',
        'Intelligent Workload Category Detection during import based on configurable rules (RAM, GPU, user assignments, etc.)',
      ],
      improvements: [
        'Enhanced error handling – technical Prisma errors converted to friendly messages',
        'Skips rows with missing serial numbers instead of failing entire import',
        'Batch processing (25 items) for faster, parallel imports',
        'Comprehensive import filters and custom validation hooks',
        'Added full developer guide (IMPORT_MODULE_GUIDE.md)',
      ],
      bugFixes: [
        'Fixed SSE endpoint auth issue preventing progress updates',
        'Resolved duplicate asset-tag constraint violations under repeated tests',
        'Fixed “Assigned To” resolution creating placeholder users correctly',
      ],
    },
  },
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