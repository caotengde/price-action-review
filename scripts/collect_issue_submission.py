#!/usr/bin/env python3
from __future__ import annotations

import base64
import gzip
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path


MARKER = re.compile(
    r"<!--\s*PRICE_ACTION_REVIEW_GZIP_BASE64\s*\n([A-Za-z0-9+/=\r\n]+?)\n-->",
    re.MULTILINE,
)
VERDICTS = {"CORRECT", "INCORRECT", "UNCERTAIN"}
EXPERIENCE = {"UNSPECIFIED", "LEARNING", "INTERMEDIATE", "ADVANCED", "EXPERT"}


def load_payload(issue_body: str) -> dict[str, object]:
    match = MARKER.search(issue_body)
    if match is None:
        raise ValueError("Missing machine-readable review payload")
    encoded = "".join(match.group(1).split())
    if len(encoded) > 100_000:
        raise ValueError("Compressed review payload is too large")
    raw = gzip.decompress(base64.b64decode(encoded, validate=True))
    if len(raw) > 500_000:
        raise ValueError("Review payload is too large")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError("Review payload must be an object")
    return payload


def validate_payload(
    payload: dict[str, object], cases: dict[str, dict[str, object]]
) -> dict[str, object]:
    if payload.get("schema_version") != 1:
        raise ValueError("Unsupported submission schema")
    case_id = str(payload.get("case_id", ""))
    if case_id not in cases:
        raise ValueError("Unknown review case")
    case = cases[case_id]
    if payload.get("case_fingerprint") != case["case_fingerprint"]:
        raise ValueError("Case fingerprint mismatch")
    submission_id = str(payload.get("submission_id", ""))
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", submission_id):
        raise ValueError("Invalid submission ID")
    contributor = payload.get("contributor")
    if not isinstance(contributor, dict):
        raise ValueError("Contributor metadata must be an object")
    claimed_name = str(contributor.get("claimed_name", ""))[:80]
    experience = str(contributor.get("experience_level", "UNSPECIFIED"))
    if experience not in EXPERIENCE:
        raise ValueError("Unknown experience level")
    known_items = {item["item_id"] for item in case["items"]}
    annotations = payload.get("annotations")
    if not isinstance(annotations, list) or len(annotations) > len(known_items):
        raise ValueError("Invalid annotation collection")
    seen: set[str] = set()
    clean_annotations = []
    for annotation in annotations:
        if not isinstance(annotation, dict):
            raise ValueError("Annotation must be an object")
        item_id = str(annotation.get("item_id", ""))
        verdict = str(annotation.get("verdict", ""))
        if item_id not in known_items or item_id in seen:
            raise ValueError("Unknown or duplicate review item")
        if verdict not in VERDICTS:
            raise ValueError("Unknown verdict")
        corrected = str(annotation.get("corrected_value", ""))[:3000].strip()
        if verdict == "INCORRECT" and not corrected:
            raise ValueError("Incorrect verdict requires a correction")
        tags = annotation.get("error_tags", [])
        if not isinstance(tags, list) or len(tags) > 12:
            raise ValueError("Invalid error tags")
        clean_annotations.append(
            {
                "item_id": item_id,
                "verdict": verdict,
                "corrected_value": corrected,
                "comment": str(annotation.get("comment", ""))[:3000].strip(),
                "error_tags": sorted({str(tag)[:80] for tag in tags}),
            }
        )
        seen.add(item_id)
    missing = payload.get("missing_interpretations", [])
    if not isinstance(missing, list) or len(missing) > 50:
        raise ValueError("Invalid missing interpretation collection")
    clean_missing = []
    for item in missing:
        if not isinstance(item, dict):
            raise ValueError("Missing interpretation must be an object")
        statement = str(item.get("expected_statement", ""))[:1000].strip()
        if not statement:
            raise ValueError("Missing interpretation requires a statement")
        x, y = item.get("chart_x"), item.get("chart_y")
        for value in (x, y):
            if value is not None and not 0.0 <= float(value) <= 1.0:
                raise ValueError("Chart coordinate outside [0, 1]")
        clean_missing.append(
            {
                "category": str(item.get("category", "MISSED_STRUCTURE"))[:80],
                "expected_statement": statement,
                "comment": str(item.get("comment", ""))[:2000].strip(),
                "chart_x": x,
                "chart_y": y,
            }
        )
    if not clean_annotations and not clean_missing:
        raise ValueError("Empty review submission")
    return {
        "schema_version": 1,
        "submission_id": submission_id.lower(),
        "case_id": case_id,
        "case_fingerprint": case["case_fingerprint"],
        "contributor": {
            "claimed_name": claimed_name,
            "experience_level": experience,
        },
        "client_created_utc": str(payload.get("created_utc", ""))[:80],
        "annotations": clean_annotations,
        "missing_interpretations": clean_missing,
    }


def rebuild_jsonl(submissions: Path, output: Path) -> None:
    records = []
    for path in sorted(submissions.glob("issue-*.json")):
        records.append(json.loads(path.read_text(encoding="utf-8")))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        "".join(json.dumps(record, ensure_ascii=False, allow_nan=False) + "\n" for record in records),
        encoding="utf-8",
    )


def main() -> None:
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    issue = event["issue"]
    manifest = json.loads(Path("data/cases.json").read_text(encoding="utf-8"))
    cases = {case["case_id"]: case for case in manifest["cases"]}
    payload = validate_payload(load_payload(str(issue.get("body", ""))), cases)
    payload["github"] = {
        "issue_number": int(issue["number"]),
        "issue_url": issue["html_url"],
        "author_login": issue["user"]["login"],
        "author_association": issue.get("author_association", "NONE"),
        "issue_created_utc": issue["created_at"],
        "collected_utc": datetime.now(timezone.utc).isoformat(),
    }
    submissions = Path("submissions")
    submissions.mkdir(exist_ok=True)
    destination = submissions / (
        f"issue-{int(issue['number']):06d}-{payload['submission_id']}.json"
    )
    if destination.exists():
        raise ValueError("Submission has already been collected")
    destination.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, allow_nan=False),
        encoding="utf-8",
    )
    rebuild_jsonl(submissions, Path("data/reviews.jsonl"))
    print(f"COLLECTED_REVIEW issue={issue['number']} destination={destination}")


if __name__ == "__main__":
    main()
