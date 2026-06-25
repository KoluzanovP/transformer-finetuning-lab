"""HuggingFace :class:`~transformers.Trainer` fine-tuning path.

Supports all three strategies (``frozen`` / ``full`` / ``lora``), computes
accuracy + macro/weighted F1, performs early stopping on validation F1, and
logs to TensorBoard (``logging_dir``).

Example
-------
>>> from training.config import ExperimentConfig
>>> from training.train_hf import train_with_hf_trainer
>>> result = train_with_hf_trainer(ExperimentConfig(mode="lora"))
>>> print(result["eval"]["eval_accuracy"])
"""

from __future__ import annotations

import os
from typing import Dict

import numpy as np
from sklearn.metrics import accuracy_score, f1_score
from transformers import (
    DataCollatorWithPadding,
    EarlyStoppingCallback,
    Trainer,
    TrainingArguments,
    set_seed,
)

from data.dataset import get_tokenizer, load_tokenized_dataset
from models.classifier import build_classifier, count_parameters, freeze_encoder
from models.lora_config import build_lora_config, wrap_with_lora
from training.config import ExperimentConfig


def compute_metrics(eval_pred) -> Dict[str, float]:
    """Compute accuracy and F1 from a Trainer ``EvalPrediction``."""
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {
        "accuracy": accuracy_score(labels, preds),
        "f1_macro": f1_score(labels, preds, average="macro"),
        "f1_weighted": f1_score(labels, preds, average="weighted"),
    }


def _prepare_model(config: ExperimentConfig):
    """Instantiate the model according to ``config.mode``."""
    model = build_classifier(
        model_name=config.data.model_name,
        num_labels=config.data.num_labels,
    )

    if config.mode == "frozen":
        model = freeze_encoder(model)
    elif config.mode == "lora":
        lora_cfg = build_lora_config(
            r=config.lora_r,
            lora_alpha=config.lora_alpha,
            lora_dropout=config.lora_dropout,
        )
        model = wrap_with_lora(model, lora_cfg)
    elif config.mode != "full":
        raise ValueError(f"Unknown mode: {config.mode!r}")

    return model


def train_with_hf_trainer(config: ExperimentConfig) -> Dict:
    """Run a full training + evaluation cycle with the HF Trainer.

    Returns
    -------
    dict
        ``{"mode", "params", "eval", "test", "model_dir"}``.
    """
    set_seed(config.training.seed)

    tokenized, _ = load_tokenized_dataset(
        model_name=config.data.model_name,
        dataset_name=config.data.dataset_name,
        max_seq_length=config.data.max_seq_length,
    )
    tokenizer = get_tokenizer(config.data.model_name)
    collator = DataCollatorWithPadding(tokenizer=tokenizer)

    model = _prepare_model(config)
    params = count_parameters(model)

    output_dir = os.path.join(config.training.output_dir, f"{config.mode}_finetune")
    logging_dir = os.path.join(config.training.logging_dir, config.run_name)

    args = TrainingArguments(
        output_dir=output_dir,
        logging_dir=logging_dir,
        run_name=config.run_name,
        num_train_epochs=config.training.num_epochs,
        per_device_train_batch_size=config.training.batch_size,
        per_device_eval_batch_size=config.training.batch_size,
        learning_rate=config.training.learning_rate,
        weight_decay=config.training.weight_decay,
        warmup_ratio=config.training.warmup_ratio,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="steps",
        logging_steps=50,
        load_best_model_at_end=True,
        metric_for_best_model="f1_weighted",
        greater_is_better=True,
        report_to=["tensorboard"],
        seed=config.training.seed,
    )

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        tokenizer=tokenizer,
        data_collator=collator,
        compute_metrics=compute_metrics,
        callbacks=[
            EarlyStoppingCallback(
                early_stopping_patience=config.training.early_stopping_patience
            )
        ],
    )

    trainer.train()
    eval_metrics = trainer.evaluate(tokenized["validation"])
    test_metrics = trainer.evaluate(tokenized["test"], metric_key_prefix="test")

    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)

    return {
        "mode": config.mode,
        "params": params,
        "eval": eval_metrics,
        "test": test_metrics,
        "model_dir": output_dir,
    }
