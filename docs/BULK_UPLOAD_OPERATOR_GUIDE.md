## Bulk Upload Wizard – Operator Guide

This guide explains the import flow, snapshot toggle, preview, and overrides.

### 1) Choose Source and Map Columns
- Select the import source (e.g., NinjaOne, Telus).
- Map the source columns to system fields. Ensure `Serial Number` is mapped when available.

### 2) Full Snapshot vs Partial
- Toggle: “This import is a full snapshot for this source”.
  - Full snapshot: Devices that are not in this file will be considered missing from the source and may be retired (if they are not present in any other source).
  - Partial: Missing detection is skipped; no retirements occur.

### 3) Preview – Retirements and Reactivations
- The review page loads a preview:
  - Will Reactivate: Previously RETIRED assets that reappear (matched by serial) and will be reactivated by default.
  - Will Retire: Assets currently present for the source but not included in this snapshot.
- Per-row overrides:
  - Uncheck a reactivation to keep the asset in RETIRED.
  - Check “Skip retire” for an asset to keep it active even if not in this snapshot.

### 4) Serial Number Warnings
- If rows lack a serial number, they are still displayed but cannot participate in presence tracking.
- These rows won’t trigger retirements or reactivations. (For some sources, the importer may skip items without serial.)

### 5) Results
- The results screen displays counts for Created, Updated, Retired, and Reactivated.
- You can navigate to Import Runs and the Missing by Source report for auditing.

### 6) Reports
- Import Runs: Historical list of imports with stats (created/updated/retired/reactivated).
- Missing by Source: Lists assets that are currently missing from a given source.

### 7) Notes
- Presence tracking is active only for: NinjaOne, NinjaOne Servers, Telus, Rogers.
- Manual, Excel/BGC Template, Invoice/PO entries do not participate in presence tracking.


