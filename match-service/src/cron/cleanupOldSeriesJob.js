// cron/cleanupOldSeries.js
const Series = require('../models/Series');
const Player = require('../models/Player');

const cleanupOldSeries = async () => {
  const now = new Date();
  const expiredSeries = await Series.find({ endDate: { $lt: now }, status: { $ne: 'completed' } });

  for (const series of expiredSeries) {
    await Player.deleteMany({ seriesId: series.seriesId });
    await Series.updateOne({ seriesId: series.seriesId }, { status: 'completed' });
  }
};

module.exports = cleanupOldSeries;
