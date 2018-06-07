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
  var parties = [ "s1" ];
  for(var i = 1; i <= jiff_instance.party_count; i++) parties.push(i);

  var shares = jiff_instance.share(input, parties.length, parties, parties);
  var sum = shares["s1"];
  for(var i = 1; i <= jiff_instance.party_count; i++)
    sum = sum.sadd(shares[i]);
  jiff_instance.open(sum, parties).then(function(v) { console.log(v); jiff_instance.disconnect(); });
}

// Connect

var jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'test-sum', options);
