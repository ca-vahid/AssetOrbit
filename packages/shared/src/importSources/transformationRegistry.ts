/**
 * Transformation Registry - Central API for Import Sources
 * 
 * This registry provides a unified interface to access all import source transformations.
 * It acts as the single entry point for both frontend and backend.
 */

import { transformNinjaOneRow, transformNinjaOneServerRow, NINJA_ONE_MAPPINGS, NINJA_ONE_SERVER_MAPPINGS, validateNinjaOneData } from './ninjaOneTransforms';
import { transformTelusPhoneRow, TELUS_PHONE_MAPPINGS, validateTelusPhoneData } from './telusTransforms';
import { transformRogersPhoneRow, ROGERS_PHONE_MAPPINGS, validateRogersPhoneData } from './rogersTransforms';
import { transformBGCTemplateRow, BGC_TEMPLATE_MAPPINGS, validateBGCTemplateData } from './bgcTemplateTransforms';
import type { ColumnMapping, TransformationResult } from '../importTransformations';

// ============================================================================
// TYPES
// ============================================================================

export type ImportSourceType = 'telus' | 'rogers' | 'ninjaone' | 'ninjaone-servers' | 'bgc-template';

export interface ImportSourceTransformer {
  transformRow: (row: Record<string, string>) => TransformationResult;
  getMappings: () => ColumnMapping[];
  validateData: (data: any) => { isValid: boolean; errors: string[] };
}

// ============================================================================
// TRANSFORMATION REGISTRY
// ============================================================================

export const IMPORT_TRANSFORMATION_REGISTRY: Record<ImportSourceType, ImportSourceTransformer> = {
  'telus': {
    transformRow: transformTelusPhoneRow,
    getMappings: () => TELUS_PHONE_MAPPINGS,
    validateData: (data: any) => {
      const errors = validateTelusPhoneData(data);
      return { isValid: errors.length === 0, errors };
    },
  },
  'rogers': {
    transformRow: transformRogersPhoneRow,
    getMappings: () => ROGERS_PHONE_MAPPINGS,
    validateData: (data: any) => {
      const errors = validateRogersPhoneData(data);
      return { isValid: errors.length === 0, errors };
    },
  },
  'ninjaone': {
    transformRow: transformNinjaOneRow,
    getMappings: () => NINJA_ONE_MAPPINGS,
    validateData: (data: any) => {
      const errors = validateNinjaOneData(data);
      return { isValid: errors.length === 0, errors };
    },
  },
  'ninjaone-servers': {
    transformRow: transformNinjaOneServerRow,
    getMappings: () => NINJA_ONE_SERVER_MAPPINGS,
    validateData: (data: any) => {
      const errors = validateNinjaOneData(data);
      return { isValid: errors.length === 0, errors };
    },
  },
  'bgc-template': {
    transformRow: transformBGCTemplateRow,
    getMappings: () => BGC_TEMPLATE_MAPPINGS,
    validateData: (data: any) => {
      const errors = validateBGCTemplateData(data);
      return { isValid: errors.length === 0, errors };
    },
  },
};

// ============================================================================
// UNIFIED API FUNCTIONS
// ============================================================================

/**
 * Get the transformer for a specific import source
 */
export function getImportTransformer(sourceType: ImportSourceType): ImportSourceTransformer {
  const transformer = IMPORT_TRANSFORMATION_REGISTRY[sourceType];
  if (!transformer) {
    throw new Error(`Unsupported import source: ${sourceType}`);
  }
  return transformer;
}

/**
 * Transform a single row using the appropriate source transformer
 */
export function transformImportRow(sourceType: ImportSourceType, row: Record<string, string>): TransformationResult {
  const transformer = getImportTransformer(sourceType);
  return transformer.transformRow(row);
}

/**
 * Get column mappings for a specific import source
 */
export function getImportMappings(sourceType: ImportSourceType): ColumnMapping[] {
  const transformer = getImportTransformer(sourceType);
  return transformer.getMappings();
}

/**
 * Validate data for a specific import source
 */
export function validateImportData(sourceType: ImportSourceType, data: any): { isValid: boolean; errors: string[] } {
  const transformer = getImportTransformer(sourceType);
  return transformer.validateData(data);
}

/**
 * Transform multiple rows (batch processing)
 */
export function transformImportData(sourceType: ImportSourceType, rows: Record<string, string>[]): TransformationResult[] {
  return rows.map(row => transformImportRow(sourceType, row));
}

/**
 * Get all supported import sources
 */
export function getSupportedImportSources(): ImportSourceType[] {
  return Object.keys(IMPORT_TRANSFORMATION_REGISTRY) as ImportSourceType[];
}

/**
 * Check if an import source is supported
 */
export function isImportSourceSupported(sourceType: string): sourceType is ImportSourceType {
  return sourceType in IMPORT_TRANSFORMATION_REGISTRY;
} 