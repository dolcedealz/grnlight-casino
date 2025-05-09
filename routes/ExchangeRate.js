// models/ExchangeRate.js
const mongoose = require('mongoose');

const exchangeRateSchema = new mongoose.Schema({
  base: {
    type: String,
    required: true,
    enum: ['usdt', 'rub', 'stars']
  },
  rates: {
    usdt: Number,
    rub: Number,
    stars: Number
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ExchangeRate', exchangeRateSchema);