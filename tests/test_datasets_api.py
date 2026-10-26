import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.hf_service import (
    validate_and_extract_repo_id,
    inspect_hf_dataset,
    download_dataset_partition
)

def test_url_validation():
    print("\n--- Testing URL Validation ---")
    valid_cases = [
        ("https://huggingface.co/datasets/tatsu-lab/alpaca", "tatsu-lab/alpaca"),
        ("huggingface.co/datasets/mozilla-foundation/common_voice_11_0", "mozilla-foundation/common_voice_11_0"),
        ("tatsu-lab/alpaca", "tatsu-lab/alpaca"),
        ("imdb", "imdb")
    ]
    for url, expected in valid_cases:
        res = validate_and_extract_repo_id(url)
        assert res == expected, f"Expected {expected}, got {res}"
        print(f" [PASS] '{url}' -> '{res}'")

    invalid_cases = [
        "https://malicious.com/datasets/test",
        "../../etc/passwd",
        "tatsu-lab/alpaca; rm -rf /",
        ""
    ]
    for inv in invalid_cases:
        try:
            validate_and_extract_repo_id(inv)
            assert False, f"Expected validation failure for '{inv}'"
        except ValueError:
            print(f" [PASS] Correctly rejected invalid input: '{inv}'")

def test_inspection():
    print("\n--- Testing Dataset Metadata Inspection ---")
    meta = inspect_hf_dataset("tatsu-lab/alpaca")
    print(f" [PASS] Repo: {meta['repo_id']}")
    print(f" [PASS] Author: {meta['author']}")
    print(f" [PASS] Gated: {meta['is_gated']}, Private: {meta['is_private']}")
    print(f" [PASS] Splits: {meta['splits']}")
    assert meta["repo_id"] == "tatsu-lab/alpaca"

def test_download_partition():
    print("\n--- Testing Bounded Dataset Download / Cache ---")
    res = download_dataset_partition("tatsu-lab/alpaca", config="default", split="train", max_rows=5)
    print(f" [PASS] Downloaded Rows: {res['downloaded_rows']}")
    print(f" [PASS] Local File Path: {res['local_path']}")
    print(f" [PASS] File Size: {res['file_size_bytes']} bytes ({res['file_size_mb']} MB)")
    print(f" [PASS] Sample 1 preview: {res['preview'][0] if res['preview'] else 'N/A'}")
    assert res["downloaded_rows"] > 0
    assert Path(res["local_path"]).exists()

if __name__ == "__main__":
    test_url_validation()
    test_inspection()
    test_download_partition()
    print("\n[SUCCESS] ALL BACKEND PIPELINE TESTS PASSED SUCCESSFULLY!")
