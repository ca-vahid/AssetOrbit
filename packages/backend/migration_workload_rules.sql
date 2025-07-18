BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [azureAdId] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [displayName] NVARCHAR(1000) NOT NULL,
    [givenName] NVARCHAR(1000),
    [surname] NVARCHAR(1000),
    [jobTitle] NVARCHAR(1000),
    [department] NVARCHAR(1000),
    [officeLocation] NVARCHAR(1000),
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'READ',
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [lastLoginAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_azureAdId_key] UNIQUE NONCLUSTERED ([azureAdId]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Department] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [Department_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Department_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Department_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Department_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[Location] (
    [id] NVARCHAR(1000) NOT NULL,
    [city] NVARCHAR(1000) NOT NULL,
    [province] NVARCHAR(1000) NOT NULL,
    [country] NVARCHAR(1000) NOT NULL CONSTRAINT [Location_country_df] DEFAULT 'Canada',
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [Location_source_df] DEFAULT 'AZURE_AD',
    [isActive] BIT NOT NULL CONSTRAINT [Location_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Location_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Location_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Location_city_province_country_key] UNIQUE NONCLUSTERED ([city],[province],[country])
);

-- CreateTable
CREATE TABLE [dbo].[Vendor] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [contactName] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [website] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [notes] TEXT,
    [isActive] BIT NOT NULL CONSTRAINT [Vendor_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Vendor_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Vendor_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Vendor_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[Asset] (
    [id] NVARCHAR(1000) NOT NULL,
    [assetTag] NVARCHAR(1000) NOT NULL,
    [assetType] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Asset_status_df] DEFAULT 'AVAILABLE',
    [condition] NVARCHAR(1000) NOT NULL CONSTRAINT [Asset_condition_df] DEFAULT 'GOOD',
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [Asset_source_df] DEFAULT 'MANUAL',
    [make] NVARCHAR(1000) NOT NULL,
    [model] NVARCHAR(1000) NOT NULL,
    [serialNumber] NVARCHAR(1000),
    [specifications] NVARCHAR(4000),
    [assignedToId] NVARCHAR(1000),
    [assignedToAadId] NVARCHAR(1000),
    [departmentId] NVARCHAR(1000),
    [locationId] NVARCHAR(1000),
    [purchaseDate] DATETIME2,
    [purchasePrice] DECIMAL(32,16),
    [vendorId] NVARCHAR(1000),
    [warrantyStartDate] DATETIME2,
    [warrantyEndDate] DATETIME2,
    [warrantyNotes] TEXT,
    [notes] TEXT,
    [createdById] NVARCHAR(1000) NOT NULL,
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Asset_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Asset_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Asset_assetTag_key] UNIQUE NONCLUSTERED ([assetTag])
);

-- CreateTable
CREATE TABLE [dbo].[AssetTicket] (
    [id] NVARCHAR(1000) NOT NULL,
    [assetId] NVARCHAR(1000) NOT NULL,
    [ticketNumber] NVARCHAR(1000) NOT NULL,
    [ticketSystem] NVARCHAR(1000) NOT NULL CONSTRAINT [AssetTicket_ticketSystem_df] DEFAULT 'Freshservice',
    [title] NVARCHAR(1000),
    [description] TEXT,
    [status] NVARCHAR(1000),
    [priority] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssetTicket_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AssetTicket_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AssetTicket_ticketNumber_ticketSystem_key] UNIQUE NONCLUSTERED ([ticketNumber],[ticketSystem])
);

-- CreateTable
CREATE TABLE [dbo].[ActivityLog] (
    [id] NVARCHAR(1000) NOT NULL,
    [assetId] NVARCHAR(1000),
    [userId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [changes] NVARCHAR(4000),
    [ipAddress] NVARCHAR(1000),
    [userAgent] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ActivityLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ActivityLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Attachment] (
    [id] NVARCHAR(1000) NOT NULL,
    [assetId] NVARCHAR(1000) NOT NULL,
    [fileName] NVARCHAR(1000) NOT NULL,
    [fileType] NVARCHAR(1000) NOT NULL,
    [fileSize] INT NOT NULL,
    [storageUrl] NVARCHAR(1000) NOT NULL,
    [uploadedBy] NVARCHAR(1000) NOT NULL,
    [uploadedAt] DATETIME2 NOT NULL CONSTRAINT [Attachment_uploadedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Attachment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CustomField] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [fieldType] NVARCHAR(1000) NOT NULL,
    [isRequired] BIT NOT NULL CONSTRAINT [CustomField_isRequired_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [CustomField_isActive_df] DEFAULT 1,
    [options] NVARCHAR(2000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CustomField_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CustomField_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CustomField_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[CustomFieldValue] (
    [id] NVARCHAR(1000) NOT NULL,
    [assetId] NVARCHAR(1000) NOT NULL,
    [fieldId] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(4000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CustomFieldValue_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CustomFieldValue_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CustomFieldValue_assetId_fieldId_key] UNIQUE NONCLUSTERED ([assetId],[fieldId])
);

-- CreateTable
CREATE TABLE [dbo].[WorkloadCategory] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [WorkloadCategory_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkloadCategory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkloadCategory_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkloadCategory_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[AssetWorkloadCategory] (
    [assetId] NVARCHAR(1000) NOT NULL,
    [categoryId] NVARCHAR(1000) NOT NULL,
    [assignedAt] DATETIME2 NOT NULL CONSTRAINT [AssetWorkloadCategory_assignedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AssetWorkloadCategory_pkey] PRIMARY KEY CLUSTERED ([assetId],[categoryId])
);

-- CreateTable
CREATE TABLE [dbo].[WorkloadCategoryRule] (
    [id] NVARCHAR(1000) NOT NULL,
    [categoryId] NVARCHAR(1000) NOT NULL,
    [priority] INT NOT NULL,
    [sourceField] NVARCHAR(1000) NOT NULL,
    [operator] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [WorkloadCategoryRule_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkloadCategoryRule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkloadCategoryRule_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Location_isActive_idx] ON [dbo].[Location]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_assetType_status_idx] ON [dbo].[Asset]([assetType], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_serialNumber_idx] ON [dbo].[Asset]([serialNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_assignedToId_idx] ON [dbo].[Asset]([assignedToId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_assignedToAadId_idx] ON [dbo].[Asset]([assignedToAadId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_departmentId_idx] ON [dbo].[Asset]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_locationId_idx] ON [dbo].[Asset]([locationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetTicket_assetId_idx] ON [dbo].[AssetTicket]([assetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ActivityLog_assetId_idx] ON [dbo].[ActivityLog]([assetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ActivityLog_userId_idx] ON [dbo].[ActivityLog]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ActivityLog_entityType_entityId_idx] ON [dbo].[ActivityLog]([entityType], [entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ActivityLog_createdAt_idx] ON [dbo].[ActivityLog]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Attachment_assetId_idx] ON [dbo].[Attachment]([assetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CustomFieldValue_assetId_idx] ON [dbo].[CustomFieldValue]([assetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CustomFieldValue_fieldId_idx] ON [dbo].[CustomFieldValue]([fieldId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetWorkloadCategory_categoryId_idx] ON [dbo].[AssetWorkloadCategory]([categoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetWorkloadCategory_assetId_idx] ON [dbo].[AssetWorkloadCategory]([assetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkloadCategoryRule_priority_idx] ON [dbo].[WorkloadCategoryRule]([priority]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkloadCategoryRule_categoryId_idx] ON [dbo].[WorkloadCategoryRule]([categoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkloadCategoryRule_isActive_idx] ON [dbo].[WorkloadCategoryRule]([isActive]);

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_assignedToId_fkey] FOREIGN KEY ([assignedToId]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[Location]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[Vendor]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_updatedById_fkey] FOREIGN KEY ([updatedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetTicket] ADD CONSTRAINT [AssetTicket_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ActivityLog] ADD CONSTRAINT [ActivityLog_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ActivityLog] ADD CONSTRAINT [ActivityLog_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [Attachment_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CustomFieldValue] ADD CONSTRAINT [CustomFieldValue_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CustomFieldValue] ADD CONSTRAINT [CustomFieldValue_fieldId_fkey] FOREIGN KEY ([fieldId]) REFERENCES [dbo].[CustomField]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AssetWorkloadCategory] ADD CONSTRAINT [AssetWorkloadCategory_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AssetWorkloadCategory] ADD CONSTRAINT [AssetWorkloadCategory_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[WorkloadCategory]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[WorkloadCategoryRule] ADD CONSTRAINT [WorkloadCategoryRule_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[WorkloadCategory]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

