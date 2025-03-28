const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  googleId: String,
  photo: String,       // URL to profile photo
  bio: String,
  links: String,      // e.g., personal website or social link
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],  // saved listings
  isAdmin: { type: Boolean, default: false },
  banned: { type: Boolean, default: false }
  // We could add fields like itemsSold, itemsBought, rating, etc.
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
