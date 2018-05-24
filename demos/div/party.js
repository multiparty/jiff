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

  var nOVERc = jiff_instance.server_generate_and_share( {"max":  Math.floor(ZpOVERc / 100)} );
  var nMODc = jiff_instance.server_generate_and_share( {"max": c, "nonzero": true} );
  var noise = nOVERc.cmult(c).sadd(nMODc);
  
  var noisyX = x.sadd(noise);
  var wrapped = x.sgt(noisyX, null, "<1");

  noisyX.open(function(noisyX) {
    noisyX = Math.floor(noisyX/c);

    // if did not wrap
    var unCorrectedQuotient = nOVERc.cmult(-1).cadd(noisyX);
    var verifyX = unCorrectedQuotient.cmult(c);
    var isNotCorrect = verifyX.sgt(x, null, "<2");
    var noWrapAnswer = unCorrectedQuotient.ssub(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1   

    // if wrapped
    var unCorrectedQuotient = nOVERc.cmult(-1).cadd(noisyX).cadd(ZpOVERc);
    var q1 = unCorrectedQuotient.csub(2);
    var q2 = unCorrectedQuotient.csub(1);
    var q3 = unCorrectedQuotient.csub(0);
    var q4 = unCorrectedQuotient.cadd(1);
    
    var q4Correct = q4.cmult(c).slt(x);
    var q3Correct = q3.cmult(c).slt(x);
    var q2Correct = q2.cmult(c).slt(x);
    var q1Correct = q1.cmult(c).slt(x);
    
    q3Correct = q3Correct.smult(q4Correct.not());
    q2Correct = q2Correct.smult(q3Correct.not());
    q1Correct = q1Correct.smult(q2Correct.not());

    var wrapAnswer = q4.smult(q4Correct);
    wrapAnswer = wrapAnswer.sadd(q3.smult(q3Correct));
    wrapAnswer = wrapAnswer.sadd(q2.smult(q2Correct));
    wrapAnswer = wrapAnswer.sadd(q1.smult(q1Correct));

    var answer = noWrapAnswer.sadd(wrapped.smult(wrapAnswer.ssub(noWrapAnswer)));
    answer.open(console.log);
  });
  } catch (err) {
    console.log(err);
  }
};

// Connect
var jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", computation_id, options);
