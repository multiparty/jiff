var jiff_instance;

var options = {party_count: 2};
options.onConnect = function() {
  jiff_instance.disconnect();
  console.log("DISCONNECTED");
  
  var onReconnect = function() {
    console.log("RECONNECTED");
    var shares = jiff_instance.share(3);
    var sum = shares[1];
    for(var i = 2; i <= jiff_instance.party_count; i++)
      sum = sum.sadd(shares[i]);
    sum.open(function(v) { console.log(v); jiff_instance.disconnect(); });
  };
  options.onConnect = onReconnect;
  jiff_instance.reconnect();
}

jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'test-sum', options);
