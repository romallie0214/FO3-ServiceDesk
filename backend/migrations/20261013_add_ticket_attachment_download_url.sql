-- Run this only if 20261013_add_ticket_attachments.sql was already applied
-- before the storage_download_url column was added.
ALTER TABLE ticket_attachments
  ADD COLUMN storage_download_url TEXT NULL AFTER etag;
