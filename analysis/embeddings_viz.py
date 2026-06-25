"""Extract [CLS] embeddings from a fine-tuned model and project them to 2D.

Pipeline:
    1. Run the encoder over a dataset split and collect the ``[CLS]`` token
       hidden state (768-d for DistilBERT base) for each example.
    2. Reduce to 2D with UMAP (default) or t-SNE.
    3. Optionally render a coloured scatter plot grouped by class label.

Run as a script:
    python -m analysis.embeddings_viz --model-dir ./artifacts/full_finetune
"""

from __future__ import annotations

import argparse
from typing import Optional, Tuple

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from data.dataset import EMOTION_LABELS, load_raw_dataset


def _device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


@torch.no_grad()
def extract_cls_embeddings(
    model_dir: str,
    split: str = "test",
    dataset_name: str = "emotion",
    max_samples: Optional[int] = 2000,
    max_seq_length: int = 128,
    batch_size: int = 32,
) -> Tuple[np.ndarray, np.ndarray]:
    """Extract the ``[CLS]`` hidden state for each example in a split.

    Returns
    -------
    (embeddings, labels)
        ``embeddings`` has shape ``(n_samples, hidden_size)`` and ``labels`` has
        shape ``(n_samples,)``.
    """
    device = _device()
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_dir, output_hidden_states=True
    ).to(device)
    model.eval()

    data = load_raw_dataset(dataset_name)[split]
    if max_samples is not None:
        data = data.select(range(min(max_samples, len(data))))

    texts = data["text"]
    labels = np.asarray(data["label"])

    embeddings = []
    for start in range(0, len(texts), batch_size):
        batch_texts = texts[start : start + batch_size]
        enc = tokenizer(
            batch_texts,
            truncation=True,
            padding=True,
            max_length=max_seq_length,
            return_tensors="pt",
        ).to(device)
        outputs = model(**enc)
        # Last hidden state, [CLS] is token position 0.
        last_hidden = outputs.hidden_states[-1]
        cls = last_hidden[:, 0, :].cpu().numpy()
        embeddings.append(cls)

    return np.concatenate(embeddings, axis=0), labels


def project_embeddings(
    embeddings: np.ndarray,
    method: str = "umap",
    seed: int = 42,
) -> np.ndarray:
    """Project high-dimensional embeddings to 2D.

    Parameters
    ----------
    method:
        ``"umap"`` (default) or ``"tsne"``.

    Returns
    -------
    np.ndarray
        Array of shape ``(n_samples, 2)``.
    """
    if method == "umap":
        import umap  # imported lazily to keep import cost optional

        reducer = umap.UMAP(n_components=2, random_state=seed, metric="cosine")
        return reducer.fit_transform(embeddings)

    if method == "tsne":
        from sklearn.manifold import TSNE

        reducer = TSNE(n_components=2, random_state=seed, init="pca")
        return reducer.fit_transform(embeddings)

    raise ValueError(f"Unknown projection method: {method!r}")


def plot_embeddings(
    coords: np.ndarray,
    labels: np.ndarray,
    title: str = "CLS embeddings (UMAP)",
    save_path: Optional[str] = None,
):
    """Render a 2D scatter plot coloured by class label."""
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(8, 6))
    for class_id, name in enumerate(EMOTION_LABELS):
        mask = labels == class_id
        ax.scatter(
            coords[mask, 0],
            coords[mask, 1],
            s=8,
            alpha=0.6,
            label=name,
        )
    ax.set_title(title)
    ax.set_xlabel("dim 1")
    ax.set_ylabel("dim 2")
    ax.legend(markerscale=2, fontsize=8, loc="best")
    fig.tight_layout()

    if save_path:
        fig.savefig(save_path, dpi=150)
    return fig


def main() -> None:  # pragma: no cover
    parser = argparse.ArgumentParser(description="Visualize [CLS] embeddings.")
    parser.add_argument("--model-dir", required=True, help="Path to fine-tuned model.")
    parser.add_argument("--split", default="test")
    parser.add_argument("--method", default="umap", choices=["umap", "tsne"])
    parser.add_argument("--max-samples", type=int, default=2000)
    parser.add_argument("--save-path", default="embeddings.png")
    args = parser.parse_args()

    emb, labels = extract_cls_embeddings(
        args.model_dir, split=args.split, max_samples=args.max_samples
    )
    print(f"Embeddings shape: {emb.shape}")
    coords = project_embeddings(emb, method=args.method)
    plot_embeddings(coords, labels, save_path=args.save_path)
    print(f"Saved plot to {args.save_path}")


if __name__ == "__main__":  # pragma: no cover
    main()
