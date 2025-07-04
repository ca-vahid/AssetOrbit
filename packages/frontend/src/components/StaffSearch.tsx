import React, { useState, useRef, useEffect } from 'react';
import { Search, X, User, Users } from 'lucide-react';
import { useStaffSearch } from '../hooks/useStaffSearch';
import { staffApi } from '../services/api';
import type { StaffMember } from '../services/api';

interface StaffSearchProps {
  value?: string | null;
  onChange: (staffMember: StaffMember | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const StaffSearch: React.FC<StaffSearchProps> = ({
  value,
  onChange,
  placeholder = "Search for staff member...",
  disabled = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { query, searchStaff, clearSearch, results, isLoading, hasResults } = useStaffSearch();

  // Load initial staff member when value prop changes
  useEffect(() => {
    const loadInitialStaff = async () => {
      if (value && value !== selectedStaff?.id) {
        setIsLoadingInitial(true);
        try {
          // Get staff member by Azure AD ID
          const staff: StaffMember = await staffApi.getById(value);
          setSelectedStaff(staff);
          if (inputRef.current) {
            inputRef.current.value = staff.displayName;
          }
        } catch (error) {
          console.error('Error loading initial staff member:', error);
          // If staff member not found, clear the selection
          setSelectedStaff(null);
          if (inputRef.current) {
            inputRef.current.value = '';
          }
        } finally {
          setIsLoadingInitial(false);
        }
      } else if (!value && selectedStaff) {
        // Clear selection if value is cleared
        setSelectedStaff(null);
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }
    };

    loadInitialStaff();
  }, [value, selectedStaff?.id]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    searchStaff(inputValue);
    setIsOpen(inputValue.length >= 2);
    
    // Clear selection if input is cleared
    if (!inputValue && selectedStaff) {
      setSelectedStaff(null);
      onChange(null);
    }
  };

  // Handle staff selection
  const handleStaffSelect = (staff: StaffMember) => {
    setSelectedStaff(staff);
    onChange(staff);
    setIsOpen(false);
    clearSearch();
    if (inputRef.current) {
      inputRef.current.value = staff.displayName;
    }
  };

  // Handle clear selection
  const handleClear = () => {
    setSelectedStaff(null);
    onChange(null);
    clearSearch();
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          disabled={disabled}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          className="w-full pl-10 pr-10 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        {selectedStaff && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-[9999] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto"
        >
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600"></div>
              <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">Searching...</span>
            </div>
          )}

          {!isLoading && !hasResults && query.length >= 2 && (
            <div className="flex items-center justify-center py-4 text-slate-500 dark:text-slate-400">
              <Users className="h-5 w-5 mr-2" />
              <span className="text-sm">No staff members found</span>
            </div>
          )}

          {!isLoading && hasResults && (
            <div className="py-1">
              {results.map((staff: StaffMember) => (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => handleStaffSelect(staff)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-700 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {staff.displayName}
                      </p>
                      {staff.jobTitle && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {staff.jobTitle}
                        </p>
                      )}
                      {staff.department && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {staff.department}
                        </p>
                      )}
                      {staff.mail && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {staff.mail}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {query.length < 2 && (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}

      {/* Selected staff display */}
      {selectedStaff && (
        <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {selectedStaff.displayName}
                </p>
                {selectedStaff.jobTitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedStaff.jobTitle} • {selectedStaff.department}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffSearch; 