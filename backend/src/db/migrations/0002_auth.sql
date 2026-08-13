-- ================= app_user: add auth columns (additive, Wave 1.5) =================
-- Append-only per THE BRAIN §11: do not edit 0000/0001, add a new numbered file.
ALTER TABLE app_user
  ADD COLUMN email                 VARCHAR(150) NULL AFTER username,
  ADD COLUMN password_hash         VARCHAR(255) NULL AFTER email,
  ADD COLUMN must_change_password  TINYINT(1) NOT NULL DEFAULT 1 AFTER password_hash,
  ADD COLUMN last_login_at         TIMESTAMP NULL AFTER must_change_password,
  ADD UNIQUE KEY uq_app_user_email (email);
