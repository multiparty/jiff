console.log("Command line arguments: <input> [<party count> [<computation_id> [<party id>]]]]");

// Read Command line arguments
var input = Number(process.argv[2]);

var party_count = process.argv[3];
if(party_count == null) party_count = 2;
else party_count = parseInt(party_count);

var computation_id = process.argv[4];
if(computation_id == null) computation_id = 'test-amortized';

var party_id = process.argv[5];
if(party_id != null) party_id = parseInt(party_id, 10);

var BigNumber = require('bignumber.js');
var jiff_instance;

var options = {party_count: party_count, party_id: party_id, Zp: new BigNumber(32416190071), autoConnect: false };
options.onConnect = function() {
  var shares = jiff_instance.share(input);
  var sum = shares[1];
  
  for(var i = 2; i <= jiff_instance.party_count; i++)
    sum = sum.sadd(shares[i]);
    
  sum.open(function(r) { console.log(r.toString(10)); } );
}

var base_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", computation_id, options);
jiff_instance = require('../../lib/ext/jiff-client-bignumber').make_jiff(base_instance, options)
//jiff_instance = require('../../lib/ext/jiff-client-amortizedbool').make_jiff(jiff_instance, { digits: 4}); // Max bits allowed after decimal.
jiff_instance.connect();
