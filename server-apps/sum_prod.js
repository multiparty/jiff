var jiff_instance;
var jiff = require('../lib/jiff-client');

var options = {party_count: 2};
options.onConnect = function() {
  var shares = jiff_instance.share(3, null, [1, 2], [1, 2, "s1"]);
  var shares2 = jiff_instance.share(5, 1, ["s1"], [1, 2]);

  var arr = [];
  for(var i in shares)
    arr.push(shares[i]);

  var r = arr[0].add(arr[1]);
  r = r.mult(arr[2]);
  
  var p1 = r.open(console.log);
  var p2 = jiff_instance.receive_open(["s1"]).then(function(result) { console.log("11 is: " + result); });
  
  Promise.all([p1, p2]).then(jiff_instance.disconnect);
}

jiff_instance = jiff.make_jiff("http://localhost:3000", 'test-sum', options);



