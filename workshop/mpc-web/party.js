// Read command line arguments
var args = process.argv.slice(2);
var input = parseInt(args[0], 10);
var id = args[1];
if (id != null) {
  id = parseInt(id, 10);
}

var jiff = require('../../lib/jiff-client');
var jiff_instance = jiff.make_jiff('http://localhost:8080', '1', { party_id: id });

// Wait for server to connect
jiff_instance.wait_for([1, 's1'], function () {
  console.log('Connected! ID: ' + jiff_instance.id);
  jiff_instance.share(input, 2, [1, 's1'], [ jiff_instance.id ]);
  console.log('Shared!');
});

