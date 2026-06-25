"""Training entrypoints: HF Trainer path and custom PyTorch loop."""

from .config import DataConfig, ExperimentConfig, TrainingConfig
from .train_hf import compute_metrics, train_with_hf_trainer
from .train_loop import evaluate, train_with_custom_loop

__all__ = [
    "DataConfig",
    "ExperimentConfig",
    "TrainingConfig",
    "compute_metrics",
    "train_with_hf_trainer",
    "evaluate",
    "train_with_custom_loop",
]
