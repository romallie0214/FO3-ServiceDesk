-- Full service-area codes plus year and sequence must fit without truncation.
ALTER TABLE tickets MODIFY COLUMN ticket_number VARCHAR(64) NOT NULL;
