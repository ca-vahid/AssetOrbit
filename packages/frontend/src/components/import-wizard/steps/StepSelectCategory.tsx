import React from 'react';
import { Monitor, Smartphone, Server, AlertCircle, Check } from 'lucide-react';
import type { UploadCategory } from '../../../utils/importSources';

interface Props {
  selectedCategory: UploadCategory | null;
  onSelectCategory: (category: UploadCategory) => void;
}

const StepSelectCategory: React.FC<Props> = ({ selectedCategory, onSelectCategory }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-lg">
          <Monitor className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">What are you uploading?</h3>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Choose the type of assets you want to import</p>
        </div>
      </div>

      {/* Category Options */}
      <div className="flex gap-4 max-w-3xl flex-wrap">
        {/* Endpoint Devices */}
        <button
          onClick={() => onSelectCategory('endpoints')}
          className={`flex-1 p-4 rounded-lg border-2 transition-all duration-200 text-left ${
            selectedCategory === 'endpoints'
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex-shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">Endpoint Devices</h4>
                {selectedCategory === 'endpoints' && (
                  <div className="p-1 bg-brand-500 text-white rounded-full">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Laptops, desktops, tablets, phones</p>
            </div>
          </div>
        </button>

        {/* Phones */}
        <button
          onClick={() => onSelectCategory('phones')}
          className={`flex-1 p-4 rounded-lg border-2 transition-all duration-200 text-left ${
            selectedCategory === 'phones'
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg flex-shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">Phones</h4>
                {selectedCategory === 'phones' && (
                  <div className="p-1 bg-brand-500 text-white rounded-full">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Mobile phones &amp; smartphones</p>
            </div>
          </div>
        </button>

        {/* Servers */}
        <button
          onClick={() => onSelectCategory('servers')}
          disabled
          className="flex-1 p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-left relative opacity-60 cursor-not-allowed"
        >
          <div className="absolute inset-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg flex items-center justify-center">
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
              <AlertCircle className="w-3 h-3" />
              Coming Soon
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg flex-shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">Servers</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Physical servers, VMs, infrastructure</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default StepSelectCategory; 