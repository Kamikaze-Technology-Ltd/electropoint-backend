// controllers/walletController.js
const pool = require('../config/database');
const axios = require('axios');
const { paymentAPI } = require('../services/paymentService');

const BASE_URL = process.env.BACKEND_URL;

// Get wallet balance
const getWallet = async (req, res) => {
  try {
    const [wallets] = await pool.execute(
      `SELECT w.*, 
        (SELECT COUNT(*) FROM wallet_transactions wt WHERE wt.wallet_id = w.id) as transaction_count
       FROM wallets w 
       WHERE w.user_id = ?`,
      [req.user.id]
    );

    const [transactions] = await pool.execute(
      `SELECT
      wt.id,
      wt.wallet_id,
      wt.type,
      pp.amount,
      wt.balance_after,
      pp.type AS payment_type,
      pp.description,
      pp.wallet_ref AS reference,
      pp.status,
      JSON_OBJECT('payment_method', 'transfer', 'user_id', u.id) AS metadata,
      wt.created_at,
      pp.transaction_ref,
      pp.id AS transaction_id
   FROM users u
   JOIN payment_payments pp ON pp.email = u.email
   LEFT JOIN wallet_transactions wt 
        ON wt.reference = pp.wallet_ref
   WHERE u.id = ?
   ORDER BY wt.created_at DESC`,
      [req.user.id]
    );
    let value = 0
    transactions.forEach((item) => {
      if (item.status === 'success' && item.payment_type === 'credit') {
        value += parseFloat(item.amount)

      }
    })

    transactions.forEach((item) => {
      if (item.status === 'success' && item.payment_type === 'debit') {
        value -= parseFloat(item.amount)

      }
    })

    if (wallets.length === 0) {
      // Create wallet if it doesn't exist
      const [result] = await pool.execute(
        'INSERT INTO wallets (user_id) VALUES (?)',
        [req.user.id]
      );

      const [newWallets] = await pool.execute(
        'SELECT * FROM wallets WHERE id = ?',
        [result.insertId]
      );
      return res.json(newWallets[0]);
    }

    const walletResponse = {
      id: wallets[0].id,
      user_id: wallets[0].id,
      balance: value,
      currency: "NGN",
      created_at: wallets[0].created_at,
      updated_at: wallets[0].updated_at,
      transaction_count: wallets[0].transaction_count
    }

    res.json(walletResponse);
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get wallet transactions
const getWalletTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [transactions] = await pool.execute(
      `SELECT
      wt.id,
      wt.wallet_id,
      wt.type,
      pp.amount,
      wt.balance_after,
      pp.description,
      pp.wallet_ref AS reference,
      pp.type AS payment_type,
      pp.status,
      JSON_OBJECT('payment_method', 'transfer', 'user_id', u.id) AS metadata,
      wt.created_at,
      pp.transaction_ref,
      pp.id AS transaction_id
   FROM users u
   JOIN payment_payments pp ON pp.email = u.email
   LEFT JOIN wallet_transactions wt 
        ON wt.reference = pp.wallet_ref
   WHERE u.id = ?
   ORDER BY wt.created_at DESC
   LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(limit), offset]
    );

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM wallet_transactions wt
       JOIN wallets w ON wt.wallet_id = w.id
       WHERE w.user_id = ?`,
      [req.user.id]
    );

    res.json({
      transactions,
      total: countRows[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countRows[0].total / limit),
    });
  } catch (error) {
    console.error('Get wallet transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Initiate wallet funding
const fundWallet = async (req, res) => {
  try {
    const { amount, payment_method = 'card' } = req.body;
    const user_id = req.user.id;

    if (amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    // Get or create wallet
    const [wallets] = await pool.execute(
      'SELECT * FROM wallets WHERE user_id = ?',
      [user_id]
    );

    let wallet;
    if (wallets.length === 0) {
      const [result] = await pool.execute(
        'INSERT INTO wallets (user_id) VALUES (?)',
        [user_id]
      );
      const [newWallets] = await pool.execute(
        'SELECT * FROM wallets WHERE id = ?',
        [result.insertId]
      );
      wallet = newWallets[0];
    } else {
      wallet = wallets[0];
    }

    // Create transaction reference
    const reference = `WAL${Date.now()} ${Math.random().toString(36).substr(2, 9)}`;

    // Create pending transaction
    const [txResult] = await pool.execute(
      `INSERT INTO wallet_transactions 
       (wallet_id, type, amount, balance_after, description, reference, status, metadata) 
       VALUES (?, 'deposit', ?, ?, ?, ?, 'pending', ?)`,
      [
        wallet.id,
        amount,
        parseFloat(wallet.balance) + parseFloat(amount),
        `Wallet funding - ${payment_method}`,
        reference,
        JSON.stringify({ payment_method, user_id }),
      ]
    );

    // Integrate with payment gateway
    const paymentData = {
      amount: parseFloat(amount), // Convert to kobo
      email: req.user.email,
      customer_name: `${req.user.first_name} ${req.user.last_name}`,
      currency: 'NGN',
      description: `Wallet funding  ${reference}`,
      callback_url: `${process.env.FRONTEND_URL}/wallet/fund`,
      meta: {
        transaction_ref: reference,
        type: 'wallet_funding',
      },
      wallet_ref: reference
    };

    // Use the payment API you provided
    let paymentResponse;
    if (payment_method === 'transfer') {
      paymentResponse = await axios.post(
        `${BASE_URL}/api/v1/initiate-bank-transfer/`,
        paymentData
      );
      console.log('Response is here: ', paymentResponse)
      res.status(200).json({
        success: true,
        data: paymentResponse.data.data
      })
    } else {
      paymentResponse = await axios.post(
        `${BASE_URL}/api/v1/initiate-payment/`,
        paymentData
      );
      res.status(200).json({
        success: true,
        data: paymentResponse.data.data
      })
    }

    if (paymentResponse.data.statusCode === '200') {
      console.log('Pamynet Success')
      res.json({
        success: true,
        message: 'Payment initiated',
        data: {
          reference,
          payment_url: paymentResponse.data.data.url,
          transaction_ref: paymentResponse.data.data.transactionRef,
        },
      });
    }
  } catch (error) {
    console.error('Fund wallet error:', error);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || 'Failed to initiate payment',
    });
  }
};

// Confirm payment and update wallet
const confirmWalletFunding = async (req, res) => {
  try {
    const { transaction_ref, transaction_id } = req.body;

    // Verify payment with payment gateway
    const verificationResponse = await axios.post(
      'https://makafrik-backend.onrender.com/api/v1/confirm-payment/',
      { transaction_ref, transaction_id }
    );

    if (verificationResponse.data.status === 'success') {
      // Get transaction
      const [transactions] = await pool.execute(
        `SELECT wt.*, w.user_id, w.balance 
         FROM wallet_transactions wt
         JOIN wallets w ON wt.wallet_id = w.id
         WHERE wt.reference = ? AND wt.status = 'pending'`,
        [transaction_ref]
      );

      if (transactions.length === 0) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      const transaction = transactions[0];
      const newBalance = parseFloat(transaction.balance_after);

      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // Update wallet balance
        await connection.execute(
          'UPDATE wallets SET balance = ? WHERE id = ?',
          [newBalance, transaction.wallet_id]
        );

        // Update transaction status
        await connection.execute(
          'UPDATE wallet_transactions SET status = "completed" WHERE id = ?',
          [transaction.id]
        );

        await connection.commit();

        res.json({
          success: true,
          message: 'Wallet funded successfully',
          data: {
            new_balance: newBalance,
            amount: transaction.amount,
          },
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment verification failed',
      });
    }
  } catch (error) {
    console.error('Confirm wallet funding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
    });
  }
};

const makePaymentWithWallet = async (req, res) => {
  try {
    const { amount, description, currency = 'NGN' } = req.body;
    const user_id = req.user.id;
    const email = req.user.email;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Calculate current balance from payment_payments
      const [rows] = await connection.execute(
        `SELECT 
     COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0) AS balance
   FROM payment_payments
   WHERE user_email = ?`,
        [email]  // use the user's email since user_email is the foreign key
      );

      const currentBalance = parseFloat(rows[0].balance || 0);

      if (currentBalance < parseFloat(amount)) {
        await connection.rollback();
        console.log(currentBalance)
        console.log(amount)
        return res.status(400).json({ message: 'Insufficient balance' });
      }

      // Insert a new debit transaction
      const wallet_ref = `WAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const transaction_ref = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await connection.execute(
        `INSERT INTO payment_payments
     (id, customer_name, email, currency, description, transaction_ref, wallet_ref, amount, status, user_email, type)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?, 'debit')`,
        [
          wallet_ref,
          req.user.name || '',
          email,
          currency,
          description,
          transaction_ref,
          wallet_ref,
          amount,
          email,  // <-- user_email foreign key
        ]
      );

      await connection.commit();

      res.json({
        success: true,
        message: 'Payment successful',
        data: {
          transaction_ref,
          wallet_ref,
          amount,
          new_balance: currentBalance - parseFloat(amount),
        },
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Make payment with wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment failed',
    });
  }
};

// Handle wallet funding callback
const handleFundingCallback = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { transaction_ref, transaction_id, status } = req.body;

    await connection.beginTransaction();

    // Verify payment
    const verificationResponse = await paymentAPI.confirmPayment({
      transaction_ref,
      transaction_id,
    });

    if (verificationResponse.data.status === 'success') {
      // Get transaction
      const [transactions] = await connection.execute(
        `SELECT wt.*, w.user_id, w.balance 
         FROM wallet_transactions wt
         JOIN wallets w ON wt.wallet_id = w.id
         WHERE wt.reference = ? AND wt.status = 'pending'`,
        [transaction_ref]
      );

      if (transactions.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Transaction not found' });
      }

      const transaction = transactions[0];
      const newBalance = parseFloat(transaction.balance_after);

      // Update wallet balance
      await connection.execute('UPDATE wallets SET balance = ? WHERE id = ?', [
        newBalance,
        transaction.wallet_id,
      ]);

      // Update transaction status
      await connection.execute(
        'UPDATE wallet_transactions SET status = "completed" WHERE id = ?',
        [transaction.id]
      );

      await connection.commit();

      res.json({
        success: true,
        message: 'Wallet funded successfully',
        data: {
          new_balance: newBalance,
          amount: transaction.amount,
        },
      });
    } else {
      // Mark transaction as failed
      const [transactions] = await connection.execute(
        `SELECT wt.* FROM wallet_transactions wt
         WHERE wt.reference = ? AND wt.status = 'pending'`,
        [transaction_ref]
      );

      if (transactions.length > 0) {
        await connection.execute(
          'UPDATE wallet_transactions SET status = "failed" WHERE id = ?',
          [transactions[0].id]
        );
      }

      await connection.commit();

      res.status(400).json({
        success: false,
        message: 'Payment verification failed',
      });
    }
  } catch (error) {
    await connection.rollback();
    console.error('Wallet funding callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process funding callback',
    });
  } finally {
    connection.release();
  }
};

const simulateTransfer = async (req, res) => {
  const url = `${BASE_URL}/api/v1/simulate-transfer/`;
  const { transaction_ref } = req.body;

  try {
    const [payment] = await pool.execute(
      `SELECT * FROM payment_payments WHERE transaction_ref = ?`,
      [transaction_ref]
    );

    if (!payment.length) {
      return res.status(400).json({
        success: false,
        message: 'Payment with that transaction reference not found.',
      });
    }

    const data = {
      clientTransactionRef: transaction_ref,
      amount: payment[0].amount,
      currency: "NGN",
    };

    const response = await axios.post(url, data);

    // Success
    if (response.status >= 200 && response.status < 300) {
      return res.status(200).json({
        success: true,
        message: 'Transfer simulated successfully.',
        data: response.data,
      });
    } else {
      return res.status(response.status).json({
        success: true,
        message: `Request succeeded with status ${response.status}.`,
        data: response.data,
      });
    }
  } catch (error) {
    // Axios errors
    if (error.response) {
      const { status, data } = error.response;

      let message = 'An error occurred.';
      switch (status) {
        case 400:
          message =
            data?.message ||
            data?.detail ||
            'Invalid request. Please check the transaction reference and ID.';
          break;
        case 404:
          message = 'Endpoint not found. Please contact support.';
          break;
        case 500:
          message = 'Server error. Please try again later.';
          break;
        default:
          message = `Unexpected error (${status}). Please try again.`;
      }

      return res.status(status).json({
        success: false,
        message,
        data,
      });
    }

    if (error.request) {
      return res.status(503).json({
        success: false,
        message: 'No response from server. Check your internet connection.',
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'An unexpected error occurred.',
    });
  }
};


module.exports = {
  getWallet,
  getWalletTransactions,
  fundWallet,
  confirmWalletFunding,
  makePaymentWithWallet,
  handleFundingCallback,
  simulateTransfer
};
