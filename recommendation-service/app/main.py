# app/main.py

from fastapi import FastAPI
from contextlib import asynccontextmanager
from .api import endpoints
from .core.models import load_model # Import the loader function

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code to run on startup
    print("Application startup...")
    load_model() # Load the ML model
    yield
    # Code to run on shutdown (if any)
    print("Application shutdown.")

# Create the FastAPI app instance with the lifespan manager
app = FastAPI(
    title="Fantasy App Recommendation Service",
    description="Provides AI-based player and contest recommendations.",
    version="1.0.0",
    lifespan=lifespan
)

# Include the API endpoints
app.include_router(endpoints.router, prefix="/api/v1", tags=["recommendations"])

@app.get("/")
def read_root():
    """A simple health check endpoint."""
    return {"status": "ok", "message": "Welcome to the Recommendation Service!"}