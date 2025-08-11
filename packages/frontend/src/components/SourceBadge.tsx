import React from 'react';
import { AssetSource } from '@shared/types/Asset';
import * as Tooltip from '@radix-ui/react-tooltip';

interface SourceBadgeProps {
  source: AssetSource;
  size?: 'sm' | 'md' | 'lg' | 'overlay';
}

const SOURCE_CONFIG = {
  MANUAL: {
    label: 'Manual Entry',
    color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
    logo: '/logos/manual.png', // User will replace with actual logo
  },
  NINJAONE: {
    label: 'NinjaOne',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    logo: '/logos/ninjaone.png', // User will replace with actual logo
  },
  INTUNE: {
    label: 'Microsoft Intune',
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    logo: '/logos/intune.png', // User will replace with actual logo
  },
  EXCEL: {
    label: 'Excel Import',
    color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    logo: '/logos/excel.png', // User will replace with actual logo
  },
  BULK_UPLOAD: {
    label: 'Bulk Upload',
    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    logo: '/logos/bulk.png', // User will replace with actual logo
  },
  API: {
    label: 'API',
    color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
    logo: '/logos/api.png', // User will replace with actual logo
  },
  TELUS: {
    label: 'Telus',
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    logo: '/logos/telus.png',
  },
  ROGERS: {
    label: 'Rogers',
    color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    logo: '/logos/rogers.png',
  },
  INVOICE: {
    label: 'Invoice/PO Import',
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    logo: '/logos/invoice.png', 
  },
} as const;

const SourceBadge: React.FC<SourceBadgeProps> = ({ source, size = 'md' }) => {
  const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.MANUAL;
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-16 h-16',
    overlay: 'w-12 h-8',
  };

  const isOverlay = size === 'overlay';
  const containerClasses = isOverlay 
    ? 'ring-2 ring-white dark:ring-slate-800 shadow-md hover:shadow-lg transition-shadow'
    : '';

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div className="flex items-center justify-center">
            <div className={`${sizeClasses[size]} rounded-lg border border-slate-50 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center relative ${containerClasses}`}>
              <img
                src={config.logo}
                alt={config.label}
                className={`w-full h-full object-contain ${size === 'overlay' ? 'py-0.5 px-0.5 scale-100' : 'p-1'}`}
                onError={(e) => {
                  // Fallback to text if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const textSize = size === 'overlay' ? 'text-sm' : size === 'lg' ? 'text-base' : 'text-xs';
                    parent.innerHTML = `<span class="${textSize} font-semibold text-slate-600 dark:text-slate-400">${source.substring(0, 2)}</span>`;
                  }
                }}
              />
            </div>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content side="top" className="px-2 py-1 text-xs bg-slate-900 text-white rounded shadow-lg z-50">
          {config.label}
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default SourceBadge; 