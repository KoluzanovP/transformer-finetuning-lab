"""PEFT / LoRA configuration helpers.

LoRA (Low-Rank Adaptation) injects small trainable rank-decomposition matrices
into the attention projection layers while keeping the original weights frozen.
For DistilBERT the relevant projection modules are ``q_lin`` and ``v_lin``.
"""

from __future__ import annotations

from typing import List, Optional

from peft import LoraConfig, TaskType, get_peft_model
from transformers import PreTrainedModel

# Attention projections targeted by LoRA inside DistilBERT.
DEFAULT_TARGET_MODULES = ["q_lin", "v_lin"]


def build_lora_config(
    r: int = 8,
    lora_alpha: int = 16,
    lora_dropout: float = 0.1,
    target_modules: Optional[List[str]] = None,
) -> LoraConfig:
    """Create a :class:`peft.LoraConfig` for sequence classification.

    Parameters
    ----------
    r:
        Rank of the low-rank update matrices.
    lora_alpha:
        LoRA scaling factor (effective scale is ``lora_alpha / r``).
    lora_dropout:
        Dropout applied to the LoRA path.
    target_modules:
        Module name suffixes to adapt. Defaults to DistilBERT's attention
        query/value projections.

    Notes
    -----
    ``modules_to_save`` keeps the freshly-initialized classification head fully
    trainable (it is not adapted via LoRA, it is trained directly), which is
    required because the head does not exist in the pretrained checkpoint.
    """
    return LoraConfig(
        task_type=TaskType.SEQ_CLS,
        r=r,
        lora_alpha=lora_alpha,
        lora_dropout=lora_dropout,
        bias="none",
        target_modules=target_modules or DEFAULT_TARGET_MODULES,
        modules_to_save=["pre_classifier", "classifier"],
    )


def wrap_with_lora(model: PreTrainedModel, config: Optional[LoraConfig] = None):
    """Wrap a base classification model with LoRA adapters.

    Parameters
    ----------
    model:
        Base sequence-classification model.
    config:
        Optional :class:`peft.LoraConfig`. A sensible default is created when
        omitted.

    Returns
    -------
    peft.PeftModel
        The adapted model. Call ``.print_trainable_parameters()`` to inspect
        how few parameters are actually trained.
    """
    config = config or build_lora_config()
    return get_peft_model(model, config)
