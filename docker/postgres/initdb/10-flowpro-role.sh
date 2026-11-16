#!/bin/sh
# Creates the role FlowPro connects as, and its database. Runs once, when the
# data volume is first initialised.
#
# The role owns the FlowPro database but is not a superuser and cannot bypass
# row-level security, so PostgreSQL enforces tenant isolation on every query
# the application makes. A superuser would skip those policies entirely.
# POSTGRES_USER stays the administrator, for backups and maintenance.
set -eu

: "${FLOWPRO_POSTGRES_DB:?Set FLOWPRO_POSTGRES_DB}"
: "${FLOWPRO_POSTGRES_USER:?Set FLOWPRO_POSTGRES_USER}"
: "${FLOWPRO_POSTGRES_PASSWORD:?Set FLOWPRO_POSTGRES_PASSWORD}"

# The development stack lets the role create databases, because the browser
# test scripts create databases of their own.
create_database=NOCREATEDB
if [ "${FLOWPRO_POSTGRES_CREATEDB:-false}" = "true" ]; then
  create_database=CREATEDB
fi

psql --set=ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" \
  --set=role="${FLOWPRO_POSTGRES_USER}" \
  --set=password="${FLOWPRO_POSTGRES_PASSWORD}" \
  --set=database="${FLOWPRO_POSTGRES_DB}" <<SQL
CREATE ROLE :"role" LOGIN PASSWORD :'password'
  NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOREPLICATION ${create_database};
CREATE DATABASE :"database" OWNER :"role";
SQL
