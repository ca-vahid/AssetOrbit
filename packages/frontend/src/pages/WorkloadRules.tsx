import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { workloadRulesApi, categoriesApi, type WorkloadCategoryRule, type WorkloadCategory } from '../services/api';

interface RuleFormData {
  categoryId: string;
  priority: number;
  sourceField: string;
  operator: string;
  value: string;
  description: string;
  isActive: boolean;
}

const OPERATORS = [
  { value: '=', label: 'Equals (=)', description: 'Exact match (case-insensitive)', category: 'text' },
  { value: '!=', label: 'Not equals (!=)', description: 'Not equal (case-insensitive)', category: 'text' },
  { value: '>=', label: 'Greater or equal (>=)', description: 'Greater than or equal (numeric)', category: 'numeric' },
  { value: '<=', label: 'Less or equal (<=)', description: 'Less than or equal (numeric)', category: 'numeric' },
  { value: '>', label: 'Greater than (>)', description: 'Greater than (numeric)', category: 'numeric' },
  { value: '<', label: 'Less than (<)', description: 'Less than (numeric)', category: 'numeric' },
  { value: 'includes', label: 'Contains', description: 'Contains substring (case-insensitive)', category: 'text' },
  { value: 'regex', label: 'Regex pattern', description: 'Regular expression match (case-insensitive)', category: 'advanced' },
];

const SOURCE_FIELDS = [
  { 
    value: 'assetType', 
    label: 'Asset Type', 
    description: 'LAPTOP, DESKTOP, TABLET, PHONE, OTHER',
    category: 'basic',
    examples: ['LAPTOP', 'DESKTOP', 'TABLET'],
    operators: ['=', '!=', 'includes']
  },
  { 
    value: 'status', 
    label: 'Status', 
    description: 'AVAILABLE, ASSIGNED, SPARE, MAINTENANCE, RETIRED, DISPOSED',
    category: 'basic',
    examples: ['AVAILABLE', 'ASSIGNED', 'SPARE'],
    operators: ['=', '!=', 'includes']
  },
  { 
    value: 'condition', 
    label: 'Condition', 
    description: 'NEW, GOOD, FAIR, POOR',
    category: 'basic',
    examples: ['NEW', 'GOOD', 'FAIR', 'POOR'],
    operators: ['=', '!=', 'includes']
  },
  { 
    value: 'make', 
    label: 'Make', 
    description: 'Manufacturer name',
    category: 'basic',
    examples: ['Apple', 'Dell', 'HP', 'Lenovo'],
    operators: ['=', '!=', 'includes', 'regex']
  },
  { 
    value: 'model', 
    label: 'Model', 
    description: 'Device model',
    category: 'basic',
    examples: ['MacBook Pro', 'ThinkPad', 'OptiPlex'],
    operators: ['=', '!=', 'includes', 'regex']
  },
  { 
    value: 'assignedToAadId', 
    label: 'Assigned User ID', 
    description: 'Azure AD user ID or username',
    category: 'assignment',
    examples: ['john.doe', 'skypeduplicatecontacts'],
    operators: ['=', '!=', 'includes']
  },
  { 
    value: 'specifications.ram', 
    label: 'RAM', 
    description: 'Memory amount (e.g., "16GB DDR4")',
    category: 'specs',
    examples: ['16GB', '32GB', '64GB DDR4'],
    operators: ['=', '!=', 'includes', 'regex', '>=', '<=', '>', '<']
  },
  { 
    value: 'specifications.processor', 
    label: 'Processor', 
    description: 'CPU model',
    category: 'specs',
    examples: ['Intel i7', 'AMD Ryzen', 'Apple M1'],
    operators: ['=', '!=', 'includes', 'regex']
  },
  { 
    value: 'specifications.storage', 
    label: 'Storage', 
    description: 'Storage capacity',
    category: 'specs',
    examples: ['512GB SSD', '1TB SSD', '256GB'],
    operators: ['=', '!=', 'includes', 'regex', '>=', '<=', '>', '<']
  },
  { 
    value: 'specifications.graphics', 
    label: 'Graphics', 
    description: 'Graphics card',
    category: 'specs',
    examples: ['NVIDIA RTX', 'Intel Iris', 'AMD Radeon'],
    operators: ['=', '!=', 'includes', 'regex']
  },
  { 
    value: 'specifications.operatingSystem', 
    label: 'Operating System', 
    description: 'OS version',
    category: 'specs',
    examples: ['Windows 11', 'macOS Ventura', 'Ubuntu'],
    operators: ['=', '!=', 'includes', 'regex']
  },
];

const WorkloadRules: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkloadCategoryRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<WorkloadCategoryRule | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'priority' | 'category' | 'createdAt'>('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const queryClient = useQueryClient();

  // Fetch rules and categories
  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['workload-rules'],
    queryFn: workloadRulesApi.getAll,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['workload-categories'],
    queryFn: categoriesApi.getAll,
  });

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Mutations
  const createRuleMutation = useMutation({
    mutationFn: workloadRulesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workload-rules'] });
      setIsCreateModalOpen(false);
      setToast({ message: 'Rule created successfully', type: 'success' });
    },
    onError: (error: any) => {
      setToast({ message: error.response?.data?.error || 'Failed to create rule', type: 'error' });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<RuleFormData>) =>
      workloadRulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workload-rules'] });
      setEditingRule(null);
      setToast({ message: 'Rule updated successfully', type: 'success' });
    },
    onError: (error: any) => {
      setToast({ message: error.response?.data?.error || 'Failed to update rule', type: 'error' });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: workloadRulesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workload-rules'] });
      setDeletingRule(null);
      setToast({ message: 'Rule deleted successfully', type: 'success' });
    },
    onError: (error: any) => {
      setToast({ message: error.response?.data?.error || 'Failed to delete rule', type: 'error' });
    },
  });

  // Sort rules
  const sortedRules = React.useMemo(() => {
    const sorted = [...rules].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'priority':
          aValue = a.priority;
          bValue = b.priority;
          break;
        case 'category':
          aValue = a.category.name;
          bValue = b.category.name;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return sorted;
  }, [rules, sortBy, sortOrder]);

  const handleSort = (field: 'priority' | 'category' | 'createdAt') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4" />
    ) : (
      <ChevronDownIcon className="w-4 h-4" />
    );
  };

  const getOperatorDescription = (operator: string) => {
    return OPERATORS.find(op => op.value === operator)?.description || operator;
  };

  const getSourceFieldDescription = (field: string) => {
    return SOURCE_FIELDS.find(sf => sf.value === field)?.description || field;
  };

  if (rulesLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Workload Category Rules
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Configure automatic workload category detection during asset imports
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Rule
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-blue-800 dark:text-blue-200 font-medium">How Rules Work</p>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                Rules are evaluated in priority order (1 = highest) during asset imports. 
                The first matching rule assigns its category to the asset. Rules can evaluate 
                any asset field or nested specification using various operators.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Detection Rules ({rules.length})
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Click on a rule to view details
            </div>
          </div>
        </div>

        {rules.length === 0 ? (
          <div className="p-12 text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No rules configured
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Create your first rule to enable automatic workload category detection.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Add First Rule
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('priority')}
                  >
                    <div className="flex items-center gap-1">
                      Priority
                      {getSortIcon('priority')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center gap-1">
                      Category
                      {getSortIcon('category')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedRules.map((rule) => (
                  <React.Fragment key={rule.id}>
                    <tr
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {rule.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {rule.category.name}
                        </div>
                        {rule.category.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {rule.category.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                            {rule.sourceField} {rule.operator} "{rule.value}"
                          </code>
                        </div>
                        {rule.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {rule.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          rule.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRule(rule);
                            }}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingRule(rule);
                            }}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRule === rule.id && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50 dark:bg-gray-700">
                          <div className="space-y-3">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                Rule Details
                              </h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Source Field:</span>
                                  <div className="text-gray-600 dark:text-gray-400">
                                    {rule.sourceField}
                                    <div className="text-xs text-gray-500 dark:text-gray-500">
                                      {getSourceFieldDescription(rule.sourceField)}
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Operator:</span>
                                  <div className="text-gray-600 dark:text-gray-400">
                                    {rule.operator}
                                    <div className="text-xs text-gray-500 dark:text-gray-500">
                                      {getOperatorDescription(rule.operator)}
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Value:</span>
                                  <div className="text-gray-600 dark:text-gray-400">
                                    "{rule.value}"
                                  </div>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Created:</span>
                                  <div className="text-gray-600 dark:text-gray-400">
                                    {new Date(rule.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Rule Modal */}
      <RuleModal
        isOpen={isCreateModalOpen || !!editingRule}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingRule(null);
        }}
        rule={editingRule}
        categories={categories}
        onSubmit={(data) => {
          if (editingRule) {
            updateRuleMutation.mutate({ id: editingRule.id, ...data });
          } else {
            createRuleMutation.mutate(data);
          }
        }}
        isLoading={createRuleMutation.isPending || updateRuleMutation.isPending}
      />

      {/* Delete Confirmation Modal */}
      <Transition appear show={!!deletingRule} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setDeletingRule(null)}
        >
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                    >
                      Delete Rule
                    </Dialog.Title>
                  </div>

                  <div className="mb-6">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Are you sure you want to delete this rule? This action cannot be undone.
                    </p>
                    {deletingRule && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {deletingRule.category.name}
                          </div>
                          <div className="text-gray-600 dark:text-gray-400">
                            {deletingRule.sourceField} {deletingRule.operator} "{deletingRule.value}"
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      onClick={() => setDeletingRule(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                      onClick={() => deletingRule && deleteRuleMutation.mutate(deletingRule.id)}
                      disabled={deleteRuleMutation.isPending}
                    >
                      {deleteRuleMutation.isPending ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Toast Notifications */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`px-6 py-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            <div className="flex items-center">
              {toast.type === 'success' ? (
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <ExclamationTriangleIcon className="w-6 h-6 mr-2" />
              )}
              <div>
                <div className={`font-medium ${
                  toast.type === 'success'
                    ? 'text-green-100'
                    : 'text-red-100'
                }`}>
                  {toast.type === 'success' ? 'Success' : 'Error'}
                </div>
                <div className={`text-sm ${
                  toast.type === 'success'
                    ? 'text-green-200'
                    : 'text-red-200'
                }`}>
                  {toast.message}
                </div>
              </div>
              <button
                onClick={() => setToast(null)}
                className={`ml-4 ${
                  toast.type === 'success'
                    ? 'text-green-200 hover:text-green-100'
                    : 'text-red-200 hover:text-red-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Rule Modal Component
interface RuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  rule?: WorkloadCategoryRule | null;
  categories: WorkloadCategory[];
  onSubmit: (data: RuleFormData) => void;
  isLoading: boolean;
}

const RuleModal: React.FC<RuleModalProps> = ({
  isOpen,
  onClose,
  rule,
  categories,
  onSubmit,
  isLoading,
}) => {
  const [formData, setFormData] = useState<RuleFormData>({
    categoryId: '',
    priority: 999,
    sourceField: '',
    operator: '=',
    value: '',
    description: '',
    isActive: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (rule) {
      setFormData({
        categoryId: rule.categoryId,
        priority: rule.priority,
        sourceField: rule.sourceField,
        operator: rule.operator,
        value: rule.value,
        description: rule.description || '',
        isActive: rule.isActive,
      });
    } else {
      setFormData({
        categoryId: '',
        priority: 999,
        sourceField: '',
        operator: '=',
        value: '',
        description: '',
        isActive: true,
      });
    }
    setErrors({});
  }, [rule, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.categoryId) {
      newErrors.categoryId = 'Category is required';
    }
    if (!formData.sourceField) {
      newErrors.sourceField = 'Source field is required';
    }
    if (!formData.operator) {
      newErrors.operator = 'Operator is required';
    }
    if (!formData.value.trim()) {
      newErrors.value = 'Value is required';
    }
    if (formData.priority < 1 || formData.priority > 9999) {
      newErrors.priority = 'Priority must be between 1 and 9999';
    }

    // Validate regex if operator is regex
    if (formData.operator === 'regex' && formData.value.trim()) {
      try {
        new RegExp(formData.value);
      } catch (e) {
        newErrors.value = 'Invalid regular expression pattern';
      }
    }

    // Validate numeric operators have numeric values where appropriate
    if (['>=', '<=', '>', '<'].includes(formData.operator) && formData.value.trim()) {
      const numValue = Number(formData.value);
      if (isNaN(numValue)) {
        newErrors.value = 'Numeric operators require numeric values';
      }
    }

    // Validate field-specific constraints
    const selectedField = SOURCE_FIELDS.find(f => f.value === formData.sourceField);
    if (selectedField && !selectedField.operators.includes(formData.operator)) {
      newErrors.operator = `Operator "${formData.operator}" is not supported for field "${selectedField.label}"`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-6"
                >
                  {rule ? 'Edit Rule' : 'Create New Rule'}
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Workload Category *
                      </label>
                      <select
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.categoryId ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select category...</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      {errors.categoryId && (
                        <p className="text-red-500 text-sm mt-1">{errors.categoryId}</p>
                      )}
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Priority *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 999 })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.priority ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="1 = highest priority"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Lower numbers = higher priority (1 = highest)
                      </p>
                      {errors.priority && (
                        <p className="text-red-500 text-sm mt-1">{errors.priority}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Source Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Source Field *
                      </label>
                      <select
                        value={formData.sourceField}
                        onChange={(e) => setFormData({ ...formData, sourceField: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.sourceField ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select field...</option>
                        {SOURCE_FIELDS.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                      {formData.sourceField && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {SOURCE_FIELDS.find(f => f.value === formData.sourceField)?.description}
                        </p>
                      )}
                      {errors.sourceField && (
                        <p className="text-red-500 text-sm mt-1">{errors.sourceField}</p>
                      )}
                    </div>

                    {/* Operator */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Operator *
                      </label>
                      <select
                        value={formData.operator}
                        onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.operator ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select operator...</option>
                        {OPERATORS
                          .filter(op => {
                            const selectedField = SOURCE_FIELDS.find(f => f.value === formData.sourceField);
                            return !selectedField || selectedField.operators.includes(op.value);
                          })
                          .map((operator) => (
                            <option key={operator.value} value={operator.value}>
                              {operator.label}
                            </option>
                          ))}
                      </select>
                      {formData.operator && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {OPERATORS.find(op => op.value === formData.operator)?.description}
                        </p>
                      )}
                      {errors.operator && (
                        <p className="text-red-500 text-sm mt-1">{errors.operator}</p>
                      )}
                    </div>
                  </div>

                  {/* Value and Description */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Value */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Value *
                      </label>
                      <input
                        type="text"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.value ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder={
                          formData.sourceField === 'specifications.ram'
                            ? 'e.g., 64GB DDR4'
                            : formData.sourceField === 'specifications.ram'
                            ? 'e.g., 64'
                            : formData.sourceField === 'assignedToAadId'
                            ? 'e.g., john.doe'
                            : formData.operator === 'regex'
                            ? 'e.g., (64|128)\\s*GB'
                            : 'Enter value...'
                        }
                      />
                      {formData.sourceField && (
                        <div className="mt-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Examples: {SOURCE_FIELDS.find(f => f.value === formData.sourceField)?.examples?.join(', ')}
                          </p>
                        </div>
                      )}
                      {errors.value && (
                        <p className="text-red-500 text-sm mt-1">{errors.value}</p>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Operator *
                      </label>
                      <select
                        value={formData.operator}
                        onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.operator ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                      {formData.operator && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {OPERATORS.find(op => op.value === formData.operator)?.description}
                        </p>
                      )}
                      {errors.operator && (
                        <p className="text-red-500 text-sm mt-1">{errors.operator}</p>
                      )}
                    </div>
                  </div>

                  {/* Value */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Value *
                    </label>
                    <input
                      type="text"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        errors.value ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder={
                        formData.operator === 'regex' 
                          ? 'Regular expression pattern' 
                          : formData.sourceField === 'specifications.ram'
                          ? 'e.g., 16GB or (6[4-9]|[7-9][0-9])\\s*GB'
                          : 'Value to match against'
                      }
                    />
                    {formData.operator === 'regex' && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Use JavaScript regex syntax. Pattern will be case-insensitive.
                      </p>
                    )}
                    {errors.value && (
                      <p className="text-red-500 text-sm mt-1">{errors.value}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Optional description for this rule"
                    />
                  </div>

                  {/* Active Status */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Rule is active
                    </label>
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isLoading ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default WorkloadRules; 