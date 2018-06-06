console.log('Command line arguments: <input> [<party count> [<computation_id> [<party id>]]]]');

var jiff = require('../../lib/jiff-client')
// Read Command line arguments
var input = parseInt(process.argv[2], 10);

var party_count = process.argv[3];
if (party_count == null) {
  party_count = 2;
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
  // input stage (generate polynomial of order n/2-1)
  try {
    var n = party_count;
    var t = n/2 - 1;


    var x = input;
    var y = input*2
    var s1 = jiff_instance.share(x, Math.floor(n/2))[1];
    var s2 = jiff_instance.share(y, Math.floor(n/2))[1];
    //console.log(s1.value, s2.value);


    var r_shares;
    var r_prime;
    Promise.all([s1.promise, s2.promise]).then(
      function (result) {
        //console.log(s1.value, s2.value);
        var r = s1.value*s2.value;
        //console.log(r);
        r_shares = jiff_instance.share(r, Math.floor(n/2));

        var promises = [];
        for (var i = 1; i <= n; i++) {
          promises.push(r_shares[i].promise);
        }
        //shamir reonstruct takes an array of objects
        //representing shares to reconstruct
        //each has attributes: value, sender_id, Zp
        //share object should look like share = {value: x, sender_id: y, Zp: jiff_instance.Zp}

        //console.log(r_shares);

        var reconstruct_parts = new Array(n);
        //TODO make this for-loop a map so it's cleaner and cooler

        Promise.all(promises).then(
          function (result) {
            for (var i = 1; i <= n; i++) {
              console.log(i);
              //console.log(r_shares[i]);
              reconstruct_parts[i-1] = {value: r_shares[i].value, sender_id: i, Zp: jiff_instance.Zp};

            }
            console.log('reconstructing');
            console.log(reconstruct_parts);
            r_prime = jiff.sharing_schemes.shamir_reconstruct(jiff_instance, reconstruct_parts);
            console.log(r_prime);
            var secret = jiff_instance.coerce_to_share(r_prime);
            console.log("bout to open secret");
            var secret_promise = jiff_instance.open(secret);
            secret_promise.then(
              function (result) {
                console.log(result);
                console.log('safely disconnecting!');
                jiff_instance.disconnect();
              }, function (err) {
                console.log(String(err)); // Error: "It broke"

              });

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
}


function multiply(xi, yi, party_count) {
  var zi = xi*yi;

  /*var zn_shares = jiff_instance.secret_share(zi);
  var zj_shares = new Array(party_count);
  for (var j = 0; j < party_count; j++) {
    // send zij to j
    // does this also receiv zji values?
    zj_shares[j] = jiff_instance.share({secret: zn_shares[j], receivers_list: [j]});
*/
  //receive zji from party j

  zn_shares = jiff_instance.shamir_share(zi);
  var z_prime = jiff_instance.shamir_reconstruct(zj_shares);
  return z_prime;
}


// Connect
var jiff_instance =  jiff.make_jiff('http://localhost:8080', computation_id, options);
console.log(computation_id); console.log(party_count);
