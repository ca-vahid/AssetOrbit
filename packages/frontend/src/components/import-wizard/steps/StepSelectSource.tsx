import React, { RefObject, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Download, File, Check } from 'lucide-react';
import UploadOptionCard from '../../../components/UploadOptionCard';
import { useFileParser } from '../../../hooks/useFileParser';
import type { UploadCategory, UploadSource, ImportSourceConfig } from '../../../utils/importSources';

interface Props {
  category: UploadCategory;
  selectedSource: UploadSource | null;
  onSelectSource: (src: UploadSource) => void;
  uploadSources: Record<string, any>;
  selectedSourceConfig: ImportSourceConfig | null | undefined;
  onFileUploaded: (data: { headers: string[]; rows: Record<string, string>[] }) => void;
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
  dropzoneRef: RefObject<HTMLDivElement>;
}

const StepSelectSource: React.FC<Props> = ({
  category,
  selectedSource,
  onSelectSource,
  uploadSources,
  selectedSourceConfig,
  onFileUploaded,
  uploadedFiles,
  setUploadedFiles,
  dropzoneRef,
}) => {
  const { parseFile, isParsing, error } = useFileParser();
  const sourcesForCategory = uploadSources[category] || [];

  // Auto-scroll to file upload section when source is selected
  useEffect(() => {
    if (selectedSource && dropzoneRef.current) {
      setTimeout(() => {
        dropzoneRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 300); // Small delay to allow for any animations
    }
  }, [selectedSource, dropzoneRef]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadedFiles([file]);
    
    try {
      const parsed = await parseFile(file);
      onFileUploaded(parsed);
    } catch (err) {
      console.error('Parse error:', err);
      alert('Error parsing file. Please check the format.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-lg">
          <Upload className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Source file / document</h3>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Choose how you want to import your {category} devices</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Source Cards */}
        <div className="max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {sourcesForCategory.map((src: any) => (
              <UploadOptionCard
                key={src.id}
                source={src}
                isSelected={selectedSource === src.id}
                onSelect={() => onSelectSource(src.id)}
              />
            ))}
          </div>
        </div>

        {/* File Upload Zone */}
        {selectedSource && selectedSourceConfig && (
          <div ref={dropzoneRef} className="mt-6 max-w-2xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm">Upload {selectedSourceConfig.title}</h4>
              {selectedSourceConfig.sampleFile && (
                <a
                  href={selectedSourceConfig.sampleFile}
                  download
                  className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download Sample
                </a>
              )}
            </div>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer ${
                isParsing
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : uploadedFiles.length > 0
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
              }`}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = selectedSourceConfig.acceptedFormats.map(f => f === 'CSV' ? '.csv' : '.xlsx').join(',');
                input.onchange = e => handleFileSelect((e.target as HTMLInputElement).files);
                input.click();
              }}
            >
              <div className="space-y-2">
                {isParsing ? (
                  <>
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg inline-block">
                      <File className="w-5 h-5 animate-pulse" />
                    </div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Processing file...</p>
                  </>
                ) : uploadedFiles.length > 0 ? (
                  <>
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg inline-block">
                      <Check className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">{uploadedFiles[0].name}</p>
                    <p className="text-xs text-green-600 dark:text-green-400">File uploaded successfully</p>
                  </>
                ) : (
                  <>
                    <div className="p-2 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400 rounded-lg inline-block">
                      <File className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Click to browse files</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Supports: {selectedSourceConfig.acceptedFormats.join(', ')}</p>
                  </>
                )}
              </div>
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StepSelectSource; 