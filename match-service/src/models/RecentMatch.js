// models/RecentMatch.js

const mongoose = require('mongoose');

// A sub-schema specifically for the score of an inning
const scoreSchema = new mongoose.Schema({
    r: { type: Number, required: true },
    w: { type: Number, required: true },
    o: { type: Number, required: true },
    inning: { type: String, required: true }
}, { _id: false });

// The main schema for a recent or current match
const recentMatchSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    series_id: { type: String, index: true },
    name: { type: String, required: true },
    matchType: { type: String, required: true },
    status: { type: String, required: true },
    venue: { type: String },
    date: { type: Date }, 
    dateTimeGMT: { type: Date, required: true, index: true },
    teams: [{ type: String }],
    teamInfo: [{ name: String, shortname: String, img: String }],
    
    // The new 'score' array, using our sub-schema
    score: [scoreSchema], 

    fantasyEnabled: { type: Boolean },
    bbbEnabled: { type: Boolean },
    hasSquad: { type: Boolean },
    matchStarted: { type: Boolean },
    matchEnded: { type: Boolean }
}, {
    _id: false,
    timestamps: true 
});

const RecentMatch = mongoose.model('RecentMatch', recentMatchSchema);

module.exports = RecentMatch;