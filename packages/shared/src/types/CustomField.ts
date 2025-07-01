export interface CustomField {
  id: string;
  name: string;
  fieldType: 'STRING' | 'NUMBER' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'DATE' | 'BOOLEAN';
  isRequired: boolean;
  isActive: boolean;
  options?: string[];
  createdAt: string;
  updatedAt: string;
} 