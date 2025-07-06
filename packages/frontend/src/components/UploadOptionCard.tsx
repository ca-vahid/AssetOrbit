import React from 'react';
import { AlertCircle, Check } from 'lucide-react';

interface UploadSource {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  acceptedFormats: string[];
  sampleFile: string | null;
  enabled: boolean;
  comingSoon?: boolean;
  features: string[];
}

interface UploadOptionCardProps {
  source: UploadSource;
  isSelected: boolean;
  onSelect: () => void;
}

const UploadOptionCard: React.FC<UploadOptionCardProps> = ({ source, isSelected, onSelect }) => {
  const IconComponent = source.icon;

  return (
    <div className="relative">
      <button
        onClick={source.enabled ? onSelect : undefined}
        disabled={!source.enabled}
        className={`w-full p-4 rounded-lg border-2 transition-all duration-200 text-left relative ${
          source.enabled
            ? isSelected
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/30'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            : 'border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed'
        }`}
      >
        {/* Coming Soon Overlay */}
        {source.comingSoon && (
          <div className="absolute inset-0 bg-slate-50/80 dark:bg-slate-900/80 rounded-lg flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              Coming Soon
            </div>
          </div>
        )}

        {/* Card Content */}
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className={`p-2 rounded-lg ${source.iconBg} flex-shrink-0`}>
                <IconComponent className={`w-4 h-4 ${source.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {source.title}
                  </h4>
                  {/* Selection indicator */}
                  {isSelected && source.enabled && (
                    <div className="p-1 bg-brand-500 text-white rounded-full flex-shrink-0">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                  {source.description}
                </p>
              </div>
            </div>
          </div>

          {/* Features - Show only first 2 */}
          <div className="space-y-1">
            {source.features.slice(0, 2).map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <div className={`w-1 h-1 rounded-full ${
                  source.enabled ? 'bg-green-500' : 'bg-slate-400'
                } flex-shrink-0`} />
                <span className="truncate">{feature}</span>
              </div>
            ))}
          </div>

          {/* Accepted formats */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
              Accepts:
            </span>
            <div className="flex gap-1 flex-wrap">
              {source.acceptedFormats.map((format) => (
                <span
                  key={format}
                  className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium"
                >
                  {format}
                </span>
              ))}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};

export default UploadOptionCard; 