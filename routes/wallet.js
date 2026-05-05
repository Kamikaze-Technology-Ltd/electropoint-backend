// routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const walletController = require('../controllers/walletController');

router.get('/', authenticate, walletController.getWallet);
router.get(
  '/transactions',
  authenticate,
  walletController.getWalletTransactions
);
router.post('/fund', authenticate, walletController.fundWallet);
router.post(
  '/confirm-funding',
  authenticate,
  walletController.confirmWalletFunding
);
router.post('/payment', authenticate, walletController.makePaymentWithWallet);

router.post('/simulate', authenticate, walletController.simulateTransfer)

module.exports = router;
