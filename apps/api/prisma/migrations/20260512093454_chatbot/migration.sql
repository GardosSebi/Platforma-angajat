-- RenameIndex
DO $$
BEGIN
  IF to_regclass('"CommunicationAnnouncement_tenantId_audienceType_audienceRefId_i"') IS NOT NULL
    AND to_regclass('"CommunicationAnnouncement_tenantId_audienceType_audienceRef_idx"') IS NULL THEN
    ALTER INDEX "CommunicationAnnouncement_tenantId_audienceType_audienceRefId_i" RENAME TO "CommunicationAnnouncement_tenantId_audienceType_audienceRef_idx";
  END IF;
END $$;

-- RenameIndex
DO $$
BEGIN
  IF to_regclass('"CommunicationAnnouncementRead_tenantId_announcementId_readAt_id"') IS NOT NULL
    AND to_regclass('"CommunicationAnnouncementRead_tenantId_announcementId_readA_idx"') IS NULL THEN
    ALTER INDEX "CommunicationAnnouncementRead_tenantId_announcementId_readAt_id" RENAME TO "CommunicationAnnouncementRead_tenantId_announcementId_readA_idx";
  END IF;
END $$;

-- RenameIndex
DO $$
BEGIN
  IF to_regclass('"SsmPsiEquipmentVerification_tenantId_equipmentId_performedAt_id"') IS NOT NULL
    AND to_regclass('"SsmPsiEquipmentVerification_tenantId_equipmentId_performedA_idx"') IS NULL THEN
    ALTER INDEX "SsmPsiEquipmentVerification_tenantId_equipmentId_performedAt_id" RENAME TO "SsmPsiEquipmentVerification_tenantId_equipmentId_performedA_idx";
  END IF;
END $$;
