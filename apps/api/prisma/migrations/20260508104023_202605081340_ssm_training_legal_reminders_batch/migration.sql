-- RenameIndex
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'SsmTrainingReminderDispatch_trainingPlanId_daysUntilDue_channel'
  ) THEN
    ALTER INDEX "SsmTrainingReminderDispatch_trainingPlanId_daysUntilDue_channel" RENAME TO "SsmTrainingReminderDispatch_trainingPlanId_daysUntilDue_cha_key";
  END IF;
END $$;
