// models/Match.js - NO CHANGES NEEDED

const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seriesId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    matchType: { 
        type: String, 
        enum: ['t20', 'odi', 'test'],
        required: true 
    },
    status: { type: String, required: true },
    venue: { type: String },
    date: { type: Date }, 
    dateTimeGMT: { type: Date, required: true, index: true },
    teams: [{ type: String }],
    teamInfo: [{
      name: { type: String },
      shortname: { type: String },
      img: { type: String }
    }],
    fantasyEnabled: { type: Boolean, default: false },
    bbbEnabled: { type: Boolean, default: false },
    hasSquad: { type: Boolean, default: false },
    matchStarted: { type: Boolean, default: false },
    matchEnded: { type: Boolean, default: false }
}, {
    _id: false,
    timestamps: true 
});

const Match = mongoose.model('UpcomingMatch', matchSchema);

module.exports = Match;