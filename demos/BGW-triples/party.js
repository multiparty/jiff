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
  // input stage (generate polynomial of order n/2-1)
  try {
    var n = party_count;
    var t = n/2 - 1;

    var x = input;
    var y = input*2;
    var s1 = jiff_instance.share(x, Math.floor(n/2));
    var s2 = jiff_instance.share(y, Math.floor(n/2));
    //console.log(jiff_instance.id);
    //console.log(s1, s2);
    var x_sum = s1[1];
    var y_sum = s2[1];

    var x_y_promises = [];
    for (var i = 1; i <= n; i++) {
      x_y_promises.push(s1[i].promise);
      x_y_promises.push(s2[i].promise);
    }

    //console.log(x_sum, y_sum);
    Promise.all(x_y_promises).then(
      function (result) {
        console.log('addititon');
        // sum the values of all shares of s1, s2 to form new secret x, y values
        for (var i = 2; i <= jiff_instance.party_count; i++) {
          x_sum = x_sum.sadd(s1[i]);
        }
        for (i = 2; i <= jiff_instance.party_count; i++) {
          y_sum = y_sum.sadd(s2[i]);
        }

        console.log(x_sum.value, y_sum.value,'x,y values');
        var r_shares;
        var r_prime;
        Promise.all([x_sum.promise, y_sum.promise]).then(
          function (result) {
            //console.log(s1.value, s2.value);
            var r = x_sum.value*y_sum.value;
            console.log(r);
            //var r = s1.value*s2.value;
            //
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
            var reconstruct_parts = new Array(n);
            Promise.all(promises).then(
              function (result) {
                //TODO make this for-loop a map so it's cleaner and cooler
                for (var i = 1; i <= n; i++) {
                  console.log(i);
                  console.log(r_shares[i]);
                  reconstruct_parts[i-1] = {value: r_shares[i].value, sender_id: i, Zp: jiff_instance.Zp};

                }
                console.log('reconstructing');
                console.log(reconstruct_parts);
                r_prime = jiff.sharing_schemes.shamir_reconstruct(jiff_instance, reconstruct_parts);
                console.log(r_prime);
                // this is a share of z
                var secret = jiff_instance.coerce_to_share(r_prime);

                x_sum.open(function (v) {
                  console.log('x= ',v);
                });
                y_sum.open(function (v) {
                  console.log('y= ',v);
                });

                secret.open(
                  function (result) {
                    console.log('z = ', result);
                    console.log('safely disconnecting!');
                    jiff_instance.disconnect();
                  },
                  function (err) {
                    console.log(err);
                    jiff_instance.disconnect();
                  });


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
}

var BGW = function (x, y) {

  // input stage (generate polynomial of order n/2-1)
  try {
    var n = party_count;
    var t = n/2 - 1;


    var x = input;
    var y = input*2
    var s1 = jiff_instance.share(x, Math.floor(n/2));
    var s2 = jiff_instance.share(y, Math.floor(n/2));
    //console.log(jiff_instance.id);
    //console.log(s1, s2);
    var x_sum = s1[1];
    var y_sum = s2[1];

    var x_y_promises = [];
    for (var i = 1; i <= n; i++) {
      x_y_promises.push(s1[i].promise);
      x_y_promises.push(s2[i].promise);
    }

    //console.log(x_sum, y_sum);
    Promise.all(x_y_promises).then(
      function (result) {
        console.log('addititon');
        // sum the values of all shares of s1, s2 to form new secret x, y values
        for (var i = 2; i <= jiff_instance.party_count; i++) {
          x_sum = x_sum.sadd(s1[i]);
        }
        for (i = 2; i <= jiff_instance.party_count; i++) {
          y_sum = y_sum.sadd(s2[i]);
        }

        console.log(x_sum.value, y_sum.value,'x,y values');
        var r_shares;
        var r_prime;
        Promise.all([x_sum.promise, y_sum.promise]).then(
          function (result) {
            //console.log(s1.value, s2.value);
            var r = x_sum.value*y_sum.value;
            console.log(r);
            //var r = s1.value*s2.value;
            //
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
            var reconstruct_parts = new Array(n);
            Promise.all(promises).then(
              function (result) {
                //TODO make this for-loop a map so it's cleaner and cooler
                for (var i = 1; i <= n; i++) {
                  console.log(i);
                  console.log(r_shares[i]);
                  reconstruct_parts[i-1] = {value: r_shares[i].value, sender_id: i, Zp: jiff_instance.Zp};

                }
                console.log('reconstructing');
                console.log(reconstruct_parts);
                r_prime = jiff.sharing_schemes.shamir_reconstruct(jiff_instance, reconstruct_parts);
                console.log(r_prime);
                // this is a share of z
                var secret = jiff_instance.coerce_to_share(r_prime);

                x_sum.open(function (v) {
                  console.log('x= ',v);
                });
                y_sum.open(function (v) {
                  console.log('y= ',v);
                });

                secret.open(
                  function (result) {
                    console.log('z = ', result);
                    console.log('safely disconnecting!');
                    jiff_instance.disconnect();
                  },
                  function (err) {
                    console.log(err);
                    jiff_instance.disconnect();
                  });


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
  return z; //share of z
}



// Connect
var jiff_instance =  jiff.make_jiff('http://localhost:8080', computation_id, options);
console.log(computation_id); console.log(party_count);
