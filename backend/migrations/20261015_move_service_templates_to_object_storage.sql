-- Run when service_templates was created before object-storage columns were added.
ALTER TABLE service_templates
  ADD COLUMN storage_bucket VARCHAR(100) NULL AFTER stored_filename,
  ADD COLUMN object_key VARCHAR(500) NULL AFTER storage_bucket;

-- Existing local files must be re-uploaded through Service Templates after this migration.
