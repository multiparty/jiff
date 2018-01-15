var jiff_instance;

// function createRandomArr(len) {
//   var arr = [];
//   for (var i = 0; i < len; i++) {
//     arr.push(Math.floor(Math.random() * 10));
//   }
//   return arr;
// }


function compare(hashed) {

  var samePic = true;

  var shares = jiff_instance.share(hashed);
  var equal = shares[1];
  equal = equal.eq(shares[2]);
  equal.open(function(result) {
    var h = document.createElement('h6');
    var t;
    if (result === 1) {
      t = document.createTextNode('Pictures are the same');
    } else {
      t = document.createTextNode('Pictures are different');      
    }
    h.appendChild(t);
    var resultDiv = document.getElementById('result');
    resultDiv.appendChild(h);
  });
}




String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

function process() {
  var file = document.getElementById('fileUpload');
  file = file.files[0];

 
 
  var reader = new FileReader();

  reader.onload = function() {
    var img = new Image();
    img.onload = function() {
      var canvas = document.getElementById('canvas');
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img,0,0);
      var base64 = canvas.toDataURL('image/png');
      base64 = base64.replace(/^data:image\/(png|jpg);base64,/, "")
      base64 = base64.hashCode();
      
      compare(base64);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}


function connect() {

  $('#connectBtn').prop('disabled', true);
  var computation_id = 1;
  var party_count = 2;
  if(isNaN(party_count)) {
    // $("#output").append("<p class='error'>Party count must be a valid number!</p>");
    $('#connectBtn').prop('disabled', false);
  } else {
    var options = { party_count: party_count};
    // options.onError = function(error) { $("#output").append("<p class='error'>"+error+"</p>"); };
    // options.onConnect = function() { $("#sumButton").attr("disabled", false); $("#output").append("<p>All parties Connected!</p>"); };
    
    var hostname = window.location.hostname.trim();
    var port = window.location.port;
    if(port == null || port == '') 
      port = "8081";
    if(!(hostname.startsWith("http://") || hostname.startsWith("https://")))
      hostname = "http://" + hostname;
    if(hostname.endsWith("/"))
      hostname = hostname.substring(0, hostname.length-1);
    if(hostname.indexOf(":") > -1)
      hostanme = hostname.substring(0, hostname.indexOf(":"));

    hostname = hostname + ":" + port;
    jiff_instance = jiff.make_jiff(hostname, computation_id, options);
  }
}



