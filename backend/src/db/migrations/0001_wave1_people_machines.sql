-- ================= job_position.reports_to (additive column on a Wave 0 table) =================
-- Wave 0 did not carry the reporting chain. THE BRAIN N-10 requires it, so we add it here,
-- additively, rather than editing 0000_wave0_foundation.sql.
ALTER TABLE job_position
  ADD COLUMN reports_to BIGINT UNSIGNED NULL AFTER department_id,
  ADD CONSTRAINT fk_position_reports_to FOREIGN KEY (reports_to) REFERENCES job_position(id);

-- Same self-parent guard already used for location.parent_id (BOARD is root: reports_to IS NULL).
CREATE TRIGGER trg_position_no_self_report_ins
BEFORE INSERT ON job_position
FOR EACH ROW
BEGIN
  IF NEW.reports_to = NEW.id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'job_position cannot report to itself';
  END IF;
END;

CREATE TRIGGER trg_position_no_self_report_upd
BEFORE UPDATE ON job_position
FOR EACH ROW
BEGIN
  IF NEW.reports_to = NEW.id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'job_position cannot report to itself';
  END IF;
END;

-- ================= capability (no dependencies) =================
CREATE TABLE capability (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(30)  NOT NULL,
  name         VARCHAR(100) NOT NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by   BIGINT UNSIGNED NULL,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by   BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_capability_code (code)
) ENGINE=InnoDB;

-- ================= employee (no dependencies) =================
CREATE TABLE employee (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(30)  NOT NULL,
  full_name    VARCHAR(150) NOT NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by   BIGINT UNSIGNED NULL,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by   BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_employee_code (code)
) ENGINE=InnoDB;

-- ================= app_user (FK -> employee) =================
-- Auth/password handled by the app security layer; never stored here in plaintext.
CREATE TABLE app_user (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  employee_id   BIGINT UNSIGNED NOT NULL,
  username      VARCHAR(50)  NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    BIGINT UNSIGNED NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by    BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_app_user_username (username),
  CONSTRAINT fk_appuser_employee FOREIGN KEY (employee_id) REFERENCES employee(id)
) ENGINE=InnoDB;

-- ================= employee_position (FK -> employee, job_position) =================
-- Multi-position link: an employee may hold several seats; their roles combine (WD-03).
CREATE TABLE employee_position (
  employee_id      BIGINT UNSIGNED NOT NULL,
  job_position_id  BIGINT UNSIGNED NOT NULL,
  is_primary       TINYINT(1) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  PRIMARY KEY (employee_id, job_position_id),
  CONSTRAINT fk_emppos_employee FOREIGN KEY (employee_id)     REFERENCES employee(id),
  CONSTRAINT fk_emppos_position FOREIGN KEY (job_position_id) REFERENCES job_position(id)
) ENGINE=InnoDB;

-- ================= machine (FK -> work_center, location, capability) =================
CREATE TABLE machine (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(30)  NOT NULL,
  name           VARCHAR(100) NOT NULL,
  work_center_id BIGINT UNSIGNED NOT NULL,
  location_id    BIGINT UNSIGNED NOT NULL,
  capability_id  BIGINT UNSIGNED NOT NULL,
  size_range     VARCHAR(30) NULL,
  oee_excluded   TINYINT(1)   NOT NULL DEFAULT 0,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     BIGINT UNSIGNED NULL,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by     BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_machine_code (code),
  CONSTRAINT fk_machine_work_center FOREIGN KEY (work_center_id) REFERENCES work_center(id),
  CONSTRAINT fk_machine_location    FOREIGN KEY (location_id)    REFERENCES location(id),
  CONSTRAINT fk_machine_capability  FOREIGN KEY (capability_id)  REFERENCES capability(id)
) ENGINE=InnoDB;

-- Note: machine -> consumable links are deferred to Wave 2 (the item register doesn't exist
-- yet). Do not add them now.
