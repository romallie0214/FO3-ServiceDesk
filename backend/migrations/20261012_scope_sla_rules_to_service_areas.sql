-- Run after 20261012_add_service_areas.sql.
-- Makes SLA rules specific to a service area.

ALTER TABLE sla_rules
  ADD COLUMN service_area_id INT NULL AFTER id,
  ADD KEY idx_sla_service_area (service_area_id),
  ADD CONSTRAINT fk_sla_service_area FOREIGN KEY (service_area_id)
    REFERENCES service_areas(id) ON DELETE RESTRICT;

ALTER TABLE sla_rules
  DROP INDEX unique_priority_impact,
  ADD UNIQUE KEY uq_sla_service_priority_impact (service_area_id, priority, impact_level);

-- Preserve the existing SLA catalog as ICT rules.
UPDATE sla_rules sr
JOIN service_areas sa ON sa.code = 'ICT'
SET sr.service_area_id = sa.id
WHERE sr.service_area_id IS NULL;
