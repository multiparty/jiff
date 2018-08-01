var jiff_instance = jiff.make_jiff("dummy", "dummy", { autoConnect: false});
jiff_instance.party_count = 4;


var urls = [ "http://localhost:9112", "http://localhost:9113" ];

var query_count = 0;
function get_one_step(source, dest) {
  var query_number = query_count++;

  // Send query to every front-end server
  // TODO: send masked points
  // also send shares of inverses of masks
  // every server needs to salt
  
  var promises = [];
  for(var i = 0; i < urls.length; i++) {
    var url = urls[i]+"/query/"+query_number+"/"+source+"/"+dest;
    promises.push($.ajax({ type: 'GET', url: url, crossDomain:true }));
  }

  // Receive results from every front-end server
  Promise.all(promises).then(function(results) {
    for(var i = 0; i < results.length; i++)
      results[i] = JSON.parse(results[i]);

    // Error
    if(results[0].error != null) {
      console.log(results[0].error);
      return;
    }

    // Success!
    var shares = [];
    for(var i = 0; i < results.length; i++)
      shares.push({ sender_id: results[i].id, value: results[i].result, Zp: jiff_instance.Zp });

    var result = jiff.sharing_schemes.shamir_reconstruct(jiff_instance, shares);
    drawPath([ source, result ]); // Draw one step of the path

    // If more steps are left, compute them
    if(result != dest) get_one_step(result, dest);
  }, console.log);
}


function make_query() {
  // console.log(window.localStorage.getItem("StartPointId"));
  var source = oprf_.hashToPoint(window.localStorage.getItem("StartPointId"));
  var dest = oprf_.hashToPoint(window.localStorage.getItem("StopPointId"));

  get_one_step(source, dest);
}
