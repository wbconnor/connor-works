-- Runs only when the container starts with an empty data volume.
-- One role + database per app, matching production (ARCHITECTURE.md §4.1).
-- CREATEDB is for local dev only: `prisma migrate dev` needs it to create its shadow database.
CREATE ROLE meridian_underground LOGIN PASSWORD 'dev' CREATEDB;
CREATE DATABASE meridian_underground OWNER meridian_underground;

-- only if the main site gets a database (its registry entry has `database: null` for now):
-- CREATE ROLE main_site LOGIN PASSWORD 'dev' CREATEDB;
-- CREATE DATABASE main_site OWNER main_site;
