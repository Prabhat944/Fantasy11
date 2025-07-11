import httpx
from ..core.config import settings

async def get_match_data(match_id: int) -> dict:
    """Fetches match conditions (weather, pitch) from the match-service."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{settings.MATCH_SERVICE_URL}/matches/{match_id}")
            response.raise_for_status() # Raises an exception for 4XX/5XX responses
            return response.json()
        except httpx.RequestError as e:
            # Handle connection errors, etc.
            print(f"An error occurred while requesting match data: {e}")
            return {}

async def get_player_stats(player_id: int) -> dict:
    """Fetches historical stats for a player from the team-service."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{settings.TEAM_SERVICE_URL}/players/{player_id}/stats")
            response.raise_for_status()
            return response.json()
        except httpx.RequestError as e:
            print(f"An error occurred while requesting player stats: {e}")
            return {}