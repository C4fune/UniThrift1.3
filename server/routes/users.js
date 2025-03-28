const router = require('express').Router();
const User = require('../models/User');
const Listing = require('../models/Listing');

// GET a user's public profile
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-googleId -__v');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update current user profile (logged in user only)
router.put('/me', ensureAuth, async (req, res) => {
  try {
    const { name, bio, photo, links } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (photo !== undefined) user.photo = photo;
    if (links !== undefined) user.links = links;
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET current user's favorites (or we can include favorites in /me)
router.get('/me/favorites', ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    res.json(user.favorites || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST add to favorites
router.post('/me/favorites/:listingId', ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const listingId = req.params.listingId;
    if (!user.favorites.includes(listingId)) {
      user.favorites.push(listingId);
      await user.save();
    }
    res.json({ message: 'Added to favorites' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE remove from favorites
router.delete('/me/favorites/:listingId', ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.favorites = user.favorites.filter(id => id.toString() !== req.params.listingId);
    await user.save();
    res.json({ message: 'Removed from favorites' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
