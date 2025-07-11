import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import pickle
from pathlib import Path

print("Starting model creation process...")

# --- 1. Create Dummy Data ---
# This mimics the data your model would be trained on.
data = {
    'weather_condition': [0, 1, 0, 1, 0, 1],  # 0: Sunny, 1: Cloudy
    'pitch_condition': [1, 0, 1, 0, 1, 0],   # 0: Dry, 1: Damp
    'historical_avg_points': [50, 65, 40, 50, 65, 40],
    'fantasy_points': [55, 60, 35, 48, 70, 42]
}
df = pd.DataFrame(data)

features = ['weather_condition', 'pitch_condition', 'historical_avg_points']
target = 'fantasy_points'

X = df[features]
y = df[target]

# --- 2. Initialize and Train the Model ---
model = RandomForestRegressor(n_estimators=10, random_state=42)
model.fit(X, y)
print("Model has been trained successfully.")

# --- 3. Save the Model to a File ---
# Ensure the 'models' directory exists
Path("models").mkdir(exist_ok=True)

# Define the file path for the saved model
MODEL_PATH = "models/player_performance_v1.pkl"

with open(MODEL_PATH, "wb") as f:
    pickle.dump(model, f)

print(f"Model saved successfully to: {MODEL_PATH}")