/* STEPS
 * 1. each party generates random x, y => sends shares to every other party
 * 2. via those shares, all parties compute x*y = z, each receive a share of z
 * 3. all parties should receive a share of z and then be able to cooperatively
 *      open z
 * 4.
 *
 */
// input stage

var x = jiff.random(jiff.Zp);
var y = jiff.random(jiff.Zp);
var s1 = shamir_share(x, parties, n/2)
var s2 = shamir_share(x, parties, n/2)


var r_shares;
var r_prime;
Promise.all([s1.promise, s1.promise]).then(
  function () {
    var r = s1.value * s2.value;
    r_shares = jiff_instance.share(r, threshold=n/2);
    r_prime = jiff_instance.shamir_reconstruct(r_shares);
  });

console.log(jiff_instance.open(r_prime));

// computation stage
function add(xi, yi) {
  return xi + yi;
}

//Reconstruction Stage
function multiply(xi, yi, party_count) {
  zi = xi*yi;

  var zn_shares = jiff_instance.secret_share(zi);
  var zj_shares = new Array(party_count);
  for (var j = 0; j < party_count; j++) {
    // send zij to j
    // does this also receiv zji values?
    zj_shares[j] = jiff_instance.share(secret=zn[j], receivers_list=[j]);
    //receive zji from party j
    //
  }
  z_prime = jiff_instance.shamir_reconstruct(zj_shares);
  return z_prime;
}


