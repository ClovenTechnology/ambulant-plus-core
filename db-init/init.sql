-- init.sql: creates shadow DB and ensures owner exists
-- Executed once at first container startup by postgres docker-entrypoint

-- create the shadow db (if it does not exist)
CREATE DATABASE ambulant_shadow WITH OWNER = ambulant;

-- you can put other initializations here (extensions, roles, etc.)
-- enable timescaledb extension in main DB (ambulant)
\connect ambulant
CREATE EXTENSION IF NOT EXISTS timescaledb;
