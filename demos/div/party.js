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
  try {
  var shares = jiff_instance.share(input);
  var x = shares[1];
  
  var c = 100;  
  var ZpOVERc = Math.floor(jiff_instance.Zp / c);

  var nOVERc = jiff_instance.server_generate_and_share( { "max":  ZpOVERc } );
  var nMODc = jiff_instance.server_generate_and_share( { "max": c } );
  var noise = nOVERc.cmult(c).sadd(nMODc);
  
  var noisyX = x.sadd(noise);
  noisyX.open(function(noisyX) {
    var wrapped = x.cgt(noisyX); // 1 => x + noise wrapped around Zp, 0 otherwise

    // if we did not wrap
    var noWrapDiv = Math.floor(noisyX/c);
    var unCorrectedQuotient = nOVERc.cmult(-1).cadd(noWrapDiv).csub(1);
    var verify = x.ssub(unCorrectedQuotient.cmult(c));
    var isNotCorrect = verify.cgteq(c);
    var noWrapAnswer = unCorrectedQuotient.sadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1   

    // if we wrapped
    var wrapDiv = Math.floor((noisyX + jiff_instance.Zp)/c);
    unCorrectedQuotient = nOVERc.cmult(-1).cadd(wrapDiv).csub(1);
    verify = x.ssub(unCorrectedQuotient.cmult(c));
    isNotCorrect = verify.cgteq(c);
    var wrapAnswer = unCorrectedQuotient.sadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1  

    var answer = noWrapAnswer.sadd(wrapped.smult(wrapAnswer.ssub(noWrapAnswer)));
    answer.open(console.log);
  });
  } catch (err) {
    console.log(err);
  }
};

// Connect
var jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", computation_id, options);
