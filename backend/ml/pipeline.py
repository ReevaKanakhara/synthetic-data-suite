"""
ml/pipeline.py — Image Generation Pipeline

Supports three modes:
  MOCK_MODE=true          → placeholder image (no GPU, instant)
  MODEL_BACKEND=local     → SD v1.5 local inference (GTX 1650)
  MODEL_BACKEND=replicate → SD 3.5 Large Cloud via Hugging Face Serverless API (~5s, photorealistic)

Quality boosters applied in all non-mock modes when QUALITY_BOOST=true:
  - Appends quality suffix to user prompt
  - Passes negative prompt to model
"""

from __future__ import annotations
import logging
import os
from typing import Callable, Optional
from PIL import Image, ImageDraw
from app.config import settings

logger = logging.getLogger(__name__)

_local_pipeline = None


# ---------------------------------------------------------------------------
# Prompt enhancement
# ---------------------------------------------------------------------------

def enhance_prompt(prompt: str) -> str:
    if not settings.quality_boost:
        return prompt
    return f"{prompt}, {settings.quality_suffix}"


# ---------------------------------------------------------------------------
# Mock mode
# ---------------------------------------------------------------------------

def _generate_mock_image(
    prompt: str,
    width:  int = 512,
    height: int = 512,
    step_callback: Optional[Callable[[int, int], None]] = None,
    total_steps:   int = 10,
) -> Image.Image:
    import time

    img  = Image.new("RGB", (width, height), color=(24, 24, 37))
    draw = ImageDraw.Draw(img)

    for x in range(0, width, 64):
        draw.line([(x, 0), (x, height)], fill=(40, 40, 60), width=1)
    for y in range(0, height, 64):
        draw.line([(0, y), (width, y)], fill=(40, 40, 60), width=1)

    draw.line([(0, 0),     (width, height)], fill=(50, 50, 80), width=2)
    draw.line([(width, 0), (0, height)],     fill=(50, 50, 80), width=2)

    padding = 60
    draw.rectangle(
        [padding, padding, width - padding, height - padding],
        outline=(137, 180, 250), width=2,
    )
    draw.text(
        (width // 2, padding + 24), "MOCK IMAGE",
        fill=(205, 214, 244), anchor="mm",
    )
    draw.text(
        (width // 2, height // 2), f'"{prompt[:55]}"',
        fill=(166, 173, 200), anchor="mm",
    )
    draw.text(
        (width // 2, height - padding - 12),
        f"{width} × {height} px  |  MOCK_MODE=true",
        fill=(108, 112, 134), anchor="mm",
    )

    if step_callback:
        for step in range(1, total_steps + 1):
            time.sleep(0.05)
            step_callback(step, total_steps)

    return img


# ---------------------------------------------------------------------------
# Local SD v1.5
# Fixed: uses .to(device) + enable_attention_slicing()
# instead of enable_sequential_cpu_offload() which requires accelerate
# ---------------------------------------------------------------------------

def _get_local_pipeline():
    global _local_pipeline
    if _local_pipeline is not None:
        return _local_pipeline

    import torch
    from diffusers import StableDiffusionPipeline

    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"[ML] Loading SD v1.5 on {device} (fp32)...")

    _local_pipeline = StableDiffusionPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        torch_dtype=torch.float32,
        safety_checker=None,
        requires_safety_checker=False,
        cache_dir=settings.hf_home or None,
    ).to(device)

    # attention_slicing reduces peak VRAM without needing accelerate
    _local_pipeline.enable_attention_slicing()

    logger.info(f"[ML] Local pipeline ready on {device}.")
    return _local_pipeline


def _generate_local(
    prompt:        str,
    width:         int,
    height:        int,
    step_callback: Optional[Callable[[int, int], None]] = None,
) -> Image.Image:
    TOTAL_STEPS = 30
    pipe        = _get_local_pipeline()

    import torch

    def diffusers_callback(
        pipeline, step: int, timestep: int, callback_kwargs: dict
    ) -> dict:
        if step_callback:
            step_callback(step + 1, TOTAL_STEPS)
        return callback_kwargs

    negative = settings.negative_prompt if settings.quality_boost else None

    with torch.inference_mode():
        result = pipe(
            prompt,
            negative_prompt=negative,
            width=width,
            height=height,
            num_inference_steps=TOTAL_STEPS,
            guidance_scale=7.5,
            callback_on_step_end=diffusers_callback,
        )
    return result.images[0]


# ---------------------------------------------------------------------------
# Free Hugging Face Inference API (FLUX.1-dev)
# ---------------------------------------------------------------------------

def _generate_replicate(
    prompt:        str,
    width:         int,
    height:        int,
    step_callback: Optional[Callable[[int, int], None]] = None,
) -> Image.Image:
    """
    Generates high-quality images via Hugging Face's Free Serverless Inference API.
    Bypasses Replicate billing entirely while routing through FLUX.1-dev.
    """
    import requests
    import io

    hf_token = os.getenv("HF_API_TOKEN") or getattr(settings, "hf_api_token", "")
    
    if not hf_token:
        raise ValueError(
            "HF_API_TOKEN not set in .env. "
            "Get a free token at huggingface.co/settings/tokens"
        )

    logger.info("[ML] Running FLUX.1-dev via Free Hugging Face API...")

    if step_callback:
        step_callback(1, 4)

    # Using the heavy-hitting, ultra-realistic 28-step flagship model
    API_URL = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev"
    headers = {
        "Authorization": f"Bearer {hf_token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "inputs": prompt,
        "parameters": {
            "width": width if width else 512,
            "height": height if height else 512
        }
    }

    response = requests.post(API_URL, headers=headers, json=payload)
    
    if response.status_code != 200:
        raise RuntimeError(f"HuggingFace API failed: {response.status_code} - {response.text}")

    if step_callback:
        step_callback(4, 4)

    img = Image.open(io.BytesIO(response.content)).convert("RGB")
    logger.info(f"[ML] Free cloud image fetched successfully: {img.size}")
    return img


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def generate_image(
    prompt:        str,
    width:         int = 512,
    height:         int = 512,
    step_callback: Optional[Callable[[int, int], None]] = None,
) -> tuple[Image.Image, int, int]:
    """
    Unified entry point called by the Celery task.

    Mode selection priority:
      1. MOCK_MODE=true          → mock image (instant)
      2. MODEL_BACKEND=replicate → FLUX.1-dev Cloud via Hugging Face API
      3. MODEL_BACKEND=local     → SD v1.5 local inference

    Quality boost applied automatically when QUALITY_BOOST=true.
    Returns: (PIL.Image, width_px, height_px)
    """
    if settings.mock_mode:
        logger.info(f"[ML] Mock mode for: '{prompt}'")
        img = _generate_mock_image(
            prompt, width, height,
            step_callback=step_callback,
        )

    elif settings.model_backend == "replicate":
        enhanced = enhance_prompt(prompt)
        logger.info(f"[ML] HF Cloud FLUX.1-dev for: '{enhanced}'")
        img = _generate_replicate(
            enhanced, width, height,
            step_callback=step_callback,
        )

    else:
        enhanced = enhance_prompt(prompt)
        logger.info(f"[ML] Local SD v1.5 for: '{enhanced}'")
        img = _generate_local(
            enhanced, width, height,
            step_callback=step_callback,
        )

    w, h = img.size
    logger.info(f"[ML] Generated: {w}×{h}px")
    return img, w, h