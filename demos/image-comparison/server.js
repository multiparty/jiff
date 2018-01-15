const express = require('express');
const app = express();
const http = require('http').Server(app);
const jiff_instance = require('../../lib/jiff-server').make_jiff(http, {logs:true});

jiff_instance.totalparty_map['1'] = 2;

jiff_instance.compute('1', function(computation_instance){
  // perform server-side computation
  console.log('Hello');
});


// Serve static files.
app.use("/demos", express.static("demos"));
app.use("/lib", express.static("lib"));
app.use("/lib/ext", express.static("lib/ext"));
http.listen(8081, function() {
  console.log('listening on *:8081');
});

console.log("Direct your browser to *:8080/demos/imageComparison/index.html.");
// console.log("To run a server-based party: node index.js demos/sum/party");
console.log()


// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({extended: false}));
// app.set('json spaces', 1);


// app.use(function(req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// });

// app.use(express.static(__dirname + '/client'));


// var server = app.listen(8081, function() {
//   console.log('Listening on port %d', server.address().port);
//   console.log('http://localhost:8081/');
// });

// jiffInstance = jiffServer.make_jiff(server, {logs: true});


// jiffInstance.totalparty_map['1'] = 2;

// jiffInstance.compute('1', function(computation_instance) {
//   console.log('hello');
// });

// app.get('/', function(req,res) {
//   res.sendFile((path.join(__dirname + '/client/index.html')));
// });


