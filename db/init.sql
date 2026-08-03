CREATE DATABASE IF NOT EXISTS aop;

USE aop;

CREATE TABLE IF NOT EXISTS health_check (
  message TEXT NOT NULL
);

INSERT INTO health_check (message)
SELECT 'AOP walking skeleton OK'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM health_check);
