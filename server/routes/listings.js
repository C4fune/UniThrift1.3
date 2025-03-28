const router = require('express').Router();
const Listing = require('../models/Listing');
const User = require('../models/User');

// GET all listings (with optional filters: category, minPrice, maxPrice, condition, seller, etc.)
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.query.category) query.category = req.query.category;
    if (req.query.minPrice) query.price = { ...query.price, $gte: +req.query.minPrice };
    if (req.query.maxPrice) query.price = { ...query.price, $lte: +req.query.maxPrice };
    if (req.query.condition) query.condition = req.query.condition;
    if (req.query.seller) query.seller = req.query.seller;
    if (req.query.search) {
      // Basic text search on title or description
      query.title = { $regex: req.query.search, $options: 'i' };
    }
    let listings = await Listing.find(query).populate('seller', 'name email');
    // Sort and limit if specified
    if (req.query.sort === 'createdAt_desc') {
      listings = listings.sort((a, b) => b.createdAt - a.createdAt);
    }
    if (req.query.limit) {
      listings = listings.slice(0, +req.query.limit);
    }
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET one listing by ID
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate('seller', 'name email');
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create a new listing (protected)
router.post('/', ensureAuth, async (req, res) => {
  try {
    const data = req.body;
    data.seller = req.user._id;  // the logged-in user's ID
    const listing = new Listing(data);
    const saved = await listing.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update a listing (protected, only seller or admin)
router.put('/:id', ensureAuth, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.seller.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    // Update allowed fields:
    const { title, description, price, category, condition, imageUrl } = req.body;
    Object.assign(listing, { title, description, price, category, condition, imageUrl });
    const saved = await listing.save();
    res.json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a listing (protected, only seller or admin)
router.delete('/:id', ensureAuth, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.seller.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await listing.remove();
    res.json({ message: 'Listing removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
