"""CLI entrypoint comparing the three fine-tuning strategies.

Runs ``frozen``, ``full`` and ``lora`` fine-tuning (via either the HF Trainer
or the custom PyTorch loop), collects accuracy / F1 / trainable-parameter
counts, and prints a comparison table.

Examples
--------
Run all three with the HF Trainer:
    python scripts/run_experiment.py --backend hf

Run a single mode with the custom loop:
    python scripts/run_experiment.py --backend loop --modes lora

The script is import-safe; heavy training only runs under ``__main__``.
"""

from __future__ import annotations

import argparse
import json
from typing import Dict, List

from dotenv import load_dotenv

from training.config import ExperimentConfig
from training.train_hf import train_with_hf_trainer
from training.train_loop import train_with_custom_loop


def _format_params(n: int) -> str:
    """Human-readable parameter count (e.g. 66955776 -> '67.0M')."""
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}K"
    return str(n)


def _extract_row(mode: str, result: Dict, backend: str) -> Dict:
    """Normalize a result dict from either backend into one comparison row."""
    params = result["params"]
    if backend == "hf":
        acc = result["test"].get("test_accuracy")
        f1 = result["test"].get("test_f1_weighted")
    else:  # custom loop
        acc = result["test"].get("accuracy")
        f1 = result["test"].get("f1_weighted")
    return {
        "mode": mode,
        "trainable_params": params["trainable"],
        "total_params": params["total"],
        "test_accuracy": acc,
        "test_f1_weighted": f1,
    }


def run(modes: List[str], backend: str) -> List[Dict]:
    """Run the requested modes and return comparison rows."""
    rows = []
    for mode in modes:
        print(f"\n{'=' * 60}\nRunning mode='{mode}' backend='{backend}'\n{'=' * 60}")
        config = ExperimentConfig(mode=mode)
        if backend == "hf":
            result = train_with_hf_trainer(config)
        else:
            result = train_with_custom_loop(config)
        rows.append(_extract_row(mode, result, backend))
    return rows


def print_table(rows: List[Dict]) -> None:
    """Pretty-print the comparison table."""
    header = f"{'Approach':<16}{'Trainable':>12}{'Total':>10}{'Accuracy':>11}{'F1 (w)':>9}"
    print("\n" + header)
    print("-" * len(header))
    for row in rows:
        acc = row["test_accuracy"]
        f1 = row["test_f1_weighted"]
        print(
            f"{row['mode']:<16}"
            f"{_format_params(row['trainable_params']):>12}"
            f"{_format_params(row['total_params']):>10}"
            f"{(f'{acc:.4f}' if acc is not None else 'n/a'):>11}"
            f"{(f'{f1:.4f}' if f1 is not None else 'n/a'):>9}"
        )


def main() -> None:  # pragma: no cover
    parser = argparse.ArgumentParser(description="Compare fine-tuning strategies.")
    parser.add_argument(
        "--backend",
        choices=["hf", "loop"],
        default="hf",
        help="Training backend: HF Trainer ('hf') or custom loop ('loop').",
    )
    parser.add_argument(
        "--modes",
        nargs="+",
        default=["frozen", "full", "lora"],
        choices=["frozen", "full", "lora"],
        help="Which strategies to run.",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Optional path to dump the comparison rows as JSON.",
    )
    args = parser.parse_args()

    load_dotenv()
    rows = run(args.modes, args.backend)
    print_table(rows)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(rows, fh, indent=2)
        print(f"\nWrote results to {args.out}")


if __name__ == "__main__":  # pragma: no cover
    main()
