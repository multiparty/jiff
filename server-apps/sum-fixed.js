var jiff_instance;

var options = {party_count: 2};
options.onConnect = function() {
  var shares = jiff_instance.share(3.223);
  var sum = shares[1];
  
  for(var i = 2; i <= jiff_instance.party_count; i++)
    sum = sum.sadd(shares[i]);
    
  sum.open(console.log);
}

var base_instance = require('../lib/jiff-client').make_jiff("http://localhost:3000", 'test-sum', options);
jiff_instance = require('../modules/jiff-client-fixedpoint').make_jiff(base_instance, { bits: 8 }); // Max bits allowed after decimal.

