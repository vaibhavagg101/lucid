#!/usr/bin/env bash
# Audits the deployed services and counts Cloud Run requests since a test run started.
# Usage: ./gcp-check.sh "2026-08-21T18:00:00Z"
set -euo pipefail

START="${1:-}"
PROJECT="${FIREBASE_PROJECT_ID:-$(grep -E '^FIREBASE_PROJECT_ID=' .env | cut -d= -f2-)}"

echo "Project: $PROJECT"

echo
echo "=== Cloud Run settings (concurrency is the one that matters for demucs) ==="
# Services are spread across regions, so discover them rather than assuming one.
SERVICES_TSV=$(gcloud run services list --project "$PROJECT" \
  --format='csv[no-heading,separator=","](metadata.name, metadata.labels."cloud.googleapis.com/location", spec.template.spec.containerConcurrency, spec.template.metadata.annotations."autoscaling.knative.dev/maxScale", spec.template.spec.containers[0].resources.limits.cpu, spec.template.spec.containers[0].resources.limits.memory, spec.template.spec.timeoutSeconds)')

printf '%-20s %-14s %-12s %-14s %-6s %-8s %s\n' SERVICE REGION CONCURRENCY MAX_INSTANCES CPU MEMORY TIMEOUT
while IFS=, read -r name region conc maxi cpu mem timeout; do
  [[ -z "$name" ]] && continue
  printf '%-20s %-14s %-12s %-14s %-6s %-8s %s\n' \
    "$name" "$region" "${conc:-default(80)}" "${maxi:-unset}" "${cpu:-?}" "${mem:-?}" "${timeout:-?}"
done <<< "$SERVICES_TSV"

echo
echo "=== Pub/Sub push subscriptions (ackDeadline shorter than the job = duplicate work) ==="
printf '%-38s %-12s %-10s %s\n' SUBSCRIPTION ACK_DEADLINE RETRY PUSH_ENDPOINT
gcloud pubsub subscriptions list --project "$PROJECT" \
  --format='csv[no-heading,separator=","](name.basename(), ackDeadlineSeconds, retryPolicy.minimumBackoff, pushConfig.pushEndpoint)' |
  while IFS=, read -r name ack retry endpoint; do
    [[ -z "$name" ]] && continue
    printf '%-38s %-12s %-10s %s\n' "$name" "$ack" "${retry:-default}" "${endpoint:-PULL}"
  done

echo
echo "=== Firebase Functions instance limits ==="
gcloud functions list --project "$PROJECT" \
  --format='table(name.basename(), serviceConfig.maxInstanceCount, serviceConfig.availableMemory)' 2>/dev/null ||
  echo "(gcloud functions list unavailable)"

if [[ -n "$START" ]]; then
  echo
  echo "=== Cloud Run requests since $START (vs. jobs actually submitted) ==="
  echo "More requests than jobs = Pub/Sub redelivered and the container did the work twice."
  printf '%-20s %s\n' SERVICE REQUESTS
  while IFS=, read -r name _rest; do
    [[ -z "$name" ]] && continue
    count=$(gcloud logging read \
      "resource.type=cloud_run_revision AND resource.labels.service_name=\"$name\" AND httpRequest.requestMethod=\"POST\" AND timestamp>=\"$START\"" \
      --project "$PROJECT" --format='value(timestamp)' --limit 1000 2>/dev/null | wc -l)
    printf '%-20s %s\n' "$name" "$count"
  done <<< "$SERVICES_TSV"
fi
