from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite+aiosqlite:///./synthetic_data.db"

    # Celery / Redis
    redis_url: str = "redis://localhost:6379/0"

    # File storage
    uploads_dir: Path = Path("./uploads")

    # ML Engine
    mock_mode: bool = False

    # Model backend — "local" uses SD v1.5, "replicate" uses SDXL-Turbo API
    model_backend: str = "local"

    # Replicate API
    replicate_api_token: str = ""

    # Free Hugging Face Inference API Token
    hf_api_token: str = ""

    # HuggingFace cache
    hf_home: str = ""

    # Quality boosters
    quality_boost: bool = True
    negative_prompt: str = (
        "blurry, distorted, deformed, ugly, watermark, text, noise, "
        "duplicate, low quality, bad anatomy, extra limbs, cropped, "
        "worst quality"
    )
    quality_suffix: str = (
        "highly detailed, sharp focus, professional photography, "
        "8k resolution"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        protected_namespaces = ("settings_",)


settings = Settings()
settings.uploads_dir.mkdir(parents=True, exist_ok=True)