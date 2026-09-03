"""Generate standalone report JSON files from the configured session store."""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from backend.report import build_report
from backend.store import build_store


def _has_valid_reaction_time(result: dict) -> bool:
    for round_data in result.get("rounds") or []:
        for trial in round_data.get("trials") or []:
            value = trial.get("reactionTimeMs")
            if isinstance(value, (int, float)) and math.isfinite(value) and value >= 0:
                return True
    return False


def _recover_empty_timer(report: dict, session: dict) -> bool:
    games = session.get("games") or {}
    timer = games.get("timer") or {}
    result = timer.get("result") or {}
    metrics = result.get("metrics") or {}
    if timer.get("status") != "completed" or not metrics:
        return False
    if _has_valid_reaction_time(result) or metrics.get("accuracy") != 0:
        return False

    timer_summary = report["summary"].get("timer")
    if not timer_summary or timer_summary.get("score") is not None:
        return False
    timer_summary["score"] = 0.0
    timer_summary["recoveryNote"] = (
        "Recovered from recorded no-response timer data: accuracy was 0 and no valid reaction times were recorded."
    )
    for row in report["score_breakdown"]:
        if row["key"] == "timer":
            row.update({"score": 0.0, "pct": 0.0, "available": True})
            break
    return True


def generate_reports(output_dir: Path) -> tuple[int, int, int]:
    load_dotenv(BASE_DIR / ".env")
    store, using_mongo, note = build_store()
    if not using_mongo:
        raise RuntimeError(f"MongoDB is not available: {note}")

    output_dir.mkdir(parents=True, exist_ok=True)
    generated = 0
    recovered = 0
    blocked = 0
    manifest = []

    for session in sorted(store.list_sessions(), key=lambda item: item.get("session_id", "")):
        if not session.get("completed_at"):
            continue
        report = build_report(session)
        recovered_here = _recover_empty_timer(report, session)
        if recovered_here:
            recovered += 1
            report["report_ready"] = all(row["available"] for row in report["score_breakdown"])
            if report["report_ready"]:
                report["overall_score"] = round(
                    sum(row["score"] for row in report["score_breakdown"]), 2
                )

        session_id = session["session_id"]
        report_path = output_dir / f"{session_id}.json"
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        generated += 1
        if not report["report_ready"]:
            blocked += 1
        manifest.append({
            "session_id": session_id,
            "report_ready": report["report_ready"],
            "recovered": recovered_here,
            "missing": [row["key"] for row in report["score_breakdown"] if not row["available"]],
            "path": report_path.name,
        })

    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    return generated, recovered, blocked


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("reports_export"),
        help="Directory for generated report JSON files.",
    )
    args = parser.parse_args()
    generated, recovered, blocked = generate_reports(args.output)
    print(f"Generated {generated} reports; recovered {recovered}; still blocked {blocked}.")


if __name__ == "__main__":
    main()