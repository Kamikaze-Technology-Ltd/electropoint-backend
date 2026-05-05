// services/paymentService.js
const axios = require('axios');

const PAYMENT_BASE_URL = 'https://makafrik-backend.onrender.com/api';

const paymentAPI = {
  initiatePayment: (data) =>
    axios.post(`${PAYMENT_BASE_URL}/v1/initiate-payment/`, data),

  initiateBankTransfer: (data) =>
    axios.post(`${PAYMENT_BASE_URL}/v1/initiate-bank-transfer/`, data),

  confirmPayment: (data) =>
    axios.post(`${PAYMENT_BASE_URL}/v1/confirm-payment/`, data),

  createAccount: (data) =>
    axios.post(`${PAYMENT_BASE_URL}/v1/create-acct/`, data),

  recurringPayment: (data) =>
    axios.post(`${PAYMENT_BASE_URL}/v1/recurring-payment/`, data),

  cancelRecurringPayment: (data) =>
    axios.post(`${PAYMENT_BASE_URL}/v1/cancel-recurring-payment/`, data),
};

module.exports = { paymentAPI };
