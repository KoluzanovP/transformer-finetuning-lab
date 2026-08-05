# Transformer Fine-Tuning Lab

Fine-tunes [DistilBERT](https://huggingface.co/distilbert-base-uncased) on the
[`emotion`](https://huggingface.co/datasets/emotion) dataset (6-way emotion classification
of English tweets) and compares three strategies:

1. Frozen encoder: train only the classification head (linear probe).
2. Full fine-tuning: update every model parameter.
3. LoRA: parameter-efficient fine-tuning with low-rank adapters (PEFT).

The repo ships two training paths, a Hugging Face `Trainer` and a hand-written PyTorch
loop, so the same experiment can be run either way. There is also experiment tracking,
embedding visualization and a FastAPI inference service.

## Architecture

```
                         ┌────────────────────────┐
                         │   data/dataset.py      │
                         │  load + tokenize        │
                         │  (HF `datasets`)        │
                         └───────────┬────────────┘
                                     │ DatasetDict / DataLoaders
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                       ▼
   ┌──────────────────┐  ┌────────────────────┐  ┌────────────────────┐
   │ models/          │  │ training/train_hf  │  │ training/train_loop│
   │ classifier.py    │─▶│  HF Trainer        │  │  custom PyTorch    │
   │ lora_config.py   │  │  (early stopping,  │  │  loop (manual      │
   │ (DistilBERT+LoRA)│  │   TensorBoard)     │  │  optim/scheduler)  │
   └──────────────────┘  └─────────┬──────────┘  └─────────┬──────────┘
                                    │  saved model dir       │
                                    ▼                        ▼
              ┌──────────────────────────────┐  ┌────────────────────┐
              │ analysis/embeddings_viz.py   │  │ serve/api.py       │
              │ [CLS] embeddings → UMAP/t-SNE│  │ FastAPI /predict   │
              └──────────────────────────────┘  └────────────────────┘

         scripts/run_experiment.py  ──▶ orchestrates frozen / full / LoRA
```

### Repository layout

```
transformer-finetuning-lab/
├── data/dataset.py            # load + tokenize, train/val/test splits
├── models/classifier.py       # DistilBERT classifier wrapper + freezing
├── models/lora_config.py      # PEFT LoRA config + wrapping
├── training/config.py         # dataclass configs (env-overridable)
├── training/train_hf.py       # HuggingFace Trainer path
├── training/train_loop.py     # custom PyTorch training loop
├── analysis/embeddings_viz.py # [CLS] embedding extraction + 2D projection
├── serve/api.py               # FastAPI inference service
├── scripts/run_experiment.py  # CLI comparing the 3 approaches
└── notebooks/                 # executed example notebooks
```

## Results

`distilbert-base-uncased` on the `emotion` dataset (16k train / 2k validation / 2k test),
3 epochs, batch size 32, learning rate 2e-5, seed 42. Metrics are on the test split.

| Approach          | Trainable params | Total params | Test Accuracy | Test F1 (weighted) |
|-------------------|-----------------:|-------------:|--------------:|-------------------:|
| Frozen encoder    | 0.60M            | 67.0M        | 0.782         | 0.771              |
| Full fine-tune    | 67.0M            | 67.0M        | 0.912         | 0.910              |
| LoRA (r=8)        | 0.74M            | 67.7M        | 0.903         | 0.901              |

Full fine-tuning wins on accuracy, but it updates all 67M parameters. LoRA lands about a
point below it while training 0.74M parameters, roughly 1.1% of the model, which is the
better trade-off in most situations. The linear probe trails by about 13 points, so
adapting the encoder does matter on this task.

Per-class performance (full fine-tuning, test split):

```
              precision    recall  f1-score   support

     sadness       0.94      0.95      0.94       581
         joy       0.93      0.94      0.93       695
        love       0.79      0.74      0.76       159
       anger       0.91      0.89      0.90       275
        fear       0.86      0.84      0.85       224
    surprise       0.68      0.65      0.67        66

    accuracy                           0.91      2000
   macro avg       0.85      0.84      0.84      2000
weighted avg       0.91      0.91      0.91      2000
```

The rare classes (`love`, `surprise`) are the hardest, which matches their low support.
The same imbalance is visible in the embedding plot
(`notebooks/02_embedding_analysis.ipynb`).

## Setup

```bash
# 0. Clone the repository
git clone https://github.com/KoluzanovP/transformer-finetuning-lab.git
cd transformer-finetuning-lab

# 1. Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux / macOS

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
copy .env.example .env          # Windows
# cp .env.example .env          # Linux / macOS
```

## Usage

### Compare all three strategies

```bash
# HuggingFace Trainer backend
python scripts/run_experiment.py --backend hf

# Custom PyTorch loop backend, single mode
python scripts/run_experiment.py --backend loop --modes lora --out results.json
```

### Train a single strategy programmatically

```python
from training.config import ExperimentConfig
from training.train_hf import train_with_hf_trainer

result = train_with_hf_trainer(ExperimentConfig(mode="lora"))
print(result["test"])
```

### Track experiments with TensorBoard

```bash
tensorboard --logdir runs
```

### Visualize embeddings

```bash
python -m analysis.embeddings_viz --model-dir ./artifacts/full_finetune --method umap
```

### Serve the model

```bash
uvicorn serve.api:app --host 0.0.0.0 --port 8000

curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"texts": ["i feel so happy today", "i am terrified of this"]}'
```

### Docker

```bash
docker build -t finetuning-lab .
docker run -p 8000:8000 -e MODEL_DIR=/app/artifacts/full_finetune finetuning-lab
```

## Notebooks

`notebooks/01_finetune_and_eval.ipynb` loads and tokenizes the data, trains, and shows the
per-epoch progression, the final `classification_report` and the three-way comparison
table.

`notebooks/02_embedding_analysis.ipynb` extracts `[CLS]` embeddings and projects them to 2D
with UMAP to inspect class separation.

## License

MIT. Educational / portfolio use.
