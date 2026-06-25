"""FastAPI inference service for the fine-tuned emotion classifier.

Loads a saved model directory (``MODEL_DIR``) once at startup and exposes:
    * ``GET  /health``  - liveness + which model is loaded
    * ``POST /predict`` - classify one or more texts

Run locally:
    uvicorn serve.api:app --reload --port 8000

Example request:
    curl -X POST http://localhost:8000/predict \
        -H "Content-Type: application/json" \
        -d '{"texts": ["i feel so happy today", "i am terrified of this"]}'
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import List

import torch
import torch.nn.functional as F
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer

load_dotenv()

MODEL_DIR = os.getenv("MODEL_DIR", "./artifacts/full_finetune")
MAX_SEQ_LENGTH = int(os.getenv("MAX_SEQ_LENGTH", 128))

# Holds the loaded artefacts; populated in the lifespan handler.
_state: dict = {}


def _device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load tokenizer + model on startup, release on shutdown."""
    device = _device()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR).to(device)
    model.eval()

    _state["tokenizer"] = tokenizer
    _state["model"] = model
    _state["device"] = device
    _state["id2label"] = model.config.id2label
    yield
    _state.clear()


app = FastAPI(
    title="Transformer Fine-Tuning Lab - Inference API",
    version="1.0.0",
    description="Emotion classification served from a fine-tuned DistilBERT.",
    lifespan=lifespan,
)


class PredictRequest(BaseModel):
    texts: List[str] = Field(
        ...,
        min_length=1,
        description="One or more raw text strings to classify.",
        examples=[["i feel so happy today", "i am terrified of this"]],
    )


class Prediction(BaseModel):
    text: str
    label: str
    confidence: float
    probabilities: dict


class PredictResponse(BaseModel):
    predictions: List[Prediction]


@app.get("/health")
def health() -> dict:
    """Return service status and the loaded model directory."""
    return {
        "status": "ok" if "model" in _state else "loading",
        "model_dir": MODEL_DIR,
        "device": str(_state.get("device", "cpu")),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest) -> PredictResponse:
    """Classify a batch of texts and return labels + probabilities."""
    if "model" not in _state:
        raise HTTPException(status_code=503, detail="Model not loaded yet.")

    tokenizer = _state["tokenizer"]
    model = _state["model"]
    device = _state["device"]
    id2label = _state["id2label"]

    enc = tokenizer(
        request.texts,
        truncation=True,
        padding=True,
        max_length=MAX_SEQ_LENGTH,
        return_tensors="pt",
    ).to(device)

    with torch.no_grad():
        logits = model(**enc).logits
        probs = F.softmax(logits, dim=-1).cpu().numpy()

    predictions = []
    for text, prob_row in zip(request.texts, probs):
        top_idx = int(prob_row.argmax())
        predictions.append(
            Prediction(
                text=text,
                label=id2label[top_idx],
                confidence=float(prob_row[top_idx]),
                probabilities={
                    id2label[i]: float(p) for i, p in enumerate(prob_row)
                },
            )
        )

    return PredictResponse(predictions=predictions)
