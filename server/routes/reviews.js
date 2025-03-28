const router = require('express').Router();
const Review = require('../models/Review');
const User = require('../models/User');

// GET reviews for a user
router.get('/', async (req, res) => {
  try {
    const targetUserId = req.query.targetUser;
    if (!targetUserId) return res.status(400).json({ message: 'targetUser query param required' });
    const reviews = await Review.find({ targetUser: targetUserId }).populate('reviewer', 'name');
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new review (must be logged in)
router.post('/', ensureAuth, async (req, res) => {
  try {
    const { targetUser, rating, comment } = req.body;
    if (!targetUser || !rating) {
      return res.status(400).json({ message: 'targetUser and rating required' });
    }
    // Optionally, ensure that current user had a transaction with targetUser before allowing review (not implemented here).
    const review = new Review({
      reviewer: req.user._id,
      targetUser,
      rating,
      comment
    });
    const saved = await review.save();
    // Optionally, update target user's average rating (not implemented, but could be computed on the fly or stored).
    const populated = await Review.findById(saved._id).populate('reviewer', 'name');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
