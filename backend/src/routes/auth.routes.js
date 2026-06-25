const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/auth.controller');
const verifyToken = require('../middleware/verifyToken');

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, getMe); // Protected — test your token here

module.exports = router;