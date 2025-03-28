const router = require('express').Router();
const Message = require('../models/Message');
const User = require('../models/User');

// GET conversations list
router.get('/conversations', ensureAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    // Find all messages involving the user
    const messages = await Message.find({ 
      $or: [ { sender: userId }, { receiver: userId } ] 
    }).populate('sender receiver', 'name email');
    // Reduce messages to unique conversation partners
    const convMap = {};
    messages.forEach(msg => {
      const other = msg.sender._id.equals(userId) ? msg.receiver : msg.sender;
      if (!convMap[other._id]) {
        convMap[other._id] = { otherUser: other, lastMessage: msg };
      } else {
        // Update lastMessage if this msg is newer
        if (msg.createdAt > convMap[other._id].lastMessage.createdAt) {
          convMap[other._id].lastMessage = msg;
        }
      }
    });
    const conversations = Object.values(convMap);
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET messages with a specific user
router.get('/', ensureAuth, async (req, res) => {
  try {
    const otherUserId = req.query.with;
    if (!otherUserId) {
      return res.status(400).json({ message: '"with" query param (userId) is required' });
    }
    const userId = req.user._id;
    const msgs = await Message.find({ 
      $or: [
        { sender: userId, receiver: otherUserId }, 
        { sender: otherUserId, receiver: userId }
      ]
    }).sort('createdAt');
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new message
router.post('/', ensureAuth, async (req, res) => {
  try {
    const { to, content, listingId } = req.body;
    if (!to || !content) return res.status(400).json({ message: 'Recipient and content required' });
    const message = new Message({
      sender: req.user._id,
      receiver: to,
      content: content,
      listing: listingId || undefined
    });
    const saved = await message.save();
    // (Optional) Create a notification for the receiver
    // const Notification = require('../models/Notification');
    // await new Notification({ user: to, message: 'New message from ' + req.user.name, url: '/messages', read: false }).save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
