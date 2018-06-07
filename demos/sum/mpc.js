(function(exports, node) {
  exports.mpc = function (jiff_instance, input) {
    var shares = jiff_instance.share(input);
    var sum = shares[1];
    for(var i = 2; i <= jiff_instance.party_count; i++) {
      sum = sum.sadd(shares[i]);
    }
    return jiff_instance.open(sum);
  }  
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
