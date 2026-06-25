"""DistilBERT-based sequence-classification wrapper.

Provides a single factory function that returns a
:class:`~transformers.DistilBertForSequenceClassification` configured for the
emotion classification task, plus helpers to freeze the encoder (for the
"frozen feature-extractor" baseline) and to count trainable parameters.
"""

from __future__ import annotations

from typing import Dict, Optional

from transformers import AutoModelForSequenceClassification, PreTrainedModel

from data.dataset import EMOTION_LABELS


def build_classifier(
    model_name: str = "distilbert-base-uncased",
    num_labels: int = 6,
    id2label: Optional[Dict[int, str]] = None,
) -> PreTrainedModel:
    """Build a sequence-classification model with proper label mappings.

    Parameters
    ----------
    model_name:
        Backbone checkpoint to load.
    num_labels:
        Number of output classes.
    id2label:
        Optional explicit ``{id: label}`` mapping. Defaults to the emotion
        label set when ``num_labels == len(EMOTION_LABELS)``.

    Returns
    -------
    PreTrainedModel
        A classification model ready for fine-tuning.
    """
    if id2label is None and num_labels == len(EMOTION_LABELS):
        id2label = {i: name for i, name in enumerate(EMOTION_LABELS)}

    label2id = {v: k for k, v in id2label.items()} if id2label else None

    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=num_labels,
        id2label=id2label,
        label2id=label2id,
    )
    return model


def freeze_encoder(model: PreTrainedModel) -> PreTrainedModel:
    """Freeze the transformer backbone, leaving only the classifier head trainable.

    This implements the "frozen feature-extractor" baseline: the pretrained
    encoder weights are kept fixed and only the ``pre_classifier`` /
    ``classifier`` heads receive gradients.
    """
    # The DistilBERT encoder lives under the ``distilbert`` attribute.
    base = getattr(model, "distilbert", None)
    if base is None:
        # Generic fallback: freeze everything that is not the classifier head.
        for name, param in model.named_parameters():
            if "classifier" not in name:
                param.requires_grad = False
        return model

    for param in base.parameters():
        param.requires_grad = False
    return model


def count_parameters(model: PreTrainedModel) -> Dict[str, int]:
    """Return ``{'total': int, 'trainable': int}`` parameter counts."""
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return {"total": total, "trainable": trainable}
