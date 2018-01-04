var BigNumber = require('bignumber.js');
var jiff_instance;

var options = {party_count: 2, Zp: new BigNumber(32416190071), autoConnect: false };
options.onConnect = function() {
  var shares = jiff_instance.share(3.223);
  var sum = shares[1];
  
  for(var i = 2; i <= jiff_instance.party_count; i++)
    sum = sum.sadd(shares[i]);
    
  sum.open(function(r) { console.log(r.toString(10)); } );
}

var base_instance = require('../lib/jiff-client').make_jiff("http://localhost:3000", 'test-sum', options);
var bignum_instance = require('../modules/jiff-client-bignumber').make_jiff(base_instance, options)
jiff_instance = require('../modules/jiff-client-fixedpoint').make_jiff(base_instance, { digits: 4}); // Max bits allowed after decimal.
jiff_instance.connect();
