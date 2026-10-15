CREATE TABLE IF NOT EXISTS ticket_attachments (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  storage_bucket VARCHAR(120) NOT NULL,
  object_key VARCHAR(512) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(150) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  etag VARCHAR(128) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ticket_attachment_object (ticket_id, object_key),
  KEY idx_ticket_attachments_ticket (ticket_id),
  CONSTRAINT fk_ticket_attachments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);
