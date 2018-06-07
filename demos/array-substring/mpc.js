(function(exports, node) {

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    if(node)
      jiff = require('../../lib/jiff-client');

    return jiff.make_jiff(hostname, computation_id, options);
  };

  exports.compute = function(asciiCode, displaySubstring, jiff_instance) {
    jiff_instance.share_array(asciiCode).then(function(shares) {
      // loop over all the possible starting points of the substring.        
      for(let i = 0; i <= shares[1].length - shares[2].length; i++) {
        // compare all the characters till the end of the substring.
        let comparison = shares[1][i].eq(shares[2][0]);
        for(let j = 1; j < shares[2].length; j++)
          comparison = comparison.mult(shares[1][i+j].eq(shares[2][j]));

        (function(index) {
          comparison.open(function(result) {
            // if all characters are equivalent
            if(result === 1)
              displaySubstring(index);
          });
        })(i);
      }
    });
  }
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));