// models/Squad.js

const mongoose = require('mongoose');

// Sub-schema for a single player
const playerSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    
    // --- NEWLY ADDED FIELD ---
    // This will store the name of the team the player belongs to for this specific match.
    teamName: { type: String },

    role: { type: String },
    battingStyle: { type: String },
    bowlingStyle: { type: String },
    country: { type: String },
    playerImg: { type: String }
}, { 
    _id: false 
});

// Sub-schema for a single team within the squad
const teamSquadSchema = new mongoose.Schema({
    teamName: { type: String, required: true },
    shortname: { type: String },
    img: { type: String },
    players: [playerSchema]
}, { _id: false });

// Main schema for the entire match squad
const squadSchema = new mongoose.Schema({
    _id: { type: String, required: true }, 
    squad: [teamSquadSchema] 
}, {
    _id: false,
    timestamps: true
});

const Squad = mongoose.model('Squad', squadSchema);

module.exports = Squad;
