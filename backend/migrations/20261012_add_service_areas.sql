-- Generic FO3 Service Desk: service-area routing and scoped staff roles.
-- Run once against an existing dswd_ictms database.

CREATE TABLE IF NOT EXISTS service_areas (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  division_code VARCHAR(50) NULL,
  division VARCHAR(100) NULL,
  unit_code VARCHAR(50) NULL,
  unit VARCHAR(150) NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_areas_code (code),
  KEY idx_service_areas_org (division_code, unit_code),
  KEY idx_service_areas_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS user_service_roles (
  id INT NOT NULL AUTO_INCREMENT,
  service_area_id INT NOT NULL,
  user_id INT NOT NULL,
  service_role ENUM('admin','supervisor','technical_staff') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_service_role (service_area_id, user_id),
  KEY idx_usr_user (user_id),
  KEY idx_usr_area_role (service_area_id, service_role),
  CONSTRAINT fk_usr_area FOREIGN KEY (service_area_id) REFERENCES service_areas(id) ON DELETE CASCADE,
  CONSTRAINT fk_usr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE categories
  ADD COLUMN service_area_id INT NULL AFTER id,
  ADD KEY idx_categories_service_area (service_area_id),
  ADD CONSTRAINT fk_categories_service_area FOREIGN KEY (service_area_id)
    REFERENCES service_areas(id) ON DELETE SET NULL;

ALTER TABLE tickets
  ADD COLUMN service_area_id INT NULL AFTER category_id,
  ADD KEY idx_tickets_service_area (service_area_id),
  ADD CONSTRAINT fk_tickets_service_area FOREIGN KEY (service_area_id)
    REFERENCES service_areas(id) ON DELETE SET NULL;

INSERT IGNORE INTO service_areas (code, name, description)
VALUES ('ICT', 'Information and Communications Technology', 'Migrated from the existing ICT service desk.');

UPDATE categories c
JOIN service_areas sa ON sa.code = 'ICT'
SET c.service_area_id = sa.id
WHERE c.service_area_id IS NULL;

UPDATE tickets t
LEFT JOIN categories c ON c.id = t.category_id
SET t.service_area_id = c.service_area_id
WHERE t.service_area_id IS NULL;

INSERT IGNORE INTO user_service_roles (service_area_id, user_id, service_role)
SELECT sa.id, u.id,
  CASE WHEN u.role = 'supervisor' THEN 'supervisor' ELSE 'technical_staff' END
FROM users u
JOIN service_areas sa ON sa.code = 'ICT'
WHERE u.role IN ('supervisor', 'ictms_staff') AND u.deleted_at IS NULL;
