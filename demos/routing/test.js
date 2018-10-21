var jiff = require('../../lib/jiff-client');

var getRequest = function (url) {
  // return new pending promise
  return new Promise(function (resolve, reject) {
    // select http or https module, depending on reqested url
    var lib = url.startsWith('https') ? require('https') : require('http');
    var request = lib.get(url, function (response) {
      // handle http errors
      if (response.statusCode < 200 || response.statusCode > 299) {
        reject(new Error('Failed to load page, status code: ' + response.statusCode));
      }
      // temporary data holder
      var body = [];
      // on every content chunk, push it to the data array
      response.on('data', function (chunk) {
        body.push(chunk);
      } );
      // we are done, resolve promise with those joined chunks
      response.on('end', function () {
        resolve(body.join(''));
      });
    });
    // handle connection errors of the request
    request.on('error', function (err) {
      reject(err);
    });
  });
};

var jiff_instance = jiff.make_jiff('dummy', 'dummy', { autoConnect: false});
jiff_instance.party_count = 3;

var query_count = 1;

var source = parseInt(process.argv[2], 10);
var dist = parseInt(process.argv[3], 10);
var jumps = new Array();
function get_one_step(source, dist) {
  var query_number = query_count++;

  var promises = [];
  for (var i = 2; i <= 3; i++) {
    promises.push(getRequest('http://localhost:911'+i+'/query/'+query_number+'/'+source+'/'+dist));
  }

  Promise.all(promises).then(function (results) {
    var i;
    for (i = 0; i < results.length; i++) {
      results[i] = JSON.parse(results[i]);
    }

    if (results[0].error != null) {
      console.log(results[0].error);
      return;
    }

    var shares = [];
    for (i = 0; i < results.length; i++) {
      shares.push({ sender_id: results[i].id, value: results[i].result, Zp: jiff_instance.Zp });
    }

    var result = jiff.sharing_schemes.shamir_reconstruct(jiff_instance, shares);
    console.log(' -> ' + result);
    jumps.push(result);
    if (result !== dist) {
      get_one_step(result, dist);
    } else {
      //return ajax response with jumps array and let ui keep associations

    }
  }).catch(console.log);
}

get_one_step(source, dist);
