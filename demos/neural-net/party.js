var jiff_instance;

// var options = {party_count: 2};
// options.onConnect = function() {
//   var shares = jiff_instance.share(3);
//   var sum = shares[1];
//   for(var i = 2; i <= jiff_instance.party_count; i++)
//     sum = sum.sadd(shares[i]);
//   sum.open(function(v) { console.log(v); jiff_instance.disconnect(); });
// }

// jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'test-neural-net', options);

// Called when the connect button is clicked: connect to the server and intialize the MPC.
function connect() {
  // Disable connect button
  $('#connectBtn').prop('disabled', true);

  var options = { 'party_count': 2 };
  options.onError = function(error) { $("#result").append("<p class='error'>"+error+"</p>"); };
  options.onConnect = function() { $("#computeBtn").attr("disabled", false); $("#output").append("<p>All parties Connected!</p>"); };

  jiff_instance = jiff.make_jiff("http://localhost:8080", "test-neural-net", options);
}

function success(result) { 
    console.log("success, result = " + result);
    return result;
  }

  function test_result(result) { 
    var formattedResult = "[" + result[0] + ", " + result[1] + ", " + result[2] + "]";
    handleResult(formattedResult);
  }

  function failure(error){
    console.error("failure, error = " + error);
  }

function compute() {
	console.log("in compute")
	var results = [];
    var shares_2d = jiff_instance.share_vec([1,2,3]);

    for(var i = 0; i < shares_2d.length; i++) {
      var shares = shares_2d[i];

      var sum = shares[1];

      for(var j = 2; j <= party_count; j++) {
        sum = sum.sadd(shares[j]);
      }
      //console.log(sum.open());
      results.push(sum.open().then(success, failure));
    }



    Promise.all(results).then(test_result, failure);  
}
