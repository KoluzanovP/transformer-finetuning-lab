"""Custom PyTorch training loop (no HF Trainer).

Demonstrates the mechanics that the Trainer hides: manual epoch iteration,
optimizer + linear-warmup scheduler stepping, gradient updates, periodic
evaluation, and TensorBoard logging. Supports the same ``frozen`` / ``full`` /
``lora`` strategies as :mod:`training.train_hf`.
"""

from __future__ import annotations

import os
from typing import Dict, Tuple

import numpy as np
import torch
from sklearn.metrics import accuracy_score, f1_score
from torch.optim import AdamW
from torch.utils.tensorboard import SummaryWriter
from transformers import get_linear_schedule_with_warmup, set_seed

from data.dataset import build_dataloaders
from models.classifier import build_classifier, count_parameters, freeze_encoder
from models.lora_config import build_lora_config, wrap_with_lora
from training.config import ExperimentConfig


def _device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _prepare_model(config: ExperimentConfig):
    model = build_classifier(
        model_name=config.data.model_name,
        num_labels=config.data.num_labels,
    )
    if config.mode == "frozen":
        model = freeze_encoder(model)
    elif config.mode == "lora":
        model = wrap_with_lora(
            model,
            build_lora_config(
                r=config.lora_r,
                lora_alpha=config.lora_alpha,
                lora_dropout=config.lora_dropout,
            ),
        )
    elif config.mode != "full":
        raise ValueError(f"Unknown mode: {config.mode!r}")
    return model


@torch.no_grad()
def evaluate(model, dataloader, device: torch.device) -> Dict[str, float]:
    """Evaluate ``model`` on ``dataloader``; return loss/accuracy/F1."""
    model.eval()
    losses, all_preds, all_labels = [], [], []
    for batch in dataloader:
        batch = {k: v.to(device) for k, v in batch.items()}
        outputs = model(**batch)
        losses.append(outputs.loss.item())
        preds = outputs.logits.argmax(dim=-1)
        all_preds.append(preds.cpu().numpy())
        all_labels.append(batch["labels"].cpu().numpy())

    preds = np.concatenate(all_preds)
    labels = np.concatenate(all_labels)
    return {
        "loss": float(np.mean(losses)),
        "accuracy": float(accuracy_score(labels, preds)),
        "f1_weighted": float(f1_score(labels, preds, average="weighted")),
    }


def train_with_custom_loop(config: ExperimentConfig) -> Dict:
    """Train with an explicit PyTorch loop.

    Returns
    -------
    dict
        ``{"mode", "params", "history", "val", "test", "model_dir"}`` where
        ``history`` is a list of per-epoch metric dicts.
    """
    set_seed(config.training.seed)
    device = _device()

    train_loader, val_loader, test_loader, tokenizer = build_dataloaders(
        model_name=config.data.model_name,
        dataset_name=config.data.dataset_name,
        max_seq_length=config.data.max_seq_length,
        batch_size=config.training.batch_size,
    )

    model = _prepare_model(config).to(device)
    params = count_parameters(model)

    optimizer = AdamW(
        [p for p in model.parameters() if p.requires_grad],
        lr=config.training.learning_rate,
        weight_decay=config.training.weight_decay,
    )

    num_training_steps = len(train_loader) * config.training.num_epochs
    num_warmup_steps = int(config.training.warmup_ratio * num_training_steps)
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=num_warmup_steps,
        num_training_steps=num_training_steps,
    )

    logging_dir = os.path.join(config.training.logging_dir, f"{config.run_name}-loop")
    writer = SummaryWriter(log_dir=logging_dir)

    history = []
    best_f1 = -1.0
    global_step = 0
    output_dir = os.path.join(config.training.output_dir, f"{config.mode}_loop")

    for epoch in range(1, config.training.num_epochs + 1):
        model.train()
        running_loss = 0.0
        for batch in train_loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            optimizer.zero_grad()
            outputs = model(**batch)
            loss = outputs.loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            scheduler.step()

            running_loss += loss.item()
            global_step += 1
            writer.add_scalar("train/loss_step", loss.item(), global_step)

        train_loss = running_loss / len(train_loader)
        val_metrics = evaluate(model, val_loader, device)

        writer.add_scalar("train/loss_epoch", train_loss, epoch)
        writer.add_scalar("val/accuracy", val_metrics["accuracy"], epoch)
        writer.add_scalar("val/f1_weighted", val_metrics["f1_weighted"], epoch)

        print(
            f"Epoch {epoch}/{config.training.num_epochs} - "
            f"train_loss: {train_loss:.4f} - "
            f"val_loss: {val_metrics['loss']:.4f} - "
            f"val_acc: {val_metrics['accuracy']:.4f} - "
            f"val_f1: {val_metrics['f1_weighted']:.4f}"
        )

        history.append(
            {
                "epoch": epoch,
                "train_loss": train_loss,
                "val_loss": val_metrics["loss"],
                "val_accuracy": val_metrics["accuracy"],
                "val_f1_weighted": val_metrics["f1_weighted"],
            }
        )

        # Keep the best checkpoint (simple manual "early stopping" signal).
        if val_metrics["f1_weighted"] > best_f1:
            best_f1 = val_metrics["f1_weighted"]
            os.makedirs(output_dir, exist_ok=True)
            model.save_pretrained(output_dir)
            tokenizer.save_pretrained(output_dir)

    test_metrics = evaluate(model, test_loader, device)
    writer.close()

    return {
        "mode": config.mode,
        "params": params,
        "history": history,
        "val": history[-1] if history else {},
        "test": test_metrics,
        "model_dir": output_dir,
    }


if __name__ == "__main__":  # pragma: no cover
    from dotenv import load_dotenv

    load_dotenv()
    result = train_with_custom_loop(ExperimentConfig(mode="full"))
    print("Test metrics:", result["test"])
