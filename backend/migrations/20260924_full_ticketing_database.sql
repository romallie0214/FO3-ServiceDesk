-- FO3 Ticketing System - complete baseline database migration
-- Target: MySQL 8.0+
--
-- Run this script against an empty database for a fresh installation.
-- CREATE TABLE IF NOT EXISTS and idempotent reference-data inserts make the
-- script safe to re-run, but this is a baseline migration and does not replace
-- the smaller upgrade migrations for already deployed databases.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------------
-- Core reference and identity tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sla_rules (
  id INT NOT NULL AUTO_INCREMENT,
  priority ENUM('Critical','High','Medium','Low') NOT NULL,
  impact_level ENUM('Enterprise-wide','Departmental','Individual') NOT NULL,
  response_time_hours DECIMAL(5,2) NOT NULL,
  resolution_time_hours DECIMAL(5,2) NOT NULL,
  escalation_time_hours DECIMAL(5,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_priority_impact (priority, impact_level),
  KEY idx_sla_priority (priority),
  KEY idx_sla_impact_level (impact_level),
  KEY idx_sla_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  empno VARCHAR(50) NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  role ENUM('super_admin','supervisor','ictms_staff','dswd_staff') NOT NULL DEFAULT 'dswd_staff',
  division VARCHAR(100) NULL,
  unit VARCHAR(150) NULL,
  office_location VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_empno (empno),
  KEY idx_users_role (role),
  KEY idx_users_division (division),
  KEY idx_users_unit (unit),
  KEY idx_users_office_location (office_location),
  KEY idx_users_created_at (created_at),
  KEY idx_users_role_division (role, division),
  KEY idx_users_role_unit (role, unit),
  KEY idx_users_full_name (full_name),
  KEY idx_users_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS user_tracking (
  id INT NOT NULL AUTO_INCREMENT,
  empno VARCHAR(20) NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked TINYINT(1) NOT NULL DEFAULT 0,
  locked_until TIMESTAMP NULL DEFAULT NULL,
  lock_reason VARCHAR(255) NULL,
  session_token VARCHAR(255) NULL,
  jwt_token TEXT NULL,
  session_active TINYINT(1) NOT NULL DEFAULT 0,
  session_last_activity TIMESTAMP NULL DEFAULT NULL,
  mfa_enabled TINYINT(1) NOT NULL DEFAULT 0,
  mfa_method ENUM('totp','email','both') NULL,
  totp_secret VARCHAR(255) NULL,
  totp_backup_codes JSON NULL,
  email_otp_secret VARCHAR(255) NULL,
  mfa_setup_date TIMESTAMP NULL DEFAULT NULL,
  mfa_session_token VARCHAR(255) NULL,
  otp_email VARCHAR(255) NULL,
  otp_email_expires_at TIMESTAMP NULL DEFAULT NULL,
  totp_attempts INT NOT NULL DEFAULT 0,
  email_attempts INT NOT NULL DEFAULT 0,
  mfa_session_expires_at TIMESTAMP NULL DEFAULT NULL,
  last_successful_login TIMESTAMP NULL DEFAULT NULL,
  last_login_attempt TIMESTAMP NULL DEFAULT NULL,
  last_login_ip VARCHAR(45) NULL,
  last_login_user_agent VARCHAR(500) NULL,
  last_login_device_type VARCHAR(50) NULL,
  last_login_browser VARCHAR(100) NULL,
  attempt_type VARCHAR(50) NULL,
  attempt_reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  totp_pending_secret VARCHAR(255) NULL,
  totp_pending_expires_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_tracking_empno (empno),
  UNIQUE KEY uq_user_tracking_session_token (session_token),
  KEY idx_tracking_mfa_session_token (mfa_session_token),
  KEY idx_tracking_locked (locked),
  KEY idx_tracking_session_active (session_active),
  KEY idx_tracking_mfa_enabled (mfa_enabled),
  KEY idx_tracking_last_login_attempt (last_login_attempt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS user_office_locations (
  id INT NOT NULL AUTO_INCREMENT,
  empno VARCHAR(50) NOT NULL,
  office_location_code INT NOT NULL,
  office_location_name VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_empno_loc (empno, office_location_code),
  KEY idx_uol_empno (empno),
  KEY idx_uol_location_code (office_location_code),
  KEY idx_uol_location_name (office_location_name),
  KEY idx_uol_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS auth_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empno VARCHAR(20) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  reason VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  session_token VARCHAR(255) NULL,
  context JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_auth_audit_empno_created (empno, created_at),
  KEY idx_auth_audit_event_created (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS ticket_statuses (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  type ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress',
  color VARCHAR(7) NOT NULL DEFAULT '#1A5490',
  description TEXT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ticket_status_name (name),
  KEY idx_ticket_status_type (type),
  KEY idx_ticket_status_default (is_default),
  KEY idx_ticket_status_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Service catalog
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  sla_rule_id INT NULL,
  default_priority ENUM('Critical','High','Medium','Low') NOT NULL DEFAULT 'Medium',
  PRIMARY KEY (id),
  KEY idx_categories_name (name),
  KEY idx_categories_sla_rule_id (sla_rule_id),
  KEY idx_categories_priority (default_priority),
  CONSTRAINT fk_category_sla FOREIGN KEY (sla_rule_id)
    REFERENCES sla_rules (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS sub_categories (
  id INT NOT NULL AUTO_INCREMENT,
  category_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sla_rule_id INT NULL,
  default_priority ENUM('Critical','High','Medium','Low') NOT NULL DEFAULT 'Medium',
  PRIMARY KEY (id),
  KEY idx_sub_categories_category_id (category_id),
  KEY idx_sub_categories_name (name),
  KEY idx_sub_categories_sort_order (sort_order),
  KEY idx_sub_categories_sla_rule_id (sla_rule_id),
  KEY idx_sub_categories_priority (default_priority),
  KEY idx_sub_categories_created_at (created_at),
  KEY idx_sub_categories_category_name (category_id, name),
  CONSTRAINT fk_subcategory_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE CASCADE,
  CONSTRAINT fk_subcategory_sla FOREIGN KEY (sla_rule_id)
    REFERENCES sla_rules (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS sub_items (
  id INT NOT NULL AUTO_INCREMENT,
  sub_category_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sla_rule_id INT NULL,
  default_priority ENUM('Critical','High','Medium','Low') NOT NULL DEFAULT 'Medium',
  PRIMARY KEY (id),
  KEY idx_sub_items_sub_category_id (sub_category_id),
  KEY idx_sub_items_name (name),
  KEY idx_sub_items_sort_order (sort_order),
  KEY idx_sub_items_sla_rule_id (sla_rule_id),
  KEY idx_sub_items_priority (default_priority),
  KEY idx_sub_items_created_at (created_at),
  KEY idx_sub_items_sub_category_name (sub_category_id, name),
  CONSTRAINT fk_subitem_subcategory FOREIGN KEY (sub_category_id)
    REFERENCES sub_categories (id) ON DELETE CASCADE,
  CONSTRAINT fk_subitem_sla FOREIGN KEY (sla_rule_id)
    REFERENCES sla_rules (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Ticket lifecycle
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tickets (
  id INT NOT NULL AUTO_INCREMENT,
  empno VARCHAR(50) NULL,
  ticket_number VARCHAR(20) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status ENUM('Open','Assigned','In Progress','On-Hold','Resolved','Cancelled','Closed') NOT NULL DEFAULT 'Open',
  priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
  category_id INT NULL,
  requestor_name VARCHAR(255) NULL,
  unit VARCHAR(255) NULL,
  division VARCHAR(255) NULL,
  office_location VARCHAR(255) NULL,
  assigned_to INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  first_response_at DATETIME NULL,
  assigned_at DATETIME NULL,
  escalation_started_at DATETIME NULL,
  resolved_at DATETIME NULL,
  sub_category_id INT NULL,
  sub_item_id INT NULL,
  cancel_reason TEXT NULL,
  hold_started_at DATETIME NULL,
  total_hold_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tickets_ticket_number (ticket_number),
  KEY idx_tickets_empno (empno),
  KEY idx_tickets_status (status),
  KEY idx_tickets_priority (priority),
  KEY idx_tickets_category_id (category_id),
  KEY idx_tickets_sub_category_id (sub_category_id),
  KEY idx_tickets_sub_item_id (sub_item_id),
  KEY idx_tickets_assigned_to (assigned_to),
  KEY idx_tickets_created_at (created_at),
  KEY idx_tickets_updated_at (updated_at),
  KEY idx_tickets_division (division),
  KEY idx_tickets_unit (unit),
  KEY idx_tickets_office_location (office_location),
  KEY idx_tickets_status_priority (status, priority),
  KEY idx_tickets_status_created (status, created_at),
  KEY idx_tickets_assigned_status (assigned_to, status),
  KEY idx_tickets_category_status (category_id, status),
  FULLTEXT KEY idx_tickets_search (subject, description, cancel_reason),
  CONSTRAINT fk_tickets_assigned_user FOREIGN KEY (assigned_to)
    REFERENCES users (id),
  CONSTRAINT fk_ticket_subcat FOREIGN KEY (sub_category_id)
    REFERENCES sub_categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_ticket_subitem FOREIGN KEY (sub_item_id)
    REFERENCES sub_items (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS ticket_assignees (
  id INT NOT NULL AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  user_id INT NOT NULL,
  empno VARCHAR(50) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('primary','co-assignee') NOT NULL DEFAULT 'co-assignee',
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by VARCHAR(50) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unique_ticket_assignee (ticket_id, user_id),
  CONSTRAINT fk_ticket_assignees_ticket FOREIGN KEY (ticket_id)
    REFERENCES tickets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS comments (
  id INT NOT NULL AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  empno VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comments_ticket_id (ticket_id),
  KEY idx_comments_empno (empno),
  KEY idx_comments_created_at (created_at),
  KEY idx_comments_ticket_created (ticket_id, created_at),
  CONSTRAINT fk_comments_ticket FOREIGN KEY (ticket_id)
    REFERENCES tickets (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS ticket_email_threads (
  id INT NOT NULL AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  requester_email VARCHAR(255) NOT NULL,
  email_message_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ticket_email_ticket_id (ticket_id),
  CONSTRAINT fk_ticket_email FOREIGN KEY (ticket_id)
    REFERENCES tickets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS csm_responses (
  id INT NOT NULL AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  empno VARCHAR(50) NULL,
  client_name VARCHAR(150) NULL,
  age INT NULL,
  sex ENUM('Male','Female','Prefer not to say') NULL,
  contact VARCHAR(100) NULL,
  office_location VARCHAR(255) NULL,
  unit_name VARCHAR(150) NULL,
  division_name VARCHAR(150) NULL,
  sector VARCHAR(100) NULL,
  client_type VARCHAR(100) NULL,
  attending_officer VARCHAR(150) NULL,
  service_mode VARCHAR(100) NULL,
  officer_rating INT NULL,
  rating_promptness INT NULL,
  rating_reliability INT NULL,
  rating_access INT NULL,
  rating_courtesy INT NULL,
  rating_cost INT NULL,
  rating_integrity INT NULL,
  rating_assurance INT NULL,
  rating_outcome INT NULL,
  cc_awareness VARCHAR(100) NULL,
  cc_visibility VARCHAR(100) NULL,
  cc_helpfulness VARCHAR(100) NULL,
  commendation TEXT NULL,
  suggestion TEXT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_csm_ticket_id (ticket_id),
  KEY idx_csm_empno (empno),
  KEY idx_csm_submitted_at (submitted_at),
  KEY idx_csm_office_location (office_location),
  KEY idx_csm_division_name (division_name),
  KEY idx_csm_unit_name (unit_name),
  KEY idx_csm_service_mode (service_mode),
  KEY idx_csm_ticket_submitted (ticket_id, submitted_at),
  CONSTRAINT fk_csm_ticket FOREIGN KEY (ticket_id)
    REFERENCES tickets (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS knowledge_base (
  id INT NOT NULL AUTO_INCREMENT,
  category VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  pdf_filename VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_kb_category (category),
  KEY idx_kb_created_at (created_at),
  KEY idx_kb_updated_at (updated_at),
  FULLTEXT KEY idx_kb_search (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Existing active SLA reference data
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO sla_rules
  (priority, impact_level, response_time_hours, resolution_time_hours,
   escalation_time_hours, description, is_active)
VALUES
  ('Critical','Departmental',0.50,8.00,8.00,'Critical issue affecting entire division',1),
  ('Critical','Individual',0.50,16.00,12.00,'Critical issue for single user',1),
  ('High','Enterprise-wide',0.75,18.00,15.00,'Major issue affecting all staff',1),
  ('High','Departmental',0.75,20.00,17.50,'High priority issue for a division',1),
  ('High','Individual',0.75,22.00,18.00,'High priority single user issue',1),
  ('Medium','Enterprise-wide',1.00,24.00,24.00,'Moderate issue affecting all staff',1),
  ('Medium','Departmental',1.00,36.00,24.00,'Moderate division-level issue',1),
  ('Medium','Individual',1.00,48.00,24.00,'Moderate single user issue',1),
  ('Low','Enterprise-wide',1.50,60.00,48.00,'Minor issue affecting all staff',1),
  ('Low','Departmental',1.50,72.00,72.00,'Minor division-level issue',1),
  ('Low','Individual',1.50,120.00,72.00,'Minor single user issue',1);

INSERT IGNORE INTO ticket_statuses
  (name, type, color, description, is_default, sort_order)
VALUES
  ('Open','in_progress','#1A5490','Ticket submitted and awaiting assignment.',1,1),
  ('Assigned','in_progress','#4A4A4A','Ticket assigned to ICTMS staff.',1,2),
  ('In Progress','in_progress','#CC7700','Ticket is actively being worked on.',1,3),
  ('On-Hold','in_progress','#854F0B','Ticket is paused pending further info.',1,4),
  ('Resolved','completed','#1B6B3A','Ticket resolved. Awaiting CSM from requestor.',1,5),
  ('Cancelled','completed','#8B1A1A','Ticket cancelled. No further action needed.',1,6),
  ('Closed','completed','#4A4A4A','Ticket fully closed after CSM submission.',1,7);

-- ---------------------------------------------------------------------------
-- Information and System Development service catalog
-- Database, Server, and QA services intentionally belong to separate categories.
-- ---------------------------------------------------------------------------

INSERT INTO categories (name, description, sla_rule_id, default_priority)
SELECT
  'Information and System Development',
  'Planning, design, development, enhancement, integration, maintenance, assessment, and documentation of information systems, applications, websites, and automated workflows. Database-, server-, and QA-specific work is excluded.',
  sr.id,
  'Low'
FROM sla_rules sr
WHERE sr.priority = 'Low'
  AND sr.impact_level = 'Departmental'
  AND NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.name = 'Information and System Development'
  );

SET @isd_category_id := (
  SELECT MIN(id) FROM categories
  WHERE name = 'Information and System Development'
);

INSERT INTO sub_categories
  (category_id, name, description, sort_order, sla_rule_id, default_priority)
SELECT @isd_category_id, seed.name, seed.description, seed.sort_order, sr.id, seed.priority
FROM (
  SELECT 'New System Development' name, 'Planning, design, and development of new software applications.' description, 1 sort_order, 'Low' priority, 'Departmental' impact
  UNION ALL SELECT 'System Enhancement', 'Addition or modification of features and functions in an existing application.', 2, 'Medium', 'Departmental'
  UNION ALL SELECT 'Website Development', 'Creation, redesign, or functional improvement of websites and portals.', 3, 'Low', 'Departmental'
  UNION ALL SELECT 'System Integration', 'Connection of applications to internal systems or approved external services.', 4, 'Medium', 'Departmental'
  UNION ALL SELECT 'Forms and Workflow Automation', 'Digitization and automation of forms, approvals, and repetitive processes.', 5, 'Medium', 'Departmental'
  UNION ALL SELECT 'Reports and Analytics', 'Development of application reports, dashboards, visualizations, and export functions.', 6, 'Medium', 'Individual'
  UNION ALL SELECT 'Application Maintenance', 'Correction and maintenance of application code and functions.', 7, 'High', 'Individual'
  UNION ALL SELECT 'Application Access and Security', 'Development and configuration of application-level access and security controls.', 8, 'High', 'Departmental'
  UNION ALL SELECT 'Technical Documentation', 'Preparation and maintenance of documents supporting an application.', 9, 'Low', 'Departmental'
  UNION ALL SELECT 'System Assessment and Consultation', 'Analysis of requirements, feasibility, suitability, and development effort.', 10, 'Low', 'Individual'
  UNION ALL SELECT 'Other Development Request', 'Application-development work not covered by another listed subcategory.', 11, 'Low', 'Individual'
) seed
JOIN sla_rules sr
  ON sr.priority = seed.priority AND sr.impact_level = seed.impact
LEFT JOIN sub_categories existing
  ON existing.category_id = @isd_category_id AND existing.name = seed.name
WHERE @isd_category_id IS NOT NULL AND existing.id IS NULL;

INSERT INTO sub_items
  (sub_category_id, name, description, sort_order, sla_rule_id, default_priority)
SELECT sc.id, seed.item_name, seed.description, seed.sort_order, sr.id, seed.priority
FROM (
  SELECT 'New System Development' subcategory, 'Web Application' item_name, 'Develop a new browser-based business application.' description, 1 sort_order, 'Low' priority, 'Departmental' impact
  UNION ALL SELECT 'New System Development','Mobile Application','Develop a new application for mobile devices.',2,'Low','Departmental'
  UNION ALL SELECT 'New System Development','Desktop Application','Develop software installed on user workstations.',3,'Low','Departmental'
  UNION ALL SELECT 'New System Development','Internal Information System','Develop an application supporting internal operations.',4,'Low','Departmental'
  UNION ALL SELECT 'New System Development','Public-Facing System','Develop an application intended for clients or the public.',5,'Low','Departmental'
  UNION ALL SELECT 'System Enhancement','New Feature','Add a new function to an existing application.',1,'Medium','Departmental'
  UNION ALL SELECT 'System Enhancement','Feature Modification','Change the behavior of an existing application function.',2,'Medium','Departmental'
  UNION ALL SELECT 'System Enhancement','Workflow Improvement','Improve an existing application workflow.',3,'Medium','Departmental'
  UNION ALL SELECT 'System Enhancement','User Interface Update','Modify application screens, forms, or navigation.',4,'Medium','Departmental'
  UNION ALL SELECT 'System Enhancement','Performance Enhancement','Optimize application code and responsiveness.',5,'Medium','Departmental'
  UNION ALL SELECT 'Website Development','New Website','Develop a complete public or internal website.',1,'Low','Departmental'
  UNION ALL SELECT 'Website Development','New Webpage','Create a new page within an existing website.',2,'Low','Departmental'
  UNION ALL SELECT 'Website Development','Website Redesign','Revise the structure, layout, and appearance of a website.',3,'Low','Departmental'
  UNION ALL SELECT 'Website Development','Website Feature','Add a new functional component to a website.',4,'Low','Departmental'
  UNION ALL SELECT 'Website Development','Content Management Feature','Add or modify website content-management functions.',5,'Low','Departmental'
  UNION ALL SELECT 'System Integration','API Development','Develop an interface for exchanging application data.',1,'Medium','Departmental'
  UNION ALL SELECT 'System Integration','Third-Party Integration','Connect an application to an approved external service.',2,'Medium','Departmental'
  UNION ALL SELECT 'System Integration','Inter-System Integration','Connect two existing organizational applications.',3,'Medium','Departmental'
  UNION ALL SELECT 'System Integration','Single Sign-On Integration','Integrate an application with centralized authentication.',4,'Medium','Departmental'
  UNION ALL SELECT 'System Integration','Payment Service Integration','Connect an application to an approved payment service.',5,'Medium','Departmental'
  UNION ALL SELECT 'Forms and Workflow Automation','Online Form','Convert a manual form into a digital application form.',1,'Medium','Departmental'
  UNION ALL SELECT 'Forms and Workflow Automation','Approval Workflow','Automate the routing and approval of requests.',2,'Medium','Departmental'
  UNION ALL SELECT 'Forms and Workflow Automation','Notification Automation','Automate email, SMS, or in-application notifications.',3,'Medium','Departmental'
  UNION ALL SELECT 'Forms and Workflow Automation','Document Generation','Generate documents automatically from application data.',4,'Medium','Departmental'
  UNION ALL SELECT 'Forms and Workflow Automation','Business Process Automation','Automate a repetitive operational process.',5,'Medium','Departmental'
  UNION ALL SELECT 'Reports and Analytics','New Application Report','Create a new report within an application.',1,'Medium','Individual'
  UNION ALL SELECT 'Reports and Analytics','Report Modification','Change an existing application report.',2,'Medium','Individual'
  UNION ALL SELECT 'Reports and Analytics','Application Dashboard','Create a summary screen for key system information.',3,'Medium','Individual'
  UNION ALL SELECT 'Reports and Analytics','Data Visualization','Present application information through charts or graphs.',4,'Medium','Individual'
  UNION ALL SELECT 'Reports and Analytics','Export Function','Add or modify PDF, spreadsheet, or CSV export functionality.',5,'Medium','Individual'
  UNION ALL SELECT 'Application Maintenance','Bug Correction','Correct a confirmed defect in application code.',1,'High','Individual'
  UNION ALL SELECT 'Application Maintenance','Application Update','Implement a routine application-level update.',2,'High','Individual'
  UNION ALL SELECT 'Application Maintenance','Compatibility Update','Update code for browser, device, or platform compatibility.',3,'High','Individual'
  UNION ALL SELECT 'Application Maintenance','Code Optimization','Improve application code efficiency and maintainability.',4,'High','Individual'
  UNION ALL SELECT 'Application Maintenance','Legacy System Modification','Modify the functionality of an existing legacy application.',5,'High','Departmental'
  UNION ALL SELECT 'Application Access and Security','Application Role Setup','Create or modify roles within an application.',1,'High','Departmental'
  UNION ALL SELECT 'Application Access and Security','Permission Configuration','Configure access to application features or modules.',2,'High','Departmental'
  UNION ALL SELECT 'Application Access and Security','Authentication Feature','Develop or modify application login functionality.',3,'High','Departmental'
  UNION ALL SELECT 'Application Access and Security','Audit Trail Feature','Develop application-level activity logging.',4,'High','Departmental'
  UNION ALL SELECT 'Application Access and Security','Security Feature Enhancement','Improve security controls within application code.',5,'High','Departmental'
  UNION ALL SELECT 'Technical Documentation','Requirements Document','Document an application''s functional requirements.',1,'Low','Departmental'
  UNION ALL SELECT 'Technical Documentation','User Guide','Prepare instructions for application users.',2,'Low','Departmental'
  UNION ALL SELECT 'Technical Documentation','System Manual','Document application features and operating procedures.',3,'Low','Departmental'
  UNION ALL SELECT 'Technical Documentation','API Documentation','Document integration endpoints and their usage.',4,'Low','Departmental'
  UNION ALL SELECT 'Technical Documentation','Process Flow','Document the sequence of an application process.',5,'Low','Departmental'
  UNION ALL SELECT 'Technical Documentation','Release Notes','Document changes included in an application release.',6,'Low','Departmental'
  UNION ALL SELECT 'System Assessment and Consultation','Requirements Analysis','Review and define application requirements.',1,'Low','Individual'
  UNION ALL SELECT 'System Assessment and Consultation','Feasibility Assessment','Evaluate whether a proposed application is practical.',2,'Low','Individual'
  UNION ALL SELECT 'System Assessment and Consultation','Existing System Evaluation','Evaluate the functionality and suitability of an application.',3,'Low','Individual'
  UNION ALL SELECT 'System Assessment and Consultation','Technical Consultation','Provide application-development recommendations.',4,'Low','Individual'
  UNION ALL SELECT 'System Assessment and Consultation','Development Effort Estimation','Estimate the effort required for development work.',5,'Low','Individual'
  UNION ALL SELECT 'Other Development Request','Prototype','Create an initial working model of an application.',1,'Low','Individual'
  UNION ALL SELECT 'Other Development Request','Proof of Concept','Demonstrate whether a proposed solution is viable.',2,'Low','Individual'
  UNION ALL SELECT 'Other Development Request','Source-Code Review','Review application code and provide recommendations.',3,'Low','Individual'
  UNION ALL SELECT 'Other Development Request','Other/Not Listed','Handle an application-development request not listed above.',4,'Low','Individual'
) seed
JOIN sub_categories sc
  ON sc.category_id = @isd_category_id AND sc.name = seed.subcategory
JOIN sla_rules sr
  ON sr.priority = seed.priority AND sr.impact_level = seed.impact
LEFT JOIN sub_items existing
  ON existing.sub_category_id = sc.id AND existing.name = seed.item_name
WHERE existing.id IS NULL;

SET @isd_category_id := NULL;

-- Project-based request SLAs cover initial assessment, requirements confirmation,
-- and delivery planning. Final implementation follows an approved project plan.
