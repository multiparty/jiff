console.log("Command line arguments: <input> [<party count> [<computation_id> [<party id>]]]]");

// Read Command line arguments
var input = parseInt(process.argv[2], 10);

var party_count = process.argv[3];
if(party_count == null) party_count = 2;
else party_count = parseInt(party_count);

var computation_id = process.argv[4];
if(computation_id == null) computation_id = 'test-sum';

var party_id = process.argv[5];
if(party_id != null) party_id = parseInt(party_id, 10);

// JIFF options
var options = {party_count: party_count, party_id: party_id};
options.onConnect = function(jiff_instance) {
/*
  var divBy = 100;
  
  Math.floor(jiff_instance.Zp / divBy)

  var shares = jiff_instance.share(input);
  var x = shares[1];
  var noise1 = jiff_instance.server_generate_and_share( {"max":  } );
  var noise2 = jiff_instance.server_generate_and_share( {"max": } );
  var noise = noise1.sadd(noise2);
  */
  
  var shares = jiff_instance.share(input);
  shares[1].sdiv(shares[2]).open(console.log);
}

// Connect
var jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", computation_id, options);
