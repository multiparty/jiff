console.log('Command line arguments: <input> [<party count> [<computation_id> [<party id>]]]]');

var jiff = require('../../lib/jiff-client')
// Read Command line arguments
var input = parseInt(process.argv[2], 10);

var party_count = process.argv[3];
if (party_count == null) {
  party_count = 4;
} else {
  party_count = parseInt(party_count);
}

var computation_id = process.argv[4];
if (computation_id == null) {
  computation_id = 'test-BGW';
}

var party_id = process.argv[5];
if (party_id != null) {
  party_id = parseInt(party_id, 10);
}

// JIFF options
var options = {party_count: party_count, party_id: party_id};
options.onConnect = function (jiff_instance) {

  var z = BGW(input, input+2, jiff_instance);
  console.log(input, input+2,z.value);

}

function BGW(x, y, jiff_instance) {
  var n = party_count;
  var t = Math.floor(n/2);

  var final_deferred = $.Deferred();
  var final_promise = final_deferred.promise();
  var result = jiff_instance.secret_share(jiff_instance, false, final_promise, undefined, x.holders, t, jiff_instance.Z);

  try {

    var s1 = jiff_instance.share(x, Math.floor(n/2));
    var s2 = jiff_instance.share(y, Math.floor(n/2));

    var x_sum = s1[1];
    var y_sum = s2[1];

    var x_y_promises = [];
    for (var i = 1; i <= n; i++) {
      x_y_promises.push(s1[i].promise);
      x_y_promises.push(s2[i].promise);
    }

    Promise.all(x_y_promises).then(
      function (result) {
        // sum the values of all shares of s1, s2 to form new secret x, y values
        for (var i = 2; i <= jiff_instance.party_count; i++) {
          x_sum = x_sum.sadd(s1[i]);
        }
        for (i = 2; i <= jiff_instance.party_count; i++) {
          y_sum = y_sum.sadd(s2[i]);
        }

        var r_shares;
        var r_prime;
        Promise.all([x_sum.promise, y_sum.promise]).then(
          function (result) {

            var r = x_sum.value*y_sum.value;
            r_shares = jiff_instance.share(r, Math.floor(n/2));

            var promises = [];
            for (var i = 1; i <= n; i++) {
              promises.push(r_shares[i].promise);
            }

            //shamir reonstruct takes an array of objects
            //has attributes: {value: x, sender_id: y, Zp: jiff_instance.Zp}
            var reconstruct_parts = new Array(n);
            Promise.all(promises).then(
              function (result) {
                //TODO make this for-loop a map so it's cleaner and cooler
                for (var i = 1; i <= n; i++) {
                  reconstruct_parts[i-1] = {value: r_shares[i].value, sender_id: i, Zp: jiff_instance.Zp};

                }
                r_prime = jiff.sharing_schemes.shamir_reconstruct(jiff_instance, reconstruct_parts);
                // this is a share of z
                var final_result = jiff_instance.coerce_to_share(r_prime);

                if(final_result.ready)
                  final_deferred.resolve(final_result);
                else // Resolve the deferred when ready.
                  final_result.promise.then(function () { final_deferred.resolve(final_result); });
              });
          },
          function (err) {
            console.log(err);
          });
      },
      function (err) {
        console.log('error in s1,s2 promise.then');
        console.log(err);
      });


  } catch (err) {
    console.log('error in try/catch');
    console.log(err);
  }
  return result; //share of z
}



// Connect
var jiff_instance =  jiff.make_jiff('http://localhost:8080', computation_id, options);
console.log(computation_id); console.log(party_count);
