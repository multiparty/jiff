var jiff = require('/lib/jiff-client');

const getRequest = function(url) {
  // return new pending promise
  return new Promise((resolve, reject) => {
    // select http or https module, depending on reqested url
    const lib = url.startsWith('https') ? require('https') : require('http');
    //Make ajax call here instead
    // $.ajax({
    //     type: 'GET',
    //     url: url,
    //     datatype: 'json',
    //     success: function (data) {
    //       const body = [];
    //       response.on('data', (chunk) => body.push(chunk));
    //       response.on('end', () => { resolve(body.join('')); });
    //    },
    //     error: function (request, status, error) {
    //       reject(new Error('Failed to load page, status code: ' + response.statusCode));
    //     }
    // });

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

var port = window.location.port;
if(port == null || port == '') 
  port = "80";
var computation_id = $('#computation_id').val();
var hostname = window.location.hostname.trim();
hostname = hostname + ":" + port;
var jiff_instance = jiff.make_jiff( "http://" + hostname, computation_id, { autoConnect: false});
jiff_instance.party_count = 4;

var query_count = 1;

//get source and dest from command line args
// var source = parseInt(process.argv[2], 10);
// var dist = parseInt(process.argv[3], 10);
var source =1 ,dist = 3
function get_one_step(source, dist) {
  //harcoded??
  var query_number = query_count++;
  //souce and dist are integers
  var source_shares = jiff.sharing_schemes.shamir_share(jiff_instance, source, [2, 3, 4], 3, jiff_instance.Zp);
  var dist_shares = jiff.sharing_schemes.shamir_share(jiff_instance, dist, [2, 3, 4], 3, jiff_instance.Zp);

  var promises = [];
  for(var i = 2; i <= 4; i++)
    //make request to 3 frontend servers hosted at 9112,9113,9114. might return async so put a promise for them
    //To each FE server, send one share from source and one from dest
    promises.push(getRequest("http://localhost:911"+i+"/query/"+query_number+"/"+source_shares[i]+"/"+dist_shares[i]));

  //when all promises have returned
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

    //reconstruct jump nodes here. Should save this to Localstorage here.
    var result = jiff.sharing_schemes.shamir_reconstruct(jiff_instance, shares);
    console.log(" -> " + result);
    
    if(result != dist)
      //Need to make one more ajax call.
      get_one_step(result, dist);
    //here else should render path because we have now have entire path from server.
  }).catch(console.log);
}

//make first call for jump node.
get_one_step(source, dist);
