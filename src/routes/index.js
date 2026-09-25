const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const eventRoutes = require('./eventRoutes');

router.get('/', (req, res) => {
  res.redirect('/events');
});

router.use('/auth', authRoutes);
router.use('/events', eventRoutes);

module.exports = router;
