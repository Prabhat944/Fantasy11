# app/core/models.py

import pickle
import pandas as pd
from pathlib import Path

# --- Global variable for the model ---
model = None
MODEL_PATH = Path(__file__).parent.parent.parent / "models/player_performance_v1.pkl"

def load_model():
    """Loads the model from the .pkl file into the global 'model' variable."""
    global model
    if model is None: # Only load it if it hasn't been loaded yet
        print("Loading ML model for the first time...")
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        print("ML model loaded successfully.")

def predict_player_performance(player_data: dict, match_data: dict) -> float:
    """Predicts a player's fantasy score."""
    if model is None:
        raise RuntimeError("Model is not loaded. Call 'load_model()' first.")

    feature_data = {
        'weather_condition': [match_data.get('weather_condition', 0)],
        'pitch_condition': [match_data.get('pitch_condition', 0)],
        'historical_avg_points': [player_data.get('historical_avg_points', 40)]
    }
    input_df = pd.DataFrame(feature_data)
    prediction = model.predict(input_df)
    return float(prediction[0])