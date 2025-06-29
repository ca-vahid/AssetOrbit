Product Description: Asset Tracking System
Overview
A modern web-based asset tracking system to replace Excel-based laptop/endpoint inventory management. The system tracks IT assets (initially laptops, expandable to other device types) for a company with 20-30 users and a growing inventory of 100-150 laptops (adding 10-20 per day).
Core Purpose

Replace error-prone Excel spreadsheet with a proper multi-user database application
Enable efficient searching, filtering, and updating of laptop inventory
Track laptop assignments, status, condition, and associated support tickets
Provide role-based access (read-only viewers and read-write editors)

Tech Stack Requirements

Frontend: React with TypeScript, Tailwind CSS, Vite
Backend: Node.js with TypeScript, Express/Fastify
Database: Azure SQL Database
Authentication: Azure Active Directory (SSO)
Hosting: Azure App Service
State Management: Redux Toolkit or Zustand
UI Library: Headless UI/Radix UI components
Data Grid: TanStack Table (React Table)

Key Features
1. Dashboard (Landing Page)

Summary cards showing: total assets, available laptops, assigned devices, spare units
Quick action buttons for common tasks
Recent activity feed

2. Asset List View (Primary Interface)

Search: Global search bar with live results (debounced)
Filters: Status (available/assigned/spare/retired), condition, device type, date ranges
Data Table:

50-100 items per page
Customizable columns (show/hide, reorder, resize)
Default columns: Asset ID, Type, Make/Model, Specs (CPU/RAM/Storage), Serial Number, Status, Condition, Assigned To, Location, Tickets
Sortable columns
Row selection for bulk operations
Quick actions per row (edit, change status, view history)



3. Add/Edit Assets

Dedicated page for adding assets
Single asset form with all fields
Bulk upload support:

Accept CSV, Excel, PDF files (invoices)
Extract data from PDFs using OCR
Preview and map fields before import
Validation and error handling


Some fields read-only, others editable based on business rules

4. User Roles & Permissions

Read-only: Can view and search, no edit capabilities
Read-write: Full CRUD operations on assets
UI adapts based on user role (hide/disable features)

5. Modern UI/UX Requirements

Clean, efficient design optimized for desktop use
Dark mode support
Modern notification system (toasts for success/error)
Loading states and error handling
No mobile optimization required initially

6. Data Model

Extensible schema to support future asset types
Core fields: asset type, make, model, serial number, specs, status, condition, assigned user, department, location, purchase date, warranty info, notes, ticket IDs
Audit trail for changes

7. Export Capabilities

Export filtered results to CSV/Excel
No import from CSV (only file parsing for bulk add)

User Workflows
Primary Use Case: Finding and Updating Laptops

User logs in with Azure AD credentials
Lands on dashboard showing inventory summary
Searches for specific laptop or browses filtered list
Clicks to edit laptop details or quick-change status
System shows success notification

Secondary Use Case: Bulk Adding New Laptops

User navigates to Add Asset page
Uploads invoice PDF or Excel file
System extracts and displays data for review
User maps fields and confirms import
System creates multiple asset records

Non-Functional Requirements

Fast search performance (results in <500ms)
Support 20-30 concurrent users
Handle 10,000+ asset records efficiently
Secure with Azure AD authentication
Audit trail for all changes
No external system integrations initially

Future Considerations

Support for additional asset types (desktops, phones, tablets)
Integration with IT systems (Intune, Freshservice, etc.)
Advanced reporting and analytics
Mobile app support