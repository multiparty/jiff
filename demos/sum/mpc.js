(function(exports, node) {
  var jiff_instance;

  exports.connect = function (hostname, computation_id, options) {
    if(node)
      jiff = require('../../lib/jiff-client');

    jiff_instance = jiff.make_jiff(hostname, computation_id, options);
  }

  exports.mpc = function (input) {
    var shares = jiff_instance.share(input);
    var sum = shares[1];
    for(var i = 2; i <= jiff_instance.party_count; i++) {
      sum = sum.sadd(shares[i]);
    }
    return jiff_instance.open(sum);
  }
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
