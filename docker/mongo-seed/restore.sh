#!/bin/bash
# Runs once, when the db container starts on an empty volume: loads a snapshot
# of the TOR records so a fresh checkout has real data before the first sync.
# Loaded under both database names in use — `torr` (backend in Docker) and
# `torfinder` (backend run from the shell against this container).
#
# Refresh the snapshot from a database that has the records you want:
#   mongodump --uri mongodb://localhost:27017/torfinder --collection tors --gzip \
#     --archive=docker/mongo-seed/tors.archive.gz
set -euo pipefail

for db in torr torfinder; do
  mongorestore \
    --username "$MONGO_INITDB_ROOT_USERNAME" \
    --password "$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --gzip --archive=/docker-entrypoint-initdb.d/tors.archive.gz \
    --nsFrom 'torfinder.*' --nsTo "$db.*"
done
