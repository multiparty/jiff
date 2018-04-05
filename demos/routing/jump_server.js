var jiff = require('../../lib/jiff-client');
var jiff_instance = jiff.make_jiff("dummy", "dummy", { autoConnect: false});
jiff_instance.party_count = 4;

var query_count = 1;

var source = parseInt(process.argv[2], 10);
var dist = parseInt(process.argv[3], 10);


function startServer() {
  var express = require('express');
  var app = express();

  // when http://localhost:8080/compute/<input> is called,
  // server recomputes shortest paths according to what is
  // defined in the file: ./<input>.json
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
  });

  app.get('/calculate/:input', function(req, res) {
    console.log("Shortest Path Calculation requested!");
    var params = req.params.input.split(",")
    // var shortest_path_table = compute_shortest_path(req.params.input);
    // mpc_preprocess(shortest_path_table);
    console.log(parseInt(params[0]), parseInt(params[1]))
    var jumps = new Array();
    jumps.push(parseInt(params[0]))
    get_one_step(parseInt(params[0]), parseInt(params[1]), jumps,function(){
      console.log("jumps is" + jumps);
      res.json({ result: jumps });

    });
    // res.send("Recomputed! MPC Preprocessing now underway");
    // res.res.json({ a: 1 });(jumps)
  });

  // Listen to queries from frontends
  // jiff_instance.listen("query", mpc_query);

  // Start listening on port 9111
  app.listen(9115, function() {
    console.log('Jump server is up and listening on 9115');
  });
}




const getRequest = function(url) {
  // return new pending promise
  return new Promise((resolve, reject) => {
    // select http or https module, depending on reqested url
    const lib = url.startsWith('https') ? require('https') : require('http');
    const request = lib.get(url, (response) => {
      // handle http errors
      if (response.statusCode < 200 || response.statusCode > 299) {
        reject(new Error('Failed to load page, status code: ' + response.statusCode));
      }
      // temporary data holder
      const body = [];
      // on every content chunk, push it to the data array
      response.on('data', (chunk) => body.push(chunk));
      // we are done, resolve promise with those joined chunks
      response.on('end', () => { resolve(body.join('')); });
    });
    // handle connection errors of the request
    request.on('error', (err) => reject(err))
  });
};

function get_one_step(source, dist, jumps, callback) {
  var query_number = query_count++;
  var source_shares = jiff.sharing_schemes.shamir_share(jiff_instance, source, [2, 3, 4], 3, jiff_instance.Zp);
  var dist_shares = jiff.sharing_schemes.shamir_share(jiff_instance, dist, [2, 3, 4], 3, jiff_instance.Zp);

  var promises = [];
  for(var i = 2; i <= 4; i++)
    promises.push(getRequest("http://localhost:911"+i+"/query/"+query_number+"/"+source_shares[i]+"/"+dist_shares[i]));

  Promise.all(promises).then(function(results) {
    for(var i = 0; i < results.length; i++)
      results[i] = JSON.parse(results[i]);

    if(results[0].error != null) {
      console.log(results[0].error);
      return;
    }
    
    var shares = [];
    for(var i = 0; i < results.length; i++)
      shares.push({ sender_id: results[i].id, value: results[i].result, Zp: jiff_instance.Zp });

    var result = jiff.sharing_schemes.shamir_reconstruct(jiff_instance, shares);
    console.log(" -> " + result);
    jumps.push(result);
    console.log("result, dist, jumps");
    console.log(result, dist, jumps);
    if(result != dist){
      console.log("passing in")
      console.log(result, dist)
      get_one_step(result, dist, jumps, callback);
    }else{
      //return ajax response with jumps array and let ui keep associations
      callback();
    }
  }).catch(console.log);
}
startServer();
// get_one_step(source, dist);
