#!/bin/sh
set -e

# simple backup script for local dev/prod compose
BACKUP_DIR=/backups
TIMESTAMP=$(date +"%Y%m%dT%H%M%S")
PGHOST=${PGHOST:-postgres}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-ambulant}
PGPASSWORD=${PGPASSWORD:-supersecretpg}
DBNAME=${DBNAME:-ambulant}

export PGPASSWORD

mkdir -p ${BACKUP_DIR}
pg_dump -h ${PGHOST} -p ${PGPORT} -U ${PGUSER} -F c -b -v -f "${BACKUP_DIR}/${DBNAME}_${TIMESTAMP}.dump" ${DBNAME}

# keep last 7 backups
ls -1t ${BACKUP_DIR} | tail -n +8 | xargs -r -I {} rm -f ${BACKUP_DIR}/{}
