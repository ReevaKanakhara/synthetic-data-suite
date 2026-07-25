from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.api.routes import generate
from app.api.routes import gallery
from app.api.routes import autolabel
from app.api.routes import export
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="Synthetic Data Generation Suite",
    version="1.0.0",
    description="AI-powered image generation and annotation for CV datasets.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/uploads",
    StaticFiles(directory=str(settings.uploads_dir)),
    name="uploads",
)

app.include_router(generate.router)
app.include_router(gallery.router)
app.include_router(autolabel.router)
app.include_router(export.router)


@app.get("/health")
async def health():
    return {"status": "ok", "mock_mode": settings.mock_mode}