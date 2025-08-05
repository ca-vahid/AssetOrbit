/**
 * Shared Import Transformation Library
 * 
 * This package contains all shared transformation logic for import processing.
 * Used by both frontend (preview) and backend (actual import) to ensure consistency.
 */

// Core transformation utilities
export * from './importTransformations';

// Source-specific transformation modules (selective exports to avoid conflicts)
export { 
  transformNinjaOneRow,
  transformNinjaOneServerRow,
  getNinjaOneMapping, 
  validateNinjaOneData,
  NINJA_ONE_MAPPINGS,
  NINJA_ONE_SERVER_MAPPINGS,
  filterNinjaOneEndpoints,
  filterNinjaOneServers
} from './importSources/ninjaOneTransforms';

export { 
  transformTelusPhoneRow, 
  getTelusMapping, 
  validateTelusPhoneData,
  TELUS_PHONE_MAPPINGS,
  generatePhoneAssetTag as generateTelusPhoneAssetTag
} from './importSources/telusTransforms';

export { 
  transformBGCTemplateRow, 
  getBGCTemplateMapping, 
  validateBGCTemplateData,
  BGC_TEMPLATE_MAPPINGS,
  normalizeBGCAssetTag as normalizeBGCTemplateAssetTag
} from './importSources/bgcTemplateTransforms';

export { 
  transformRogersPhoneRow, 
  getRogersMapping, 
  validateRogersPhoneData,
  ROGERS_PHONE_MAPPINGS,
  generateRogersPhoneAssetTag,
  parseRogersDeviceName
} from './importSources/rogersTransforms';

// Main transformation registry (primary API)
export * from './importSources/transformationRegistry';

// Re-export key types for convenience
export type {
  ColumnMapping,
  TransformationResult
} from './importTransformations';

export type {
  ImportSourceType,
  ImportSourceTransformer
} from './importSources/transformationRegistry'; 