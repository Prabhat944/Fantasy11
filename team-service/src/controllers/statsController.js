const Team = require('../models/TeamSchema');
const redisClient = require('../utils/redisClient');

const getPlayerSelectionStats = async (matchId) => {
  const totalTeams = await Team.countDocuments({ matchId });

  const aggregation = await Team.aggregate([
    { $match: { matchId } },
    {
      $facet: {
        selected: [
          { $unwind: "$players" },
          { $group: { _id: "$players", count: { $sum: 1 } } }
        ],
        captains: [
          { $group: { _id: "$captain", count: { $sum: 1 } } }
        ],
        viceCaptains: [
          { $group: { _id: "$viceCaptain", count: { $sum: 1 } } }
        ]
      }
    },
    {
      $project: {
        stats: {
          $map: {
            input: "$selected",
            as: "player",
            in: {
              playerId: "$$player._id",
              selectionPercent: {
                $multiply: [
                  { $divide: ["$$player.count", totalTeams] },
                  100
                ]
              },
              captainPercent: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $ifNull: [
                          {
                            $let: {
                              vars: {
                                match: {
                                  $first: {
                                    $filter: {
                                      input: "$captains",
                                      as: "c",
                                      cond: { $eq: ["$$c._id", "$$player._id"] }
                                    }
                                  }
                                }
                              },
                              in: "$$match.count"
                            }
                          },
                          0
                        ]
                      },
                      totalTeams
                    ]
                  },
                  100
                ]
              },
              viceCaptainPercent: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $ifNull: [
                          {
                            $let: {
                              vars: {
                                match: {
                                  $first: {
                                    $filter: {
                                      input: "$viceCaptains",
                                      as: "vc",
                                      cond: { $eq: ["$$vc._id", "$$player._id"] }
                                    }
                                  }
                                }
                              },
                              in: "$$match.count"
                            }
                          },
                          0
                        ]
                      },
                      totalTeams
                    ]
                  },
                  100
                ]
              }
            }
          }
        }
      }
    }
  ]);

  const stats = aggregation[0].stats;
  console.log('Player stats:', stats);

  await redisClient.set(`stats:${matchId}`, JSON.stringify(stats), { EX: 300 });

  return stats;
};

module.exports = { getPlayerSelectionStats };
