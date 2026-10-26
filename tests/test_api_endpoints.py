import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    print("\n--- Testing GET /api/health ---")
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    print(" [PASS] Response:", data)
    assert data["status"] == "healthy"

def test_validate_url_api():
    print("\n--- Testing POST /api/datasets/validate-url ---")
    # Valid URL
    resp = client.post("/api/datasets/validate-url", json={"url": "https://huggingface.co/datasets/tatsu-lab/alpaca"})
    assert resp.status_code == 200
    data = resp.json()
    print(" [PASS] Valid URL:", data)
    assert data["valid"] is True
    assert data["repo_id"] == "tatsu-lab/alpaca"

    # Malicious / invalid URL
    bad_resp = client.post("/api/datasets/validate-url", json={"url": "https://malicious.com/data"})
    assert bad_resp.status_code == 400
    print(" [PASS] Correctly rejected malicious domain:", bad_resp.json())

def test_inspect_api():
    print("\n--- Testing POST /api/datasets/inspect ---")
    resp = client.post("/api/datasets/inspect", json={"url": "tatsu-lab/alpaca"})
    assert resp.status_code == 200
    data = resp.json()
    print(f" [PASS] Inspected {data['repo_id']}: Gated={data['is_gated']}, Author={data['author']}")

def test_download_api():
    print("\n--- Testing POST /api/datasets/download ---")
    resp = client.post("/api/datasets/download", json={
        "url": "tatsu-lab/alpaca",
        "config": "default",
        "split": "train",
        "max_rows": 5
    })
    if resp.status_code != 200:
        print("Download endpoint failed:", resp.status_code, resp.text)
    assert resp.status_code == 200
    data = resp.json()
    print(f" [PASS] Downloaded {data['downloaded_rows']} rows to: {data['local_path']}")
    print(f" [PASS] File size: {data['file_size_bytes']} bytes ({data['file_size_mb']} MB)")
    assert Path(data["local_path"]).exists()

def test_planner_api():
    print("\n--- Testing POST /api/planner/generate-metrics (Gemini) ---")
    resp = client.post("/api/planner/generate-metrics", json={
        "training_objective": "Fine-tune an instruction-following LLM. Audit instruction-output alignment, detect empty responses, and evaluate token distribution.",
        "dataset_name": "tatsu-lab/alpaca",
        "schema_definitions": {"instruction": "string", "input": "string", "output": "string"},
        "sample_records": [{"instruction": "Give three tips for staying healthy.", "output": "1. Eat balanced diet. 2. Exercise. 3. Sleep."}]
    })
    if resp.status_code != 200:
        print("Planner endpoint failed:", resp.status_code, resp.text)
    assert resp.status_code == 200
    data = resp.json()
    print(f" [PASS] Inferred Domain: {data['task_profile']['inferred_domain']}")
    print(f" [PASS] Qualitative Metrics Count: {len(data['qualitative_metrics'])}")
    for q in data["qualitative_metrics"][:2]:
        print(f"        - {q['metric_id']}: {q['metric_name']}")
    print(f" [PASS] Physical Metrics Count: {len(data['physical_metrics'])}")
    for p in data["physical_metrics"][:2]:
        print(f"        - {p['metric_id']}: {p['metric_name']} (Threshold: {p['recommended_threshold']})")

def test_eval_prompt_api():
    print("\n--- Testing POST /api/planner/generate-eval-prompt (Gemini) ---")
    resp = client.post("/api/planner/generate-eval-prompt", json={
        "training_objective": "Fine-tune an instruction-following LLM.",
        "dataset_name": "tatsu-lab/alpaca",
        "inferred_domain": "NLP / Instruction",
        "inferred_learning_paradigm": "Supervised Fine-Tuning",
        "qualitative_metrics": [
            {"metric_id": "QUAL_01", "metric_name": "Instruction Alignment", "evaluation_rubric": "Strict adherence."}
        ]
    })
    assert resp.status_code == 200
    data = resp.json()
    print(" [PASS] Status:", data["status"])
    print(" [PASS] Metrics Summary:", data["target_metrics_summary"])
    assert len(data["eval_system_prompt"]) > 10
    assert len(data["eval_user_prompt_template"]) > 10

if __name__ == "__main__":
    test_health_endpoint()
    test_validate_url_api()
    test_inspect_api()
    test_download_api()
    test_planner_api()
    test_eval_prompt_api()
    print("\n[SUCCESS] ALL FASTAPI HTTP ENDPOINTS TESTED AND VERIFIED!")
