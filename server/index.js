/* server/index.js */
require('dotenv').config(); // load environment variables first
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
const PORT = process.env.PORT || 5000;

// 1) Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// 2) Import Models (User, etc.)
const User = require('./models/User');

// 3) Passport Configuration
passport.serializeUser((user, done) => {
  // store user id in session
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// 3.1) Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Access the user's email
      const email = profile.emails[0].value;
      // If we only want a specific domain, check here:
      const allowedDomain = process.env.ALLOWED_DOMAIN; // e.g. "andrew.cmu.edu" or "edu"
      const domainPart = email.split('@')[1]; // everything after '@'
      
      if (allowedDomain) {
        let domainAllowed = false;
        
        if (allowedDomain === 'edu') {
          // allow any .edu domain
          domainAllowed = domainPart.endsWith('.edu');
        } else {
          // allow just the specified domain
          domainAllowed = (domainPart === allowedDomain);
        }
        
        if (!domainAllowed) {
          return done(null, false, { message: "Email domain not allowed" });
        }
      }

      // domain is allowed, proceed:
      let user = await User.findOne({ email });
      if (!user) {
        // create new user
        user = new User({
          name: profile.displayName,
          email: email,
          googleId: profile.id,
          photo: profile.photos?.[0]?.value || '',
          isAdmin: false, // new users are not admin by default
        });
        await user.save();
      } else {
        // If user already exists, maybe update name/photo
        user.name = profile.displayName;
        user.photo = profile.photos?.[0]?.value || user.photo;
        user.googleId = profile.id;
        // If user is banned, block login
        if (user.banned) {
          return done(null, false, { message: "User is banned" });
        }
        await user.save();
      }
      // success
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// 4) Middlewares

// 4.1) CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// 4.2) Body parser
app.use(express.json());

// 4.3) Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'unithriftsecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: (process.env.NODE_ENV === 'production'), // use HTTPS in production
    sameSite: 'none', // needed for cross-domain
  },
}));

// 4.4) Passport init & session
app.use(passport.initialize());
app.use(passport.session());

// 5) Auth routes (Google OAuth)

// redirect to Google
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })
);

// Google callback
app.get('/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: process.env.CLIENT_URL + '/login',
    session: true
  }),
  (req, res) => {
    // successful login, redirect to client
    res.redirect(process.env.CLIENT_URL + '/');
  }
);

// logout
app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect(process.env.CLIENT_URL + '/');
  });
});

// get current user info
app.get('/api/auth/user', (req, res) => {
  if (req.isAuthenticated() && req.user) {
    return res.json(req.user);
  } else {
    return res.status(401).json({ message: 'Not logged in' });
  }
});

// 6) Auth middleware (ensureAuth, ensureAdmin)
const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
};

const ensureAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden (admin only)' });
};

// 7) Import routes
const listingsRouter = require('./routes/listings');
const usersRouter = require('./routes/users');
const messagesRouter = require('./routes/messages');
const reviewsRouter = require('./routes/reviews');
const adminRouter = require('./routes/admin');

app.use('/api/listings', listingsRouter(ensureAuth)); 
  // pass ensureAuth if you want the router file to use it or 
  // just import and use directly. 
  // If your route is set up to import ensureAuth from index, do that instead. 
  // For demonstration, I'm passing as a param, but you can do it however you prefer.

app.use('/api/users', usersRouter(ensureAuth));
app.use('/api/messages', messagesRouter(ensureAuth));
app.use('/api/reviews', reviewsRouter(ensureAuth));

// For admin routes, we ensureAuth and ensureAdmin:
app.use('/api/admin', ensureAuth, ensureAdmin, adminRouter);

// 8) Example Leaderboard endpoint
const Listing = require('./models/Listing');
const UserModel = require('./models/User');

app.get('/api/leaderboard', async (req, res) => {
  try {
    // top sellers
    const topSellersAgg = await Listing.aggregate([
      { $match: { sold: true } },
      { $group: { _id: "$seller", soldCount: { $sum: 1 } } },
      { $sort: { soldCount: -1 } },
      { $limit: 5 }
    ]);
    const topSellers = await UserModel.find({ _id: { $in: topSellersAgg.map(x => x._id) }});
    const topSellersOutput = topSellersAgg.map(s => {
      const user = topSellers.find(u => u._id.equals(s._id));
      return user ? { _id: user._id, name: user.name, itemsSold: s.soldCount } : null;
    }).filter(Boolean);

    // top buyers
    const topBuyersAgg = await Listing.aggregate([
      { $match: { sold: true, buyer: { $exists: true } } },
      { $group: { _id: "$buyer", boughtCount: { $sum: 1 } } },
      { $sort: { boughtCount: -1 } },
      { $limit: 5 }
    ]);
    const topBuyers = await UserModel.find({ _id: { $in: topBuyersAgg.map(x => x._id) }});
    const topBuyersOutput = topBuyersAgg.map(b => {
      const user = topBuyers.find(u => u._id.equals(b._id));
      return user ? { _id: user._id, name: user.name, itemsBought: b.boughtCount } : null;
    }).filter(Boolean);

    res.json({
      topSellers: topSellersOutput,
      topBuyers: topBuyersOutput,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// 9) Start server
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
