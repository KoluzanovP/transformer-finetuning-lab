"""Dataclass-based configuration objects.

Centralizes all hyper-parameters so the HF Trainer path, the custom loop, and
the experiment runner share one consistent source of truth. Values can be
overridden from environment variables (see ``.env.example``).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List, Optional


def _env_float(key: str, default: float) -> float:
    return float(os.getenv(key, default))


def _env_int(key: str, default: int) -> int:
    return int(os.getenv(key, default))


def _env_str(key: str, default: str) -> str:
    return os.getenv(key, default)


@dataclass
class DataConfig:
    """Dataset + tokenization settings."""

    dataset_name: str = field(default_factory=lambda: _env_str("DATASET_NAME", "emotion"))
    model_name: str = field(default_factory=lambda: _env_str("MODEL_NAME", "distilbert-base-uncased"))
    num_labels: int = field(default_factory=lambda: _env_int("NUM_LABELS", 6))
    max_seq_length: int = field(default_factory=lambda: _env_int("MAX_SEQ_LENGTH", 128))


@dataclass
class TrainingConfig:
    """Optimization + logging settings."""

    learning_rate: float = field(default_factory=lambda: _env_float("LEARNING_RATE", 2e-5))
    batch_size: int = field(default_factory=lambda: _env_int("BATCH_SIZE", 32))
    num_epochs: int = field(default_factory=lambda: _env_int("NUM_EPOCHS", 3))
    weight_decay: float = field(default_factory=lambda: _env_float("WEIGHT_DECAY", 0.01))
    warmup_ratio: float = field(default_factory=lambda: _env_float("WARMUP_RATIO", 0.1))
    seed: int = field(default_factory=lambda: _env_int("SEED", 42))
    output_dir: str = field(default_factory=lambda: _env_str("OUTPUT_DIR", "./artifacts"))
    logging_dir: str = field(default_factory=lambda: _env_str("LOGGING_DIR", "./runs"))
    early_stopping_patience: int = 2


@dataclass
class ExperimentConfig:
    """Top-level config tying everything together for a single run.

    ``mode`` selects the fine-tuning strategy:
        * ``"frozen"`` - freeze encoder, train classifier head only
        * ``"full"``   - full fine-tuning of all parameters
        * ``"lora"``   - parameter-efficient fine-tuning with LoRA adapters
    """

    mode: str = "full"
    data: DataConfig = field(default_factory=DataConfig)
    training: TrainingConfig = field(default_factory=TrainingConfig)
    # LoRA hyper-parameters (used only when mode == "lora")
    lora_r: int = 8
    lora_alpha: int = 16
    lora_dropout: float = 0.1

    @property
    def run_name(self) -> str:
        return f"{self.data.model_name.split('/')[-1]}-{self.mode}"

    @property
    def supported_modes(self) -> List[str]:
        return ["frozen", "full", "lora"]
