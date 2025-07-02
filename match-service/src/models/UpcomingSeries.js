// models/Series.js

const mongoose = require('mongoose');

const seriesSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    startDate: { type: Date },
    endDate: { type: String },
    
    // --- NEW FIELD ---
    // We will calculate and store a full Date object for the end date.
    // This makes it easy to find and delete series that are in the past.
    endDateTime: { type: Date, index: true }, // indexed for faster queries

    odi: { type: Number, default: 0 },
    t20: { type: Number, default: 0 },
    test: { type: Number, default: 0 },
    squads: { type: Number, default: 0 },
    matches: { type: Number, default: 0 }
}, {
    _id: false,
    timestamps: true 
});

const Series = mongoose.model('Series', seriesSchema);

module.exports = Series;