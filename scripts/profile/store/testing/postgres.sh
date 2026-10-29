#!/usr/bin/env bash
# A Postgres 17 for the store tests, with TLS the client can verify.
#
# The tools never turn certificate verification off, not even for a test, so a
# test database needs a certificate: this generates a private CA and a server
# certificate for localhost, starts Postgres with them, and prints the two
# variables the tests need.
#
#   export $(scripts/profile/store/testing/postgres.sh start | xargs)
#   pnpm test:store
#   scripts/profile/store/testing/postgres.sh stop
#
# It prints `KEY=value` lines, which is also what GitHub Actions appends to
# $GITHUB_ENV.
set -euo pipefail

name=${PROFILE_TEST_POSTGRES_NAME:-profile-store-postgres}
port=${PROFILE_TEST_POSTGRES_PORT:-55432}
password=${PROFILE_TEST_POSTGRES_PASSWORD:-store-tests}
image=${PROFILE_TEST_POSTGRES_IMAGE:-postgres:17}
certs=${PROFILE_TEST_CERTS:-$(cd "$(dirname "$0")/../../../.." && pwd)/.postgres-tls}

generate_certificates() {
  mkdir -p "$certs"
  [ -f "$certs/server.key" ] && return 0
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 -sha256 \
    -keyout "$certs/ca.key" -out "$certs/ca.crt" \
    -subj "/CN=Profile store test CA" >/dev/null 2>&1
  openssl req -newkey rsa:2048 -nodes -keyout "$certs/server.key" \
    -out "$certs/server.csr" -subj "/CN=localhost" >/dev/null 2>&1
  openssl x509 -req -in "$certs/server.csr" -days 365 -sha256 \
    -CA "$certs/ca.crt" -CAkey "$certs/ca.key" -CAcreateserial \
    -extfile <(printf 'subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=CA:FALSE\n') \
    -out "$certs/server.crt" >/dev/null 2>&1
  chmod 644 "$certs"/*.crt
  chmod 600 "$certs/server.key"
}

start() {
  generate_certificates
  if [ -n "$(docker ps -q --filter "name=^${name}$")" ]; then
    echo "# ${name} is already running" >&2
  else
    docker rm -f "$name" >/dev/null 2>&1 || true
    # The entrypoint runs as root, so the key can be given to the postgres user
    # before the server starts: Postgres refuses a key anyone else can read.
    docker run -d --name "$name" \
      -e POSTGRES_PASSWORD="$password" \
      -e POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 \
      -p "127.0.0.1:${port}:5432" \
      -v "$certs:/certs:ro" \
      --entrypoint /bin/bash \
      "$image" -c '
        install -o postgres -g postgres -m 600 /certs/server.key /var/lib/postgresql/server.key &&
        install -o postgres -g postgres -m 644 /certs/server.crt /var/lib/postgresql/server.crt &&
        exec docker-entrypoint.sh postgres \
          -c ssl=on \
          -c ssl_cert_file=/var/lib/postgresql/server.crt \
          -c ssl_key_file=/var/lib/postgresql/server.key \
          -c log_connections=on' >/dev/null
  fi
  for _ in $(seq 1 60); do
    if docker exec "$name" pg_isready -q -U postgres; then break; fi
    sleep 1
  done
  docker exec "$name" pg_isready -U postgres >/dev/null
  echo "PROFILE_TEST_ADMIN_URL=postgres://postgres:${password}@localhost:${port}/postgres"
  echo "NODE_EXTRA_CA_CERTS=${certs}/ca.crt"
}

stop() {
  docker rm -f "$name" >/dev/null 2>&1 || true
}

case "${1:-}" in
start) start ;;
stop) stop ;;
*)
  echo "Usage: $0 start|stop" >&2
  exit 2
  ;;
esac
