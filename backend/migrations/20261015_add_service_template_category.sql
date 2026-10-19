-- Run only when service_templates was created before the category column was added.
ALTER TABLE service_templates
  ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'General' AFTER service_area_id,
  ADD KEY idx_service_templates_category (category);
