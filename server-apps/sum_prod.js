var jiff_instance;

var options = {party_count: 2};
options.onConnect = function() {
  var shares = jiff_instance.share(3);
  var arr = [];
  for(var i in shares)
    arr.push(shares[i]);
  
  var r = arr[0].add(arr[1]).mult(arr[2]);  
  r.open(console.log);
}

jiff_instance = require('../lib/jiff-client').make_jiff("http://localhost:3000", 'test-sum', options);



