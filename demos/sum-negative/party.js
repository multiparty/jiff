var BigNumber = require('bignumber.js');
var jiff_instance;

console.log("i'm here")

var options = {party_count: 2, Zp: new BigNumber(32416190071), offset: 100, bits: 8, digits: 4 };
options.onConnect = function() {
	console.log("i'm in onConnect")
  var shares = jiff_instance.share(1.0);
  var sum = shares[1];
  
  for(var i = 2; i <= jiff_instance.party_count; i++)
    // sum = sum.smult(shares[i]);
	sum = sum.smult(shares[i])
    
  sum.open(function(r) { console.log(r.toString(10)); } );
}

jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'sum-negative', options);
jiff_instance = require('../../lib/ext/jiff-client-bignumber').make_jiff(jiff_instance);
jiff_instance = require('../../lib/ext/jiff-client-negativenumber').make_jiff(jiff_instance, options); // Max bits allowed after decimal.

