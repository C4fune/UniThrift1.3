const router = require('express').Router();
const User = require('../models/User');
const Listing = require('../models/Listing');
const Report = require('../models/Report');

// This router will be mounted at /api/admin and already behind ensureAuth & ensureAdmin in main file.

router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-googleId -__v');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/listings', async (req, res) => {
  try {
    const listings = await Listing.find().populate('seller', 'name email');
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Ban or unban a user
router.put('/users/:id/ban', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.banned = req.body.banned === true;
    await user.save();
    res.json({ message: user.banned ? 'User banned' : 'User unbanned' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Feature or unfeature a listing
router.put('/listings/:id/feature', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    listing.isFeatured = req.body.featured === true;
    await listing.save();
    res.json({ message: listing.isFeatured ? 'Listing featured' : 'Listing unfeatured' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all reports
router.get('/reports', async (req, res) => {
  try {
    const reports = await Report.find().populate('reporter reportedUser reportedListing', 'email title');
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a report (non-admin, but could be here or separate)
router.post('/reports', ensureAuth, async (req, res) => {
  try {
    const { reportedUser, reportedListing, description } = req.body;
    if (!description || (!reportedUser && !reportedListing)) {
      return res.status(400).json({ message: 'Report must include description and a target.' });
    }
    const report = new Report({
      reporter: req.user._id,
      reportedUser: reportedUser || undefined,
      reportedListing: reportedListing || undefined,
      description,
      type: reportedUser ? 'User' : 'Listing'
    });
    const saved = await report.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Resolve a report (mark as addressed or delete)
router.put('/reports/:id/resolve', async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report resolved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
