-- create shadow DB for prisma
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create shadow DB used by Prisma migrations
DO
$$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_database WHERE datname = 'ambulant_shadow'
   ) THEN
      PERFORM pg_execute_extension_script('CREATE DATABASE ambulant_shadow;');
   END IF;
END
$$;

-- Ensure timescaledb extension in main DB after container startup (executed within entrypoint)
\connect ambulant
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
