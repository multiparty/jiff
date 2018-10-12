/* global sodium BN unreached OPRF drawPath */

// URLS of backend server and then frontend servers
var urls = [ 'http://localhost:9111', 'http://localhost:9112', 'http://localhost:9113' ];

// oprf library
var oprf_;
sodium.ready.then(function () {
  oprf_ = new OPRF(sodium);
});

// order of elliptic curve
var prime = new BN(2).pow(new BN(252)).add(new BN('27742317777372353535851937790883648493'));

// query count
var query_count = 0;

// share an elliptic curve multiplicatively:
// come up with a random scalar mask, one share would be point * scalar,
// the other shares will be scalars s1, ..., sn such that s1 * .. * sn = (scalar)^-1 mod prime
function multiplicative_share(point) {
  var shares = [];
  var total_mask = new BN(1);
  for (var i = 0; i < urls.length - 1; i++) {
    var r = oprf_.generateRandomScalar();
    total_mask = total_mask.mul(r).mod(prime);
    shares[i+1] = r.toString();
  }

  shares[0] = JSON.stringify(oprf_.scalarMult(point, total_mask.invm(prime).toString()));
  return shares;
}

// first share is a point, then a bunch of scalar multiplicative shares of an inverse
function multiplicative_reconstruct(shares) {
  var total_mask = new BN(1);
  for (var i = 1; i < shares.length; i++) {
    total_mask = total_mask.mul(new BN(shares[i].share));
  }

  return oprf_.scalarMult(shares[0].point, total_mask);
}

// one step in the query, recursive
function get_one_step(source, dest) {
  console.log('query');
  var query_number = query_count++;

  var source_shares = multiplicative_share(JSON.parse(source));
  var dest_shares = multiplicative_share(JSON.parse(dest));

  var promises = [];
  for (var i = 0; i < urls.length; i++) {
    var url = urls[i]+'/query/'+query_number+'/'+source_shares[i]+'/'+dest_shares[i];
    promises.push($.ajax({ type: 'GET', url: url, crossDomain:true }));
  }

  // Receive results from every front-end server
  Promise.all(promises).then(function (results) {
    for (var i = 0; i < results.length; i++) {
      results[i] = JSON.parse(results[i]);
    }

    // Error
    if (results[0].error != null) {
      alert('error');
      console.log(results[0].error);
      return;
    }

    var result = JSON.stringify(multiplicative_reconstruct(results));
    if (result === unreached) {
      alert('Unreachable!');
      return;
    }
    drawPath([ source, result ]); // Draw one step of the path

    // If more steps are left, compute them
    if (result !== dest) {
      get_one_step(result, dest);
    } else {
      console.log('done')
    }
  }, console.log);
}

// eslint-disable-next-line no-unused-vars
function make_query() {
  var source = window.localStorage.getItem('StartPointId');
  var dest = window.localStorage.getItem('StopPointId');

  get_one_step(source, dest);
}
