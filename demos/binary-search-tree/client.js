/**
 * Do not modify this file unless you have too
 * This file has UI handlers.
 */

function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = parseInt($('#count').val());

  if(isNaN(party_count)) {
    $("#output").append("<p class='error'>Party count must be a valid number!</p>");
    $('#connectButton').prop('disabled', false);
  } else {
    var options = { party_count: party_count};
    options.onError = function(error) { $("#output").append("<p class='error'>"+error+"</p>"); };
    options.onConnect = function() {
      $("#submitButton").attr("disabled", false);
      $("#result").append("All parties Connected!<br/>");
    };
    
    var hostname = window.location.hostname.trim();
    var port = window.location.port;
    if(port == null || port == '') 
      port = "80";
    if(!(hostname.startsWith("http://") || hostname.startsWith("https://")))
      hostname = "http://" + hostname;
    if(hostname.endsWith("/"))
      hostname = hostname.substring(0, hostname.length-1);
    if(hostname.indexOf(":") > -1 && hostname.lastIndexOf(":") > hostname.indexOf(":"))
      hostname = hostname.substring(0, hostname.lastIndexOf(":"));

    hostname = hostname + ":" + port;
    mpc.connect(hostname, computation_id, options);
  }
}

const submitArray = (inputArray) => {
  let arr = JSON.parse(inputArray);
  for (let i = 0; i < arr.length; i++)
    if (typeof arr[i] !== 'number') {
      alert("Please enter an array of numbers");
      return;
    }
  $("#submitButton").attr("disabled", true);

  let promise = mpc.submitArray(arr);
  promise.then(submitArrayThen);
}

const submitArrayThen = (sortedShares) => {
  root = makeTree(sortedShares, 0, sortedShares.length-1);

  $("#openButton").attr("disabled", false);
  $("#buttonCheckIfExists").attr("disabled", false);
  $("#result").append("Tree generated!<br/>");
}

//const data = {};
let root;
let nodesCount = 0;
class Node {
  constructor(share, leftNode, rightNode) {
    this.share = share;
    this.left = leftNode;
    this.right = rightNode;
    this.openedValue = null;
  }
}

const makeTree = function(arr, start, end) {
  if (start > end)
    return null;
  ++nodesCount;
  const middle = Math.floor((start + end) / 2);
  const node = new Node(arr[middle], makeTree(arr, start, middle-1), makeTree(arr, middle+1, end));
  return node;
}

const openTree = () => mpc.openTree(nodesCount, root).then(displayTree);

const displayTree = (node, string) => {
  if(!node)
      return;
  $("#result").append(string + ": " + node.openedValue + "<br/>");
  displayTree(node.left, string + ",left");
  displayTree(node.right, string + ",right");
}

const checkIfExists = (inputCheckIfExists) => mpc.exists(nodesCount, root, parseInt(inputCheckIfExists)).then(existsThen);


const existsThen = (result, query) => {
  result === 0 ? $("#result").append(query, " doesn't exist.<br/>") : $("#result").append(query, " exists!<br/>");
  $("#buttonCheckIfExists").attr("disabled", false);
}
