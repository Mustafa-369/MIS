-- ================= role (no dependencies) =================
CREATE TABLE role (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(30)  NOT NULL,
  name         VARCHAR(100) NOT NULL,
  description  VARCHAR(255) NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by   BIGINT UNSIGNED NULL,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by   BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_role_code (code)
) ENGINE=InnoDB;

-- ================= location (self-nesting hierarchy) =================
CREATE TABLE location (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(20)  NOT NULL,
  name         VARCHAR(100) NOT NULL,
  kind         ENUM('site','warehouse','area','bin') NOT NULL,
  parent_id    BIGINT UNSIGNED NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by   BIGINT UNSIGNED NULL,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by   BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_location_code (code),
  CONSTRAINT fk_location_parent  FOREIGN KEY (parent_id) REFERENCES location(id)
) ENGINE=InnoDB;

-- MySQL 8 does not allow a CHECK constraint to reference an auto-increment
-- column, so "a location can't be its own parent" is enforced by trigger
-- instead of a CHECK constraint.
CREATE TRIGGER trg_location_no_self_parent_ins
BEFORE INSERT ON location
FOR EACH ROW
BEGIN
  IF NEW.parent_id = NEW.id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'location cannot be its own parent';
  END IF;
END;

CREATE TRIGGER trg_location_no_self_parent_upd
BEFORE UPDATE ON location
FOR EACH ROW
BEGIN
  IF NEW.parent_id = NEW.id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'location cannot be its own parent';
  END IF;
END;

-- ================= department (head_position_id FK added after job_position) =================
CREATE TABLE department (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(20)  NOT NULL,
  name              VARCHAR(100) NOT NULL,
  head_position_id  BIGINT UNSIGNED NULL,
  is_active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        BIGINT UNSIGNED NULL,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by        BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_department_code (code)
) ENGINE=InnoDB;

-- ================= job_position (FK -> department) =================
CREATE TABLE job_position (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code             VARCHAR(30)  NOT NULL,
  title            VARCHAR(100) NOT NULL,
  department_id    BIGINT UNSIGNED NOT NULL,
  authority_level  INT          NOT NULL DEFAULT 0,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_position_code (code),
  CONSTRAINT fk_position_department FOREIGN KEY (department_id) REFERENCES department(id)
) ENGINE=InnoDB;

-- close the department <-> job_position loop
ALTER TABLE department
  ADD CONSTRAINT fk_department_head FOREIGN KEY (head_position_id) REFERENCES job_position(id);

-- ================= position_role (POSITION DRIVES ROLES — WD-03) =================
CREATE TABLE position_role (
  position_id  BIGINT UNSIGNED NOT NULL,
  role_id      BIGINT UNSIGNED NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by   BIGINT UNSIGNED NULL,
  PRIMARY KEY (position_id, role_id),
  CONSTRAINT fk_posrole_position FOREIGN KEY (position_id) REFERENCES job_position(id),
  CONSTRAINT fk_posrole_role     FOREIGN KEY (role_id)     REFERENCES role(id)
) ENGINE=InnoDB;

-- ================= cost_center (FK -> department) =================
CREATE TABLE cost_center (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(20)  NOT NULL,
  name           VARCHAR(100) NOT NULL,
  department_id  BIGINT UNSIGNED NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     BIGINT UNSIGNED NULL,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by     BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_cost_center_code (code),
  CONSTRAINT fk_cost_center_department FOREIGN KEY (department_id) REFERENCES department(id)
) ENGINE=InnoDB;

-- ================= work_center (FK -> location) =================
CREATE TABLE work_center (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(20)  NOT NULL,
  name         VARCHAR(100) NOT NULL,
  kind         ENUM('cnc','manual_turning','hose_unit1','hose_unit2') NOT NULL,
  metric_mode  ENUM('oee','utilisation','yield') NOT NULL,
  location_id  BIGINT UNSIGNED NOT NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by   BIGINT UNSIGNED NULL,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by   BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_work_center_code (code),
  CONSTRAINT fk_work_center_location FOREIGN KEY (location_id) REFERENCES location(id)
) ENGINE=InnoDB;
