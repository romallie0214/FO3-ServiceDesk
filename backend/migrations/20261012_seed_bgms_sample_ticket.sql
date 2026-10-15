-- Optional demo data. Run only after a BGMS service area has been created.
-- It can be safely run more than once; the sample ticket is inserted once.

INSERT INTO categories (name, description, default_priority, service_area_id)
SELECT 'Budget Request', 'Sample BGMS category for service-desk testing.', 'Medium', sa.id
FROM service_areas sa
WHERE sa.code = 'BGMS'
  AND NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.service_area_id = sa.id AND c.name = 'Budget Request'
  );

INSERT IGNORE INTO tickets
  (ticket_number, subject, description, status, priority,
   category_id, service_area_id, empno, requestor_name, unit, division, office_location)
SELECT
  'DEMO-BGMS-0001',
  'Sample BGMS budget request',
  'Demo ticket: please review the requested budget-document processing requirements.',
  'Open', 'Medium',
  c.id, sa.id,
  'DEMO-BGMS-001', 'Sample BGMS Requestor', sa.unit, sa.division, 'Sample Office'
FROM service_areas sa
JOIN categories c ON c.service_area_id = sa.id AND c.name = 'Budget Request'
WHERE sa.code = 'BGMS';
