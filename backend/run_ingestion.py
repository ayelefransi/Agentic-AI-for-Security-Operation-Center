import os
from rag.ingestion import DataIngestionPipeline

if __name__ == "__main__":
    print("Initializing Ingestion Pipeline...")
    pipeline = DataIngestionPipeline()
    
    # Ingest Policy
    policy_path = os.path.join("data", "policies", "sample_policy.txt")
    if os.path.exists(policy_path):
        print(f"Ingesting {policy_path}")
        pipeline.process_and_store(policy_path)
    else:
        print(f"Policy file not found at {policy_path}")
        
    # Ingest Logs
    logs_path = os.path.join("data", "sample_logs.json")
    if os.path.exists(logs_path):
        print(f"Ingesting {logs_path}")
        pipeline.process_and_store(logs_path)
    else:
        print(f"Logs file not found at {logs_path}")
        
    print("Ingestion complete.")
