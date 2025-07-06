import React from 'react';
import { 
  Zap, 
  FileSpreadsheet, 
  Shield, 
  User, 
  Cloud, 
  Upload,
  Building2
} from 'lucide-react';

interface SourceBadgeProps {
  source: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const SOURCE_CONFIG = {
  MANUAL: {
    label: 'Manual Entry',
    icon: User,
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
  },
  NINJAONE: {
    label: 'NinjaOne',
    icon: Zap,
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700',
  },
  INTUNE: {
    label: 'Microsoft Intune',
    icon: Shield,
    color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
  },
  EXCEL: {
    label: 'Excel/CSV',
    icon: FileSpreadsheet,
    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
  },
  BULK_UPLOAD: {
    label: 'Bulk Upload',
    icon: Upload,
    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700',
  },
  API: {
    label: 'API Import',
    icon: Cloud,
    color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600',
  },
} as const;

const SourceBadge: React.FC<SourceBadgeProps> = ({ 
  source, 
  size = 'md', 
  showIcon = true 
}) => {
  const config = SOURCE_CONFIG[source as keyof typeof SOURCE_CONFIG] || SOURCE_CONFIG.MANUAL;
  const IconComponent = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-xs',
    lg: 'px-3 py-2 text-sm',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium border
        ${config.color} ${sizeClasses[size]}
      `}
      title={`Source: ${config.label}`}
    >
      {showIcon && <IconComponent className={iconSizes[size]} />}
      <span>{config.label}</span>
    </span>
  );
};

export default SourceBadge; 