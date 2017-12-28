var express = require('express');
var app = express();
var http = require('http').Server(app);
var jiff_instance = require('./lib/jiff-server').make_jiff(http, { logs: false });

// Join computation with id "test-sum" when computation is setup.
jiff_instance.compute('test-sum', { onConnect:
  function(computation_instance) {
    // computation_instance provides identical api to client's jiff_instance.
    console.log("HELLO");

    // Perform server side computation
    // share server's input (10) with parties 1 and 2.
    computation_instance.share(10, null, [1,2], [1, 2, "s1"]); // s1 is not a receiver, no result

    // receive two shares from parties 1 and 2 with threshold 1 (so that server can manipulat them).
    var shares = computation_instance.share(null, 1, ["s1"], [1, 2]);

    // Silly operation on received shares.
    var r = shares[1].sadd(shares[2]).cadd(1);

    // Open the result, by default, the receivers of an open are all non-server parties.
    r.open(console.log);
    
    // Finally, multiply something shared by everyone
    var new_shares = computation_instance.share(5, 3, ["s1", 1, 2], [1, 2, "s1"]);
    r = new_shares[1].smult(new_shares[2]).smult(new_shares["s1"]).sadd(new_shares[2].slteq(new_shares[1]));
    computation_instance.open(r, [1, 2, "s1"]).then(console.log);
  }
});

// Server static files
app.use("/apps", express.static("apps"));
app.use("/lib", express.static("lib"));
app.use("/modules", express.static("modules"));
app.use("/tests", express.static("tests/positive"));
http.listen(3000, function() {
  console.log('listening on *:3000');
});

