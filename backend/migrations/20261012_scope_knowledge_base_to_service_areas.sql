-- Run after 20261012_add_service_areas.sql.
ALTER TABLE knowledge_base
  ADD COLUMN service_area_id INT NULL AFTER id,
  ADD KEY idx_kb_service_area (service_area_id),
  ADD CONSTRAINT fk_kb_service_area FOREIGN KEY (service_area_id)
    REFERENCES service_areas(id) ON DELETE RESTRICT;

-- Existing articles originated from the ICT Desk.
UPDATE knowledge_base kb
JOIN service_areas sa ON sa.code = 'ICT'
SET kb.service_area_id = sa.id
WHERE kb.service_area_id IS NULL;
