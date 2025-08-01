-- ============================================================================
-- SQL QUERIES FOR GOLDEN MASTER EXTRACTION
-- ============================================================================

-- Extract complete asset records after successful import
-- Replace 'your-import-batch-id' with the actual batch ID from your import
SELECT 
  a.id,
  a.assetTag,
  a.serialNumber,
  a.model,
  a.make,
  a.assetType,
  a.condition,
  a.status,
  a.source,
  
  -- Azure AD resolved fields
  a.assignedToAadId,
  a.assignedToDisplayName,
  a.assignedToEmail,
  a.assignedToDepartment,
  
  -- Location resolved fields  
  l.id AS locationId,
  l.name AS locationName,
  l.abbreviation AS locationAbbreviation,
  
  -- Specifications (JSON field)
  a.specifications,
  
  -- Audit trail
  a.createdAt,
  a.updatedAt,
  a.importBatchId,
  a.importSourceFile,
  a.importedBy
  
FROM assets a
LEFT JOIN locations l ON a.locationId = l.id
WHERE a.source = 'TELUS' 
  AND a.importBatchId = 'your-import-batch-id'
ORDER BY a.createdAt;

-- ============================================================================
-- VERIFY AZURE AD RESOLUTION WORKED
-- ============================================================================

-- Check that all users were resolved from GUIDs to display names
SELECT 
  assignedToAadId,
  assignedToDisplayName,
  assignedToEmail,
  locationName,
  COUNT(*) as phone_count
FROM assets a
LEFT JOIN locations l ON a.locationId = l.id  
WHERE source = 'TELUS'
  AND assignedToAadId IS NOT NULL
  AND assignedToAadId LIKE '%-%-%-%-%'  -- GUID pattern
GROUP BY assignedToAadId, assignedToDisplayName, assignedToEmail, locationName
ORDER BY assignedToDisplayName;

-- ============================================================================
-- IDENTIFY UNRESOLVED USERS (SHOULD BE EMPTY FOR GOOD GOLDEN MASTERS)
-- ============================================================================

-- Find any phones where Azure AD resolution failed
SELECT 
  assetTag,
  assignedToAadId,
  assignedToDisplayName,
  'Missing display name' as issue
FROM assets 
WHERE source = 'TELUS'
  AND assignedToAadId IS NOT NULL
  AND (assignedToDisplayName IS NULL OR assignedToDisplayName = assignedToAadId)
  
UNION ALL

-- Find any phones where location resolution failed  
SELECT 
  assetTag,
  assignedToAadId,
  assignedToDisplayName,
  'Missing location' as issue
FROM assets a
WHERE source = 'TELUS'
  AND assignedToAadId IS NOT NULL
  AND locationId IS NULL;

-- ============================================================================
-- EXPORT FOR GOLDEN MASTER FILES
-- ============================================================================

-- Export individual records as JSON (PostgreSQL example)
-- For each asset, run this query and save as {asset-id}.json
SELECT row_to_json(asset_with_location) 
FROM (
  SELECT 
    a.*,
    l.name AS locationName,
    l.abbreviation AS locationAbbreviation
  FROM assets a
  LEFT JOIN locations l ON a.locationId = l.id
  WHERE a.id = 'asset-12345'  -- Replace with actual asset ID
) asset_with_location;

-- ============================================================================
-- VALIDATION QUERIES FOR SPECIFIC EXAMPLES
-- ============================================================================

-- Verify the user GUID → Vancouver location mapping works
-- This should return the user with location "Vancouver, BC"
SELECT 
  assignedToAadId,
  assignedToDisplayName,
  locationName,
  specifications->>'phoneNumber' as phone,
  make,
  model,
  specifications->>'storage' as storage
FROM assets a
LEFT JOIN locations l ON a.locationId = l.id
WHERE assignedToAadId = '09f720a5-d3d1-45ec-94b6-471c89277735'
  AND source = 'TELUS';

-- Expected result:
-- assignedToAadId: 09f720a5-d3d1-45ec-94b6-471c89277735
-- assignedToDisplayName: John Smith  
-- locationName: Vancouver, BC
-- phone: 6045550123
-- make: Samsung
-- model: Galaxy S23
-- storage: 256GB 