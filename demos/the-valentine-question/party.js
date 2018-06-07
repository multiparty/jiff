var jiff_instance;

function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = parseInt($('#count').val());


  var options = {party_count:2};
  options.onError = function(error) { $("#output").append("<p class='error'>"+error+"</p>"); };
  options.onConnect = function() { $("#submit").attr("disabled", false); $("#output").append("<p>All parties Connected!</p>"); };
  
  var hostname = window.location.hostname.trim();
  var port = window.location.port;
  if(port == null || port == '') 
  port = "80";
  if(!(hostname.startsWith("http://") || hostname.startsWith("https://")))
  hostname = "http://" + hostname;
  if(hostname.endsWith("/"))
  hostname = hostname.substring(0, hostname.length-1);

  hostname = hostname + ":" + port;
  jiff_instance = jiff.make_jiff(hostname, computation_id, options);
  
}

function submit() {
  var input = $('input[name=choice]:checked').val() == 'yes' ? true : false;
  $("#sumButton").attr("disabled", true);
  $("#output").append("<p>Starting...</p>");
  var shares = jiff_instance.share(input);
  var result = valentine(shares);
  result.open(handleResult);   
}

function valentine(shares) {
  return shares[1].smult(shares[2]);
         
}

function handleResult(result) {
  $("#output").append("<p>Result is: " + result + "</p>");
  $("#sumButton").attr("disabled", false);
}