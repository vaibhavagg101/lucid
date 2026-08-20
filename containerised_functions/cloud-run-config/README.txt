1. To export configurations of all cloud run instances across all regions into a structured CSV file:
    python3 export_cloud_run_configs.py

2. Edit CSV: Open cloud_run_settings.csv and adjust any numerical values under Min Instances, Max Instances, or Concurrency as required.
!!IMPORTANT NOTE: This will fail for firebase functions and deploy a failed container. So REMOVE those rows before moving forward.

3. Preview changes:
    python3 apply_cloud_run_configs.py

4. Apply changes:
    python3 apply_cloud_run_configs.py --execute
