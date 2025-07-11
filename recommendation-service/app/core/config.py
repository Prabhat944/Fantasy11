from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Holds all the application settings.
    Reads from environment variables for security.
    """
    MATCH_SERVICE_URL: str = "http://localhost:8001/api/v1" # Example URL for match-service
    TEAM_SERVICE_URL: str = "http://localhost:8002/api/v1"  # Example URL for team-service

    class Config:
        env_file = ".env" # You can store sensitive URLs in a .env file

# Create a single instance to be used across the application
settings = Settings()