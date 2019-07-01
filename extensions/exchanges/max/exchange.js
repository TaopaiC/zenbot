const ccxt = require('ccxt')
const path = require('path')

module.exports = function container (conf) {
  var public_client, authed_client

  function publicClient () {
    if (!public_client) public_client = new ccxt.max({ 'apiKey': '', 'secret': '' })
    return public_client
  }

  // eslint-disable-next-line no-unused-vars
  function authedClient() {
    if (!authed_client) {
      if (!conf.max || !conf.max.key || !conf.max.key === 'YOUR-API-KEY') {
        throw new Error('please configure your Max credentials in ' + path.resolve(__dirname, 'conf.js'))
      }
      authed_client = new ccxt.max({ 'apiKey': conf.max.key, 'secret': conf.max.secret })
    }
    return authed_client
  }

  // eslint-disable-next-line no-unused-vars
  function joinProduct(product_id) {
    return product_id.split('-')[0] + '/' + product_id.split('-')[1]
  }

  // TODO retry function

  var firstRun = true
  var exchange = {
    name: 'max',
    historyScan: 'forward',
    makerFee: 0.1,
    takerFee: 0.1,

    getProducts: function () {
      if (firstRun) {
        firstRun = false
        var client = publicClient()
        this.makerFee = client.fees.trading.maker * 100
        this.takerFee = client.fees.trading.taker * 100
      }
      return require('./products.json')
    },

    // eslint-disable-next-line no-unused-vars
    getTrades: function (opts, cb) {
      throw new Error('getTrades not implemented')
    },

    // eslint-disable-next-line no-unused-vars
    getBalance: function (opts, cb) {
      throw new Error('getBalance not implemented')
    },

    // eslint-disable-next-line no-unused-vars
    getQuote: function (opts, cb) {
      throw new Error('getQuote not implemented')
    },

    // eslint-disable-next-line no-unused-vars
    cancelOrder: function (opts, cb) {
      throw new Error('cancelOrder not implemented')
    },
    // eslint-disable-next-line no-unused-vars
    buy: function (opts, cb) {
      throw new Error('buy not implemented')
    },
    // eslint-disable-next-line no-unused-vars
    sell: function (opts, cb) {
      throw new Error('sell not implemented')
    },
    // eslint-disable-next-line no-unused-vars
    getOrder: function (opts, cb) {
      throw new Error('getOrder not implemented')
    },
    // eslint-disable-next-line no-unused-vars
    getCursor: function (trade) {
      throw new Error('getCursor not implemented')
    },
  }
  return exchange
}
