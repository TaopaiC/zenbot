const ccxt = require('ccxt')
const path = require('path')

module.exports = function container (conf) {
  var public_client, authed_client

  function publicClient () {
    if (!public_client) public_client = new ccxt.max({ 'apiKey': '', 'secret': '' })
    return public_client
  }

  function authedClient() {
    if (!authed_client) {
      if (!conf.max || !conf.max.key || !conf.max.key === 'YOUR-API-KEY') {
        throw new Error('please configure your Max credentials in ' + path.resolve(__dirname, 'conf.js'))
      }
      authed_client = new ccxt.max({ 'apiKey': conf.max.key, 'secret': conf.max.secret })
    }
    return authed_client
  }

  function joinProduct(product_id) {
    return product_id.split('-')[0] + '/' + product_id.split('-')[1]
  }

  function retry(method, args, err) {
    let timeout = 5000

    if (method !== 'getTrades') {
      console.error(('\nAPI is down! unable to call ' + method + ', retrying in ' + timeout + 'ms').red)
      if (err) console.error(err)
      console.error(args.slice(0, -1))
    }

    setTimeout(function() {
      exchange[method].apply(exchange, args)
    }, timeout)

    return false
  }

  var firstRun = true
  var orders = {}

  var exchange = {
    name: 'max',
    historyScan: 'backward',
    // historyScanUsesTime: true,
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
      console.log('getTrades', opts)
      const func_args = [].slice.call(arguments)
      const client = publicClient()

      const params = {}
      if (opts.to !== undefined && opts.to !== null) {
        params.to = opts.to
      }

      client.fetchTrades(joinProduct(opts.product_id), undefined, undefined, params)
        .then(result => {
          // console.log('result', result)
          const trades = result.map(trade => {
            return {
              trade_id: trade.id,
              time: trade.timestamp,
              size: parseFloat(trade.amount),
              price: parseFloat(trade.price),
              selector: 'max.' + opts.product_id,
              side: trade.side,
            }
          })

          cb(null, trades)
        }).catch(error => {
          console.error('An error occurred', error)
          return retry('getTrades', func_args, error)
        })
    },

    // eslint-disable-next-line no-unused-vars
    getBalance: function (opts, cb) {
      const func_args = [].slice.call(arguments)
      const client = authedClient()
      client.fetchBalance().then(result => {
        const balance = { asset: 0, currency: 0 }
        Object.keys(result).forEach(function (key) {
          if (key === opts.currency) {
            balance.currency = result[key].free + result[key].used
            balance.currency_hold = result[key].used
          }
          if (key === opts.asset) {
            balance.asset = result[key].free + result[key].used
            balance.asset_hold = result[key].used
          }
        })
        cb(null, balance)
      }).catch(function (error) {
        console.error('An error occurred', error)
        return retry('getBalance', func_args, error)
      })
    },

    getQuote: function (opts, cb) {
      const func_args = [].slice.call(arguments)
      const client = publicClient()
      client.fetchTicker(joinProduct(opts.product_id)).then(result => {
        cb(null, { bid: result.bid, ask: result.ask })
      }).catch(function (error) {
        console.error('An error occurred', error)
        return retry('getQuote', func_args)
      })
    },

    // eslint-disable-next-line no-unused-vars
    cancelOrder: function (opts, cb) {
      // const func_args = [].slice.call(arguments)
      const client = authedClient()
      client.cancelOrder(opts.order_id, joinProduct(opts.product_id)).then(function (body) {
        // TODO
        if (body && (body.message === 'Order already done' || body.message === 'order not found')) return cb()
        cb(null)
      }, function() {
        // TODO
        // if (err) {
        //   // decide if this error is allowed for a retry

        //   if (err.message && err.message.match(new RegExp(/-2011|UNKNOWN_ORDER/))) {
        //     console.error(('\ncancelOrder retry - unknown Order: ' + JSON.stringify(opts) + ' - ' + err).cyan)
        //   } else {
        //     // retry is allowed for this error

        //     return retry('cancelOrder', func_args, err)
        //   }
        // }

        cb()
      })
    },
    trade: function(side, opts, cb) {
      var func_args = [].slice.call(arguments)
      var client = authedClient()
      
      if (typeof opts.post_only === 'undefined') {
        opts.post_only = true
      }

      if (opts.order_type === 'taker') {
        opts.type = 'market'
      }
      if (opts.order_type == 'maker') {
        opts.type = 'limit'
      }

      opts.side = side

      let callParams = {
        symbol : joinProduct(opts.product_id),
        type : opts.type,
        side: opts.side, 
        quantity: opts.size, 
        price: opts.price 
      }
     
      client.createOrder( callParams.symbol, callParams.type, callParams.side, callParams.quantity, callParams.price)
        .then(result => {
          const order = result
          console.log('order', order)
          orders['~' + order.id] = order
          cb(null, order)
        }).catch(function (error) {
          if (error.message.match(/Insufficient funds/)) 
          {
            let order = {
              status: 'rejected',
              reject_reason: 'balance'
            }
            return cb(null, order)
          }
          return retry('buy', func_args)
        })
    },

    buy: function (opts, cb) {
      exchange.trade('buy', opts, cb)
    },

    sell: function (opts, cb) {
      exchange.trade('sell', opts, cb)
    },

    getOrder: function (opts, cb) {
      var func_args = [].slice.call(arguments)
      var client = authedClient()
      var order = orders['~' + opts.order_id]
      client.fetchOrder(opts.order_id, joinProduct(opts.product_id)).then(function (body) {
        if (body.status !== 'open' && body.status !== 'canceled') {
          order.status = 'done'
          order.done_at = new Date().getTime()
          order.filled_size = parseFloat(body.amount) - parseFloat(body.remaining)
          return cb(null, order)
        }
        cb(null, order)
      }, function(err) {
        return retry('getOrder', func_args, err)
      })
    },

    getCursor: function (trade) {
      return trade.trade_id || trade
    },
  }
  return exchange
}
