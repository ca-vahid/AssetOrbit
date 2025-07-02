import React from 'react';
import { useNavigate } from 'react-router-dom';
import { assetsApi, type StaffMember } from '../services/api';
import AssetForm from '../components/AssetForm';

interface AssetFormData {
  assetTag: string;
  assetType: string;
  status: string;
  condition: string;
  make: string;
  model: string;
  serialNumber?: string;
  assignedToAadId?: string;
  categoryIds?: string[];
  locationId?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  vendorId?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyNotes?: string;
  notes?: string;
  [key: string]: any;
}

const AddAsset: React.FC = () => {
  const navigate = useNavigate();

  const handleSubmit = async (data: AssetFormData, selectedStaff: StaffMember | null) => {
    try {
      // Extract custom field values
      const customFieldValues: Record<string, any> = {};
      Object.keys(data).forEach(key => {
        if (key.startsWith('custom_')) {
          const fieldId = key.replace('custom_', '');
          customFieldValues[fieldId] = data[key];
        }
      });

      // Build payload
      const payload = {
        assetTag: data.assetTag,
        assetType: data.assetType,
        status: data.status,
        condition: data.condition,
        make: data.make,
        model: data.model,
        serialNumber: data.serialNumber || null,
        assignedToAadId: selectedStaff?.id || null,
        categoryIds: data.categoryIds || [],
        locationId: data.locationId || null,
        purchaseDate: data.purchaseDate || null,
        purchasePrice: data.purchasePrice || null,
        vendorId: data.vendorId || null,
        warrantyStartDate: data.warrantyStartDate || null,
        warrantyEndDate: data.warrantyEndDate || null,
        warrantyNotes: data.warrantyNotes || null,
        notes: data.notes || null,
        customFields: customFieldValues,
      };

      await assetsApi.create(payload);
      navigate('/assets');
    } catch (error) {
      console.error('Failed to create asset:', error);
    }
  };

  const handleCancel = () => {
    navigate('/assets');
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <AssetForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        submitButtonText="Create Asset"
        title="Add New Asset"
        subtitle="Create a new asset record in the system"
      />
    </div>
  );
};

export default AddAsset; 