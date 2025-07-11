from fastapi import APIRouter, HTTPException, Query
from ..core import models
from ..services import data_fetcher
from typing import List

router = APIRouter()

@router.get("/recommend-players/")
async def recommend_players(match_id: int, player_ids: List[int] = Query(...)):
    """
    Recommends the best players from a given list for a specific match.
    
    - **match_id**: The ID of the upcoming match.
    - **player_ids**: A list of player IDs to get recommendations for.
    """
    # 1. Fetch match conditions
    match_data = await data_fetcher.get_match_data(match_id)
    if not match_data:
        raise HTTPException(status_code=404, detail=f"Match with ID {match_id} not found.")

    recommendations = []
    
    # 2. Loop through each player, get their stats, and make a prediction
    for player_id in player_ids:
        player_stats = await data_fetcher.get_player_stats(player_id)
        if not player_stats:
            continue # Skip if we can't get stats for a player

        try:
            predicted_score = models.predict_player_performance(player_stats, match_data)
            recommendations.append({
                "player_id": player_id,
                "predicted_score": round(predicted_score, 2)
            })
        except RuntimeError as e:
            raise HTTPException(status_code=500, detail=str(e))

    # 3. Sort players by their predicted score in descending order
    recommendations.sort(key=lambda x: x['predicted_score'], reverse=True)
    
    return {"recommendations": recommendations}