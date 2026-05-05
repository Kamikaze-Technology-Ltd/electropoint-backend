// controllers/newsletterController.js
const pool = require('../config/database');

// Subscribe to newsletter
const subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if already subscribed
    const [existing] = await pool.execute(
      'SELECT id, status FROM newsletter_subscriptions WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      if (existing[0].status === 'subscribed') {
        return res.status(400).json({ message: 'Email is already subscribed' });
      } else {
        // Resubscribe
        await pool.execute(
          'UPDATE newsletter_subscriptions SET status = "subscribed", unsubscribed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE email = ?',
          [email]
        );
        return res.json({
          message: 'Successfully resubscribed to newsletter',
          data: { email, status: 'subscribed' },
        });
      }
    } else {
      // Create new subscription
      await pool.execute(
        'INSERT INTO newsletter_subscriptions (email, status) VALUES (?, "subscribed")',
        [email]
      );
      return res.json({
        message: 'Successfully subscribed to newsletter',
        data: { email, status: 'subscribed' },
      });
    }
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Unsubscribe from newsletter
const unsubscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const [result] = await pool.execute(
      'UPDATE newsletter_subscriptions SET status = "unsubscribed", unsubscribed_at = CURRENT_TIMESTAMP WHERE email = ?',
      [email]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: 'Email not found in subscriptions' });
    }

    res.json({
      message: 'Successfully unsubscribed from newsletter',
      data: { email, status: 'unsubscribed' },
    });
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all subscribers (for admin)
const getSubscribers = async (req, res) => {
  try {
    const { page = 1, limit = 100, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];

    if (status && status !== 'all') {
      whereClause = 'WHERE status = ?';
      params.push(status);
    }

    const [subscribers] = await pool.execute(
      `SELECT id, email, status, subscribed_at, unsubscribed_at, created_at
       FROM newsletter_subscriptions 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM newsletter_subscriptions ${whereClause}`,
      params
    );

    const [activeCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM newsletter_subscriptions WHERE status = "subscribed"'
    );

    const [inactiveCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM newsletter_subscriptions WHERE status = "unsubscribed"'
    );

    res.json({
      subscribers,
      stats: {
        total: countRows[0].total,
        active: activeCount[0].count,
        inactive: inactiveCount[0].count,
      },
      totalPages: Math.ceil(countRows[0].total / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send newsletter
const sendNewsletter = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      subject,
      message,
      recipientType = 'all',
      customEmails = [],
    } = req.body;

    if (!subject || !message) {
      return res
        .status(400)
        .json({ message: 'Subject and message are required' });
    }

    // Get recipients based on type
    let recipients = [];
    if (recipientType === 'all') {
      const [subscribed] = await connection.execute(
        'SELECT email FROM newsletter_subscriptions WHERE status = "subscribed"'
      );
      recipients = subscribed.map((row) => row.email);
    } else if (recipientType === 'selected' && customEmails.length > 0) {
      // Validate that custom emails are subscribed
      const placeholders = customEmails.map(() => '?').join(',');
      const [validEmails] = await connection.execute(
        `SELECT email FROM newsletter_subscriptions 
         WHERE email IN (${placeholders}) AND status = "subscribed"`,
        customEmails
      );
      recipients = validEmails.map((row) => row.email);
    }

    if (recipients.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'No valid recipients found' });
    }

    // Create campaign record
    const [campaignResult] = await connection.execute(
      `INSERT INTO newsletter_campaigns 
       (subject, message, recipient_count, sent_count, status, sent_at) 
       VALUES (?, ?, ?, ?, "sent", CURRENT_TIMESTAMP)`,
      [subject, message, recipients.length, recipients.length]
    );

    const campaignId = campaignResult.insertId;

    // Create recipient records
    const recipientValues = recipients.map((email) => [campaignId, email]);
    const placeholders = recipients.map(() => '(?, ?)').join(',');

    await connection.execute(
      `INSERT INTO campaign_recipients (campaign_id, email) 
       VALUES ${placeholders}`,
      recipientValues.flat()
    );

    // TODO: Integrate with actual email service (Nodemailer, SendGrid, etc.)
    // For now, we'll simulate email sending
    console.log(
      `Sending newsletter to ${recipients.length} recipients:`,
      recipients
    );

    await connection.commit();

    res.json({
      message: `Newsletter sent successfully to ${recipients.length} recipients`,
      data: {
        campaignId,
        recipients: recipients.length,
        subject,
        message,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Send newsletter error:', error);
    res.status(500).json({ message: 'Failed to send newsletter' });
  } finally {
    connection.release();
  }
};

// Get campaign statistics
const getCampaigns = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const [campaigns] = await pool.execute(
      `SELECT id, subject, message, recipient_count, sent_count, 
              open_count, click_count, status, sent_at, created_at
       FROM newsletter_campaigns 
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );

    // Calculate rates for each campaign
    const campaignsWithRates = campaigns.map((campaign) => ({
      ...campaign,
      open_rate:
        campaign.recipient_count > 0
          ? Math.round((campaign.open_count / campaign.recipient_count) * 100)
          : 0,
      click_rate:
        campaign.recipient_count > 0
          ? Math.round((campaign.click_count / campaign.recipient_count) * 100)
          : 0,
    }));

    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as total FROM newsletter_campaigns'
    );

    res.json({
      campaigns: campaignsWithRates,
      totalPages: Math.ceil(countRows[0].total / limit),
      currentPage: parseInt(page),
      total: countRows[0].total,
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Bulk unsubscribe
const bulkUnsubscribe = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: 'Emails array is required' });
    }

    const placeholders = emails.map(() => '?').join(',');
    const [result] = await connection.execute(
      `UPDATE newsletter_subscriptions 
       SET status = "unsubscribed", unsubscribed_at = CURRENT_TIMESTAMP 
       WHERE email IN (${placeholders}) AND status = "subscribed"`,
      emails
    );

    await connection.commit();

    res.json({
      message: `Successfully unsubscribed ${result.affectedRows} emails`,
      data: {
        unsubscribed: result.affectedRows,
        totalRequested: emails.length,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Bulk unsubscribe error:', error);
    res.status(500).json({ message: 'Failed to unsubscribe emails' });
  } finally {
    connection.release();
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  getSubscribers,
  sendNewsletter,
  getCampaigns,
  bulkUnsubscribe,
};
