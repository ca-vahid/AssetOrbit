import React, { RefObject, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Download, File, Check, Sparkles, AlertCircle, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import UploadOptionCard from '../../../components/UploadOptionCard';
import { useFileParser } from '../../../hooks/useFileParser';
import { invoiceApi } from '../../../services/api';
import { acquireTokenSafely } from '../../../auth/msal';
import type { UploadCategory, UploadSource, ImportSourceConfig } from '../../../utils/importSources';

interface Props {
  category: UploadCategory;
  selectedSource: UploadSource | null;
  onSelectSource: (src: UploadSource) => void;
  uploadSources: Record<string, any>;
  selectedSourceConfig: ImportSourceConfig | null | undefined;
  onFileUploaded: (data: { headers: string[]; rows: Record<string, string>[]; documentId?: string; columnMappings?: any[] }) => void;
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
  const [extractError, setExtractError] = React.useState<string | null>(null);
  const [extractIssues, setExtractIssues] = React.useState<{ lineIndex: number; message: string }[] | null>(null);
  const [llmStatus, setLlmStatus] = useState<string>('');
  const [llmOutput, setLlmOutput] = useState<any>(null);
  const [llmThoughts, setLlmThoughts] = useState<string>('');
  const [isLlmExpanded, setIsLlmExpanded] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isThoughtsScrollLocked, setIsThoughtsScrollLocked] = useState(false);
  const [isOutputScrollLocked, setIsOutputScrollLocked] = useState(false);
  const thoughtsRef = React.useRef<HTMLDivElement>(null);
  const outputRef = React.useRef<HTMLPreElement>(null);
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

  // Auto-scroll thoughts box to bottom when content updates
  useEffect(() => {
    if (thoughtsRef.current && !isThoughtsScrollLocked && llmThoughts) {
      thoughtsRef.current.scrollTop = thoughtsRef.current.scrollHeight;
    }
  }, [llmThoughts, isThoughtsScrollLocked]);

  // Auto-scroll output box to bottom when content updates
  useEffect(() => {
    if (outputRef.current && !isOutputScrollLocked && llmOutput && isLlmExpanded) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [llmOutput, isOutputScrollLocked, isLlmExpanded]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadedFiles([file]);
    
    try {
      setExtractError(null);
      setExtractIssues(null);
      setLlmStatus('');
      setLlmOutput(null);
      setLlmThoughts('');
      setIsThoughtsScrollLocked(false);
      setIsOutputScrollLocked(false);
      
      // For invoice source, use streaming extraction
      if (selectedSource === 'invoice') {
        setIsExtracting(true);
        
        // Get fresh auth token
        let authToken = '';
        try {
          const apiScope = `api://${import.meta.env.VITE_AZURE_AD_CLIENT_ID}/access_as_user`;
          const result = await acquireTokenSafely([apiScope]);
          authToken = result.accessToken;
        } catch (tokenError) {
          console.error('Failed to acquire token:', tokenError);
          throw new Error('Authentication failed. Please refresh the page and try again.');
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/invoice/extract-stream`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (!reader) {
          throw new Error('No response body');
        }
        
        let buffer = '';
        let eventBuffer = '';
        let dataBuffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventBuffer = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataBuffer = line.slice(5).trim();
              
              // Process the event/data pair
              if (eventBuffer && dataBuffer) {
                try {
                  const data = JSON.parse(dataBuffer);
                  
                  switch (eventBuffer) {
                    case 'status':
                      setLlmStatus(data.message);
                      break;
                    case 'thinking':
                      // Show AI thinking process
                      setLlmThoughts(data.thoughts || '');
                      setLlmStatus('AI is thinking...');
                      break;
                    case 'chunk':
                      // Show partial LLM output as it streams
                      try {
                        const partial = JSON.parse(data.partial);
                        setLlmOutput(partial);
                        setLlmStatus('Generating structured output...');
                      } catch {
                        // Partial JSON might not be valid yet
                      }
                      break;
                    case 'llm_output':
                      setLlmOutput(data.raw);
                      break;
                    case 'complete':
                      setLlmStatus('Extraction complete!');
                      setIsExtracting(false);
                      onFileUploaded({ 
                        headers: data.headers, 
                        rows: data.rows, 
                        documentId: data.documentId,
                        columnMappings: data.columnMappings
                      });
                      break;
                    case 'error':
                      setIsExtracting(false);
                      if (data.issues && Array.isArray(data.issues)) {
                        setExtractIssues(data.issues);
                        setExtractError(data.error || 'Extraction failed');
                        setLlmOutput(data.raw);
                      } else {
                        setExtractError(`${data.error || 'Extraction failed'}${data.details ? ` - ${data.details}` : ''}`);
                        if (data.raw) {
                          setLlmOutput({ error: data.error, rawText: data.raw, details: data.details });
                        }
                      }
                      break;
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e);
                }
                
                // Reset buffers
                eventBuffer = '';
                dataBuffer = '';
              }
            }
          }
        }
      } else {
        const parsed = await parseFile(file);
        onFileUploaded(parsed);
      }
    } catch (err: any) {
      console.error('Parse error:', err);
      setIsExtracting(false);
      // For invoice, we show inline error UI; avoid blocking alerts
      if (selectedSource !== 'invoice') {
        alert('Error parsing file. Please check the format.');
      } else {
        setExtractError(err.message || 'Extraction failed');
      }
      setUploadedFiles([]);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Handle scroll locking for thoughts box
  const handleThoughtsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 5;
    setIsThoughtsScrollLocked(!isAtBottom);
  };

  // Handle scroll locking for output box
  const handleOutputScroll = (e: React.UIEvent<HTMLPreElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 5;
    setIsOutputScrollLocked(!isAtBottom);
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
                isExtracting || isParsing
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : uploadedFiles.length > 0
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
              }`}
              onClick={() => {
                if (!isExtracting && !isParsing) {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = selectedSourceConfig.acceptedFormats.map(f => {
                    if (f === 'CSV') return '.csv';
                    if (f === 'XLSX') return '.xlsx';
                    if (f === 'XLSM') return '.xlsm';
                    if (f === 'PDF') return '.pdf';
                    if (f === 'JPG') return '.jpg,.jpeg';
                    if (f === 'PNG') return '.png';
                    return f.toLowerCase();
                  }).join(',');
                  input.onchange = e => handleFileSelect((e.target as HTMLInputElement).files);
                  input.click();
                }
              }}
            >
              <div className="space-y-2">
                {isExtracting || isParsing ? (
                  <>
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg inline-block">
                      <File className="w-5 h-5 animate-pulse" />
                    </div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {isExtracting ? (llmStatus || 'Extracting with AI...') : 'Processing file...'}
                    </p>
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

            {/* LLM Output Display for Invoice Source */}
            {selectedSource === 'invoice' && (isExtracting || llmOutput || llmThoughts) && (
              <div className="mt-4 space-y-3">
                {/* Thinking Display */}
                {llmThoughts && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
                    <div className="flex items-center gap-2 p-3 border-b border-blue-200 dark:border-blue-800">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        AI Thinking Process
                      </span>
                    </div>
                    <div 
                      ref={thoughtsRef}
                      className="p-3 max-h-32 overflow-y-auto"
                      onScroll={handleThoughtsScroll}
                    >
                      <p className="text-xs text-blue-600 dark:text-blue-400 whitespace-pre-wrap">
                        {llmThoughts}
                      </p>
                      {!isThoughtsScrollLocked && (
                        <div className="text-xs text-blue-500 dark:text-blue-400 opacity-50 mt-1">
                          Auto-scrolling... (scroll up to disable)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Extraction Output */}
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => setIsLlmExpanded(!isLlmExpanded)}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        AI Extraction Output
                      </span>
                      {llmStatus && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ({llmStatus})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {llmOutput && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(JSON.stringify(llmOutput, null, 2));
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                          title="Copy JSON"
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                        </button>
                      )}
                      {isLlmExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      )}
                    </div>
                  </div>
                  
                  {isLlmExpanded && llmOutput && (
                    <div className="p-3 border-t border-slate-200 dark:border-slate-700">
                      <pre 
                        ref={outputRef}
                        className="text-xs text-slate-600 dark:text-slate-400 overflow-x-auto max-h-64 overflow-y-auto"
                        onScroll={handleOutputScroll}
                      >
                        {JSON.stringify(llmOutput, null, 2)}
                      </pre>
                      {!isOutputScrollLocked && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 opacity-50 mt-1">
                          Auto-scrolling... (scroll up to disable)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {(error || extractError) && (
              <div className="mt-3 text-sm">
                {extractError && (
                  <div className="p-3 rounded border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 text-red-700 dark:text-red-300">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4" />
                      <div className="font-medium">{extractError}</div>
                    </div>
                    {extractIssues && extractIssues.length > 0 && (
                      <ul className="list-disc ml-5 mt-2 space-y-1">
                        {extractIssues.slice(0,6).map((it, i) => (
                          <li key={i}>Line {it.lineIndex + 1}: {it.message}</li>
                        ))}
                        {extractIssues.length > 6 && (
                          <li>...and {extractIssues.length - 6} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
                {error && (
                  <p className="text-red-600 dark:text-red-400 mt-2">{error}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StepSelectSource;