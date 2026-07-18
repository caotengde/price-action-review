#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import fingerprinted review cases.")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--site-root", type=Path, default=Path(__file__).parents[1])
    args = parser.parse_args()
    source = json.loads(args.source.read_text(encoding="utf-8"))
    target_data = args.site_root / "data"
    target_images = args.site_root / "assets" / "cases"
    target_data.mkdir(parents=True, exist_ok=True)
    target_images.mkdir(parents=True, exist_ok=True)
    public_cases = []
    for case in source["cases"]:
        image = Path(case["image_path"])
        if sha256(image) != case["image_sha256"]:
            raise ValueError(f"Image fingerprint mismatch: {image}")
        target = target_images / image.name
        shutil.copyfile(image, target)
        public_cases.append(
            {
                "case_id": case["case_id"],
                "case_fingerprint": case["case_fingerprint"],
                "symbol": case["symbol"],
                "timeframe": case["timeframe"],
                "title": case["title"],
                "data_end_utc": case["data_end_utc"],
                "bar_open_time": case["bar_open_time"],
                "bar_status": case["bar_status"],
                "image_url": f"./assets/cases/{target.name}",
                "image_sha256": case["image_sha256"],
                "interpreter_name": case["interpreter_name"],
                "summary": case["summary"],
                "items": [
                    {
                        "item_id": item["item_id"],
                        "category": item["category"],
                        "object_type": item["object_type"],
                        "statement_cn": item["statement_cn"],
                        "confidence": item["confidence"],
                    }
                    for item in case["items"]
                ],
            }
        )
    output = {
        "schema_version": 1,
        "dataset_name": "public_owner_centered_price_action_review",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "case_count": len(public_cases),
        "trading_enabled": False,
        "cases": public_cases,
    }
    (target_data / "cases.json").write_text(
        json.dumps(output, indent=2, ensure_ascii=False, allow_nan=False),
        encoding="utf-8",
    )
    print(f"PUBLIC_CASE_IMPORT_COMPLETE cases={len(public_cases)}", flush=True)


if __name__ == "__main__":
    main()
