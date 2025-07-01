import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { customFieldsApi } from '../services/api';
import type { CustomField } from '@ats/shared';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';

interface CustomFieldFormData {
  name: string;
  fieldType: CustomField['fieldType'];
  isRequired: boolean;
  options?: string;
}

const FIELD_TYPE_OPTIONS = [
  { value: 'STRING', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'SINGLE_SELECT', label: 'Single Select' },
  { value: 'MULTI_SELECT', label: 'Multi Select' },
  { value: 'DATE', label: 'Date' },
  { value: 'BOOLEAN', label: 'Yes/No' },
] as const;

const CustomFields: React.FC = () => {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomFieldFormData>();

  const fieldType = watch('fieldType');
  const isSelectType = fieldType === 'SINGLE_SELECT' || fieldType === 'MULTI_SELECT';

  useEffect(() => {
    loadCustomFields();
  }, []);

  const loadCustomFields = async () => {
    try {
      setLoading(true);
      const fields = await customFieldsApi.getAll();
      setCustomFields(fields);
    } catch (err) {
      setError('Failed to load custom fields');
      console.error('Error loading custom fields:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (field?: CustomField) => {
    setEditingField(field || null);
    if (field) {
      reset({
        name: field.name,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        options: field.options?.join('\n') || '',
      });
    } else {
      reset({
        name: '',
        fieldType: 'STRING',
        isRequired: false,
        options: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingField(null);
    reset();
  };

  const onSubmit = async (data: CustomFieldFormData) => {
    try {
      const payload = {
        name: data.name,
        fieldType: data.fieldType,
        isRequired: data.isRequired,
        options: isSelectType && data.options 
          ? data.options.split('\n').filter(opt => opt.trim()).map(opt => opt.trim())
          : undefined,
      };

      if (editingField) {
        await customFieldsApi.update(editingField.id, payload);
      } else {
        await customFieldsApi.create(payload);
      }

      await loadCustomFields();
      handleCloseModal();
    } catch (err) {
      console.error('Error saving custom field:', err);
      setError('Failed to save custom field');
    }
  };

  const getFieldTypeLabel = (type: string) => {
    return FIELD_TYPE_OPTIONS.find(opt => opt.value === type)?.label || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Custom Fields
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage dynamic fields for assets
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Field
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Custom Fields Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-glass border border-white/20 dark:border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Required
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Options
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {customFields.map((field) => (
                <tr key={field.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {field.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      {getFieldTypeLabel(field.fieldType)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      field.isRequired
                        ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                    }`}>
                      {field.isRequired ? 'Required' : 'Optional'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      field.isActive
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400'
                    }`}>
                      {field.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {field.options?.length ? `${field.options.length} options` : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(field)}
                      className="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 mr-3"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {customFields.length === 0 && (
          <div className="text-center py-12">
            <div className="text-slate-400 dark:text-slate-500">
              No custom fields defined yet.
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="mt-2 text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Create your first custom field
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-white/20 dark:border-slate-700/50 w-full max-w-md z-50">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {editingField ? 'Edit Custom Field' : 'Add Custom Field'}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Field Name
                  </label>
                  <input
                    {...register('name', { required: 'Field name is required' })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="e.g., Processor Type"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Field Type
                  </label>
                  <select
                    {...register('fieldType', { required: 'Field type is required' })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    {FIELD_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {isSelectType && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Options (one per line)
                    </label>
                    <textarea
                      {...register('options')}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                    />
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    {...register('isRequired')}
                    type="checkbox"
                    className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                  />
                  <label className="ml-2 text-sm text-slate-700 dark:text-slate-300">
                    Required field
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? 'Saving...' : editingField ? 'Update' : 'Create'}
                  </button>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                </div>
              </form>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default CustomFields; 