#!/usr/bin/env python3
import csv
import json
import subprocess
import sys

OUTPUT_FILE = "cloud_run_settings.csv"

def fetch_services():
    """Fetch all Cloud Run services across all regions in JSON format."""
    command = ["gcloud", "run", "services", "list", "--format=json"]
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(result.stdout)
    except FileNotFoundError:
        sys.exit("Error: 'gcloud' CLI is not installed or not in PATH.")
    except subprocess.CalledProcessError as e:
        sys.exit(f"Error running gcloud: {e.stderr.strip()}")
    except json.JSONDecodeError:
        sys.exit("Error parsing gcloud JSON output.")

def parse_service(svc):
    """Extract relevant scaling, concurrency, and metadata settings."""
    metadata = svc.get("metadata", {})
    spec = svc.get("spec", {})
    template = spec.get("template", {})
    template_meta = template.get("metadata", {})
    annotations = template_meta.get("annotations", {})
    template_spec = template.get("spec", {})

    # Name and Location
    name = metadata.get("name", "unknown")
    labels = metadata.get("labels", {})
    region = labels.get("cloud.googleapis.com/location", "unknown")
    project = metadata.get("namespace", "unknown")

    # Scaling settings
    # If unconfigured, minScale defaults to 0 and maxScale defaults to 100
    min_instances = annotations.get("autoscaling.knative.dev/minScale", "0 (default)")
    max_instances = annotations.get("autoscaling.knative.dev/maxScale", "100 (default)")

    # Concurrency settings
    # 0 or unconfigured defaults to 80 concurrent requests per instance
    raw_concurrency = template_spec.get("containerConcurrency")
    if raw_concurrency in (0, None):
        concurrency = "80 (default)"
    else:
        concurrency = str(raw_concurrency)

    # CPU Allocation (Throttling behaviour)
    # CPU throttling defaults to True if unset (CPU only allocated during requests)
    cpu_boost = annotations.get("run.googleapis.com/startup-cpu-boost", "false")
    cpu_idle = annotations.get("run.googleapis.com/cpu-throttling", "true")

    return {
        "Project": project,
        "Service Name": name,
        "Region": region,
        "Min Instances": min_instances,
        "Max Instances": max_instances,
        "Concurrency": concurrency,
        "CPU Throttled When Idle": cpu_idle,
        "Startup CPU Boost": cpu_boost
    }

def main():
    print("Fetching Cloud Run services across all regions...")
    services = fetch_services()

    if not services:
        print("No Cloud Run services found in the current active project.")
        return

    fieldnames = [
        "Project",
        "Service Name",
        "Region",
        "Min Instances",
        "Max Instances",
        "Concurrency",
        "CPU Throttled When Idle",
        "Startup CPU Boost"
    ]

    with open(OUTPUT_FILE, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for svc in services:
            writer.writerow(parse_service(svc))

    print(f"Exported {len(services)} services to '{OUTPUT_FILE}'.")

if __name__ == "__main__":
    main()