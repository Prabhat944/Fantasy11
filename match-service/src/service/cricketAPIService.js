const axios = require('axios');

const API_KEY = process.env.CRICKETDATA_API_KEY;

const BASE_URL = 'https://api.cricapi.com/v1';

exports.upcomingSeriesList = async () => {
  const response = await axios.get(`${BASE_URL}/series`, {
    params: {
      apikey: API_KEY,
      offset: 0,
    },
  });
  console.log('Upcoming Matches:', response.data);
  return response.data.data;
};

exports.getSeriesById = async (matchId) => {
  console.log('matchId', matchId);
  const response = await axios.get(`${BASE_URL}/series_info`, {
    params: {
      apikey: API_KEY,
      id: matchId
    },
  });
  return response.data;
};

exports.matchSquad = async (id) => {
  const response = await axios.get(`${BASE_URL}/match_squad`, {
    params: {
      apikey: API_KEY,
      id:id
    },
  });
  console.log('Match Squad:', response.data);
  return response.data;
};

exports.recentMatchesList = async () => {
  const response = await axios.get(`${BASE_URL}/currentMatches`, {
    params: {
      apikey: API_KEY,
      offset: 0,
    },
  });
  console.log('responseData', response.data);
  return response.data;
};

exports.matchUpdateBallByBall = async (matchId) => {
  console.log('Fetching Ball by Ball data for match:', matchId);
  const response = await axios.get(`${BASE_URL}/match_bbb`, {
    params: {
      apikey: API_KEY,
      id: matchId,
    },
  });
  console.log('Ball by Ball Responsedata:', response);
  console.log('Ball by Ball data:', response.data);
  return response.data;
};

exports.recentMatchUpdatedScoreCard = async (matchId) => {
  console.log('Fetching recent match updated scorecard for match:', matchId);
  const response = await axios.get(`${BASE_URL}/match_scorecard`, {
    params: {
      apikey: API_KEY,
      id: matchId,
    },
  });
  console.log('Recent Match Updated Scorecard:', response.data);
  return response.data;
}

exports.getMatchById = async (matchId) => {
  const response = await axios.get(`${BASE_URL}/match_info`, {
params: {
apikey: API_KEY,
      id: matchId
},
});
return response.data;
};