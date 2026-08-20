#!/usr/bin/env python3
import argparse
import csv
import re
import subprocess
import sys

def parse_int_value(val: str):
    """
    Extract an integer from strings like '80', '80 (default)', or ' 100 '.
    Returns None if the value is empty or cannot be parsed.
    """
    if not val:
        return None
    match = re.search(r"\d+", str(val))
    return int(match.group(0)) if match else None

def build_update_command(row: dict) -> list[str]:
    """Construct the gcloud update command based on populated CSV row values."""
    # Support both human-readable and raw uppercase column headers
    service = row.get("Service Name") or row.get("SERVICE") or row.get("Service")
    region = row.get("Region") or row.get("REGION")
    project = row.get("Project") or row.get("PROJECT")

    if not service or not region:
        return []

    min_inst = parse_int_value(row.get("Min Instances") or row.get("MIN_INSTANCES"))
    max_inst = parse_int_value(row.get("Max Instances") or row.get("MAX_INSTANCES"))
    concurrency = parse_int_value(row.get("Concurrency") or row.get("CONCURRENCY"))

    cmd = ["gcloud", "run", "services", "update", service.strip(), f"--region={region.strip()}"]

    if project and project.strip() not in ("unknown", ""):
        cmd.append(f"--project=lucid-b0b9e")

    if min_inst is not None:
        cmd.append(f"--min-instances={min_inst}")

    if max_inst is not None:
        cmd.append(f"--max-instances={max_inst}")

    if concurrency is not None:
        cmd.append(f"--concurrency={concurrency}")

    cmd.append("--quiet")
    return cmd

def main():
    parser = argparse.ArgumentParser(
        description="Apply concurrency and scaling configurations from a CSV to Cloud Run."
    )
    parser.add_argument(
        "-f", "--file",
        default="cloud_run_settings.csv",
        help="Path to the input CSV file (default: cloud_run_settings.csv)"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute the updates on GCP. Without this flag, the script runs in dry-run mode."
    )
    args = parser.parse_args()

    try:
        with open(args.file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except FileNotFoundError:
        sys.exit(f"Error: File '{args.file}' not found.")
    except Exception as e:
        sys.exit(f"Error reading CSV: {e}")

    if not rows:
        sys.exit("CSV file is empty or missing headers.")

    print(f"Loaded {len(rows)} entries from '{args.file}'.")
    if not args.execute:
        print("\n=== DRY RUN MODE (No changes will be applied) ===")
        print("Pass --execute to apply these changes to GCP.\n")

    success_count = 0
    failure_count = 0
    skipped_count = 0

    for idx, row in enumerate(rows, start=1):
        cmd = build_update_command(row)
        service_name = row.get("Service Name") or row.get("SERVICE") or f"Row {idx}"

        if not cmd:
            print(f"[{idx}/{len(rows)}] Skipping '{service_name}': Missing service name or region.")
            skipped_count += 1
            continue

        cmd_display = " ".join(cmd)

        if not args.execute:
            print(f"[DRY RUN {idx}/{len(rows)}] Would run: {cmd_display}")
            success_count += 1
            continue

        print(f"[{idx}/{len(rows)}] Updating '{service_name}'...")
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            print(f"  ✓ Successfully updated {service_name}")
            success_count += 1
        except subprocess.CalledProcessError as e:
            print(f"  ✗ Failed to update {service_name}: {e.stderr.strip()}")
            failure_count += 1

    print("\n=== Summary ===")
    print(f"Processed: {len(rows)}")
    print(f"Succeeded / Ready: {success_count}")
    print(f"Failed:            {failure_count}")
    print(f"Skipped:           {skipped_count}")

if __name__ == "__main__":
    main()