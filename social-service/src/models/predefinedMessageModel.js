const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const predefinedMessageSchema = new Schema({
    // The actual text of the message that will be displayed
    text: {
        type: String,
        required: true,
        trim: true,
    },
    // A category for the message, useful for grouping them in the UI
    type: {
        type: String,
        enum: ['GREETING', 'COMPLIMENT', 'TAUNT', 'GAMEPLAY'],
        default: 'GAMEPLAY',
    },
    // Allows you to control the display order on the front-end
    order: {
        type: Number,
        default: 0,
    },
    // A simple way to enable or disable a message without deleting it
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    }
});

const PredefinedMessage = mongoose.model('PredefinedMessage', predefinedMessageSchema);
module.exports = PredefinedMessage;