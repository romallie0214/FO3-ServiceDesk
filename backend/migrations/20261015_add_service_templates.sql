-- Download Hub: templates and required forms published by each service area.
-- Run after 20261012_add_service_areas.sql.

CREATE TABLE IF NOT EXISTS service_templates (
  id INT NOT NULL AUTO_INCREMENT,
  service_area_id INT NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  storage_bucket VARCHAR(100) NOT NULL,
  object_key VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_service_templates_area_active (service_area_id, is_active),
  CONSTRAINT fk_service_templates_area FOREIGN KEY (service_area_id)
    REFERENCES service_areas(id) ON DELETE CASCADE,
  CONSTRAINT fk_service_templates_creator FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
