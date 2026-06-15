#!/usr/bin/env bash
set -e
docker stop pm-app || true
docker rm pm-app || true
