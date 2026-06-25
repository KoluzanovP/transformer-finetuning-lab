"""Dataset loading and tokenization for the text-classification task.

This module wraps the Hugging Face :mod:`datasets` library to load a sentiment /
emotion classification corpus, tokenize it with a transformer tokenizer, and
expose either ``DatasetDict`` objects (for the HF Trainer path) or PyTorch
``DataLoader`` objects (for the custom training loop).

The default corpus is the `emotion` dataset (Saravia et al., 2018): English
tweets labelled with one of six emotions. It ships with predefined
train / validation / test splits which we re-use directly.
"""

from __future__ import annotations

from typing import Dict, Tuple

import numpy as np
from datasets import DatasetDict, load_dataset
from torch.utils.data import DataLoader
from transformers import (
    AutoTokenizer,
    DataCollatorWithPadding,
    PreTrainedTokenizerBase,
)

# Canonical label order for the `emotion` dataset.
EMOTION_LABELS = ["sadness", "joy", "love", "anger", "fear", "surprise"]


def load_raw_dataset(dataset_name: str = "emotion") -> DatasetDict:
    """Load the raw (untokenized) dataset with train/validation/test splits.

    Parameters
    ----------
    dataset_name:
        Name of the dataset on the Hugging Face Hub.

    Returns
    -------
    DatasetDict
        Dictionary with ``train``, ``validation`` and ``test`` splits, each
        containing ``text`` and ``label`` columns.
    """
    raw = load_dataset(dataset_name)

    # Some dataset configs only expose train/test. Carve out a validation split
    # from the training data when one is missing so downstream code is uniform.
    if "validation" not in raw:
        split = raw["train"].train_test_split(test_size=0.1, seed=42)
        raw = DatasetDict(
            train=split["train"],
            validation=split["test"],
            test=raw["test"],
        )
    return raw


def get_tokenizer(model_name: str) -> PreTrainedTokenizerBase:
    """Return the fast tokenizer associated with ``model_name``."""
    return AutoTokenizer.from_pretrained(model_name)


def load_tokenized_dataset(
    model_name: str = "distilbert-base-uncased",
    dataset_name: str = "emotion",
    max_seq_length: int = 128,
) -> Tuple[DatasetDict, PreTrainedTokenizerBase]:
    """Load and tokenize the dataset.

    Parameters
    ----------
    model_name:
        Backbone whose tokenizer should be used.
    dataset_name:
        Dataset to load from the Hub.
    max_seq_length:
        Maximum number of tokens per example (longer examples are truncated).

    Returns
    -------
    (DatasetDict, tokenizer)
        Tokenized splits (with ``input_ids``, ``attention_mask`` and ``labels``)
        and the tokenizer used to produce them.
    """
    raw = load_raw_dataset(dataset_name)
    tokenizer = get_tokenizer(model_name)

    def _tokenize(batch: Dict) -> Dict:
        return tokenizer(
            batch["text"],
            truncation=True,
            max_length=max_seq_length,
        )

    tokenized = raw.map(_tokenize, batched=True, remove_columns=["text"])
    tokenized = tokenized.rename_column("label", "labels")
    tokenized.set_format(
        type="torch", columns=["input_ids", "attention_mask", "labels"]
    )
    return tokenized, tokenizer


def build_dataloaders(
    model_name: str = "distilbert-base-uncased",
    dataset_name: str = "emotion",
    max_seq_length: int = 128,
    batch_size: int = 32,
) -> Tuple[DataLoader, DataLoader, DataLoader, PreTrainedTokenizerBase]:
    """Build train / validation / test :class:`DataLoader` objects.

    Dynamic padding is handled by :class:`DataCollatorWithPadding`, so the
    tokenizer does not pad to a fixed length up-front (faster + less memory).

    Returns
    -------
    (train_loader, val_loader, test_loader, tokenizer)
    """
    tokenized, tokenizer = load_tokenized_dataset(
        model_name=model_name,
        dataset_name=dataset_name,
        max_seq_length=max_seq_length,
    )
    collator = DataCollatorWithPadding(tokenizer=tokenizer)

    train_loader = DataLoader(
        tokenized["train"],
        batch_size=batch_size,
        shuffle=True,
        collate_fn=collator,
    )
    val_loader = DataLoader(
        tokenized["validation"],
        batch_size=batch_size,
        shuffle=False,
        collate_fn=collator,
    )
    test_loader = DataLoader(
        tokenized["test"],
        batch_size=batch_size,
        shuffle=False,
        collate_fn=collator,
    )
    return train_loader, val_loader, test_loader, tokenizer


def class_distribution(dataset_split) -> Dict[str, int]:
    """Return a ``{label_name: count}`` mapping for a dataset split."""
    labels = np.asarray(dataset_split["label"])
    counts = np.bincount(labels, minlength=len(EMOTION_LABELS))
    return {name: int(c) for name, c in zip(EMOTION_LABELS, counts)}
