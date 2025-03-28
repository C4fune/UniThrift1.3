const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }  // optional context (which listing this is about)
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
