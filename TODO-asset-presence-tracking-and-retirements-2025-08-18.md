## TODO — Asset Source Presence Tracking & Auto-Retire/Re-Activate

Scope: Track presence of assets per external source during imports, auto-retire assets missing from a full snapshot, and auto-re-activate if they reappear. Applies to sources: `NINJAONE`, `NINJAONE_SERVERS`, `TELUS`, `ROGERS`. Excludes: `MANUAL`, `BGC_TEMPLATE/EXCEL`, `INVOICE` (PO entry).

Key identifier per source: `serialNumber` (used as `externalId`).

---

### 1) Data Model Changes

- [x] Add `ExternalSourceLink` table
  - Fields: `id`, `assetId` (FK), `sourceSystem` (enum/text), `externalId` (serial number), `firstSeenAt` (datetime), `lastSeenAt` (datetime), `isPresent` (boolean), `metadata` (JSON optional)
  - Unique constraint: (`sourceSystem`, `externalId`)
  - Indexes: `assetId`, `sourceSystem`, `externalId`, `isPresent`

- [x] Add `ImportSyncRun` table
  - Fields: `id`, `sourceSystem`, `isFullSnapshot` (boolean), `startedAt`, `finishedAt`, `stats` (JSON), `initiatedByUserId`
  - Indexes: `sourceSystem`, `startedAt`

- [x] Prisma schema updates (`packages/backend/prisma/schema.prisma`)
  - Define new models with relations to `Asset` and `User`
  - Generate migration and update Prisma Client

- [ ] Backfill script
  - Create `ExternalSourceLink` rows for existing assets where `asset.source ∈ {NINJAONE, NINJAONE_SERVERS, TELUS, ROGERS}` and `serialNumber` exists
  - Initialize `firstSeenAt`/`lastSeenAt` to `now()`, `isPresent=true`
  - Location: `packages/backend/src/scripts/backfill-external-source-links.ts`
  - [x] Implement script

Acceptance criteria
- External link rows upsert correctly and enforce uniqueness by (`sourceSystem`, `externalId`).
- Migration runs cleanly in dev and CI.

---

### 2) Backend Import Flow Changes (`packages/backend/src/routes/import.ts`)

- [x] Extend import payload schema
  - Add `isFullSnapshot: boolean`
  - Validate sources: run presence logic only for `NINJAONE`, `NINJAONE_SERVERS`, `TELUS`, `ROGERS`

- [x] On import start
  - Create `ImportSyncRun` row with `startedAt`, `sourceSystem`, `isFullSnapshot`, `initiatedByUserId`
  - Store `syncStartTime` for missing sweep

- [x] Per-row processing (after current transform/match/upsert logic)
  - Resolve/create `Asset` as today (serial → tag conflict resolution unchanged)
  - Upsert `ExternalSourceLink` by (`sourceSystem`, `externalId`=serialNumber)
    - Set `assetId`, `lastSeenAt=now()`, `firstSeenAt` if new, `isPresent=true`
  - Reappearance default: if `asset.status === 'RETIRED'`, schedule default status change → `ASSIGNED` if user mapped, else `AVAILABLE` (allow override via frontend flags)

- [x] End-of-run sweep (only if `isFullSnapshot`)
  - Find `ExternalSourceLink` for `sourceSystem` where `isPresent=true` AND `lastSeenAt < syncStartTime`
  - For each:
    - Set `isPresent=false`
    - If the owning `Asset` has no other `ExternalSourceLink.isPresent=true`, set `Asset.status='RETIRED'`
    - Record activity log entries for retirements

- [x] Response summary
  - Return counts and lists: `created`, `updated`, `retired`, `reappeared`, `skipped`, `errors`
  - Include `syncRunId`

- [x] Audit
  - Write `ActivityLog` entries for retirements and reactivations with `syncRunId`

Acceptance criteria
- Missing-from-source detection runs only when `isFullSnapshot=true`.
- Assets not present in the snapshot are retired unless still present in another source.
- Reappeared assets are re-activated by default (ASSIGNED/AVAILABLE) and included in the summary.

---

### 3) Frontend Wizard Updates

Files: `packages/frontend/src/pages/BulkUpload.tsx`, `components/import-wizard/steps/StepConfirm.tsx`, `hooks/useImportAssets.ts`

- [x] StepConfirm: Add toggle "This import is a full snapshot for this source" (default: on)
  - Wire to payload as `isFullSnapshot`

- [x] StepConfirm: Preview groups and overrides
  - Show: `New`, `Updated`, `Will be retired (missing from this source)`, `Reappeared (will re-activate)`
  - [x] Per-row checkboxes to override retire/reactivate action (wires `retireSkipAssetIds`, `reactivationAllowSerials`)
  - Warning badge for rows without `serialNumber` (presence tracking not possible)

- [ ] StepProgress/Results
  - [x] Display counts for `created`, `updated`, `retired`, `reappeared`, `skipped`, `errors`
  - Link to run details (see reporting section)

Acceptance criteria
- Users can mark a run as full or partial; partial skips retire sweep.
- Users can override retire/reactivate per row before submission.

---

### 4) Reporting & Visibility

- [x] New page: "Source Sync Runs"
  - List `ImportSyncRun` entries with `sourceSystem`, `isFullSnapshot`, timestamps, stats
  - Drill-down to view affected assets (retired/reappeared/updated)

- [ ] Asset UI badges
  - [x] Basic badges: show per-source "Missing from <Source> since <date>" in `AssetList` and `AssetDetailView`
  - On asset details/list, show per-source badge: `Missing from <Source> since <date>` if any `ExternalSourceLink.isPresent=false`
  - [x] Filters: `Missing from [Source]` (query param `missingSource`)

- [x] Dedicated report: "Missing by Source"
  - Filter by `sourceSystem`, date range
  - Actions: acknowledge on asset (no functional change beyond visibility), quick link to asset

Acceptance criteria
- Operators can audit historical runs and see exactly which assets were affected.
- Missing-from-source signals are visible and filterable.

---

### 5) Exclusions & Rules Enforcement

- [x] Skip presence tracking logic entirely for sources: `MANUAL`, `BGC_TEMPLATE/EXCEL`, `INVOICE` (presence tracking only enabled for supported sources)
- [ ] Rows without `serialNumber`: import allowed, presence tracking skipped; warn user in review

Acceptance criteria
- No retire/reactivation occurs for excluded sources or serial-less rows.

---

### 6) Testing Plan

Backend unit/integration
- [ ] ExternalSourceLink upsert behavior (new vs existing; lastSeenAt updates)
- [ ] End-of-run missing sweep sets `isPresent=false` and retires assets with no other present sources
- [ ] Reappearance flow: re-activate retired asset on subsequent import; default to ASSIGNED if assignee present else AVAILABLE
- [ ] Exclusion paths: excluded sources never trigger presence logic
- [ ] Partial run: `isFullSnapshot=false` → no retire sweep
- [ ] Conflict logic unchanged for serial/tag collisions (regression tests)
- [ ] ActivityLog entries created with correct payloads

Frontend unit/integration
- [x] StepConfirm renders snapshot toggle and includes it in payload
- [x] Review groups show correct counts based on preview API
- [x] Per-row overrides reflected in final payload flags
- [x] Serial-missing rows display warnings
- [x] Results view shows returned counts and links
- [x] Enhanced snapshot toggle with prominent UI design

End-to-end/manual QA
- [ ] Import full NinjaOne snapshot; verify: creates/updates, retires missing, shows summary
- [ ] Import partial snapshot; verify no retire sweep
- [ ] Re-import with previously missing asset present; verify reactivation to ASSIGNED/AVAILABLE
- [ ] Multi-source asset present in Telus but missing in NinjaOne remains active; NinjaOne flagged missing only
- [ ] Excluded sources (Excel/Invoice/Manual) do not affect presence or status

---

### 7) Migration & Rollout

- [ ] Create and run Prisma migration; verify in CI
- [ ] Backfill script execution in staging → production (with timings recorded)
- [ ] Feature flag (optional): gate retire/reactivate behavior per source during rollout
- [ ] Monitoring: temporarily log retire/reactivate counts at INFO level post-deploy

Rollback plan
- Schema additions are additive; to disable behavior, flip feature flag and/or send `isFullSnapshot=false` until follow-up

---

### 8) Documentation

- [x] Update `docs/REFACTORED_IMPORT_ARCHITECTURE.md` to include presence tracking and run lifecycle
- [x] Add a short operator guide for the Bulk Upload wizard explaining the snapshot toggle and review groups (`docs/BULK_UPLOAD_OPERATOR_GUIDE.md`)

---

### 9) Acceptance Criteria (Summary)

- Presence tracking uses `serialNumber` per source; runs only for supported sources
- Full-snapshot imports retire assets missing from that source unless present in another source
- Reappearing assets default to re-activate; operator can override
- UI provides snapshot toggle, review groups, and clear results
- Historical run reporting is available; asset-level source-missing badges visible
- No hard deletes; all actions audited


