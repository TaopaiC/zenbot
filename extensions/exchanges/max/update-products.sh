#!/usr/bin/env node
const ccxt = require('ccxt')

const max = new ccxt.max();

max.fetch_markets().then(function(markets) {
  var products = markets.map(function (market) {
      const limits = market.limits;
      const min_size = limits && limits.amount && limits.amount.min
      const max_size = limits && limits.amount && limits.amount.max
      const min_total = limits && limits.price && limits.price.min
      const increment = '0.' + '0'.repeat(market.precision.price - 1) + '1'
      const asset_increment = '0.' + '0'.repeat(market.precision.amount - 1) + '1'

    return {
      id: market.id,
      asset: market.base,
      currency: market.quote,
      min_size: min_size,
      max_size: max_size,
      min_total: min_total,
      increment: increment,
      asset_increment: asset_increment,
      label: market.base + '/' + market.quote
    }
  })

  var target = require('path').resolve(__dirname, 'products.json')
  require('fs').writeFileSync(target, JSON.stringify(products, null, 2))
  console.log('wrote', target)
  process.exit()
})
