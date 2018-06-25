/**
 * Do not change this unless you have to.
 * This code parses input command line arguments, 
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log("Command line arguments: <input> [<party count> [<computation_id> [<party id>]]]]");


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


var stdin = process.openStdin();
var mpc = require('./mpc');

// Read Command line arguments
var input = JSON.parse(process.argv[2]);

var party_count = process.argv[3];
if(party_count == null) party_count = 2;
else party_count = parseInt(party_count);

var computation_id = process.argv[4];
if(computation_id == null) computation_id = 'test';

var party_id = process.argv[5];
if(party_id != null) party_id = parseInt(party_id, 10);

// JIFF options
var options = {party_count: party_count, party_id: party_id};
options.onConnect = function(jiff_instance) {
  var promise = mpc.submitArray(input).then(function(sortedShares) {
    root = makeTree(sortedShares, 0, sortedShares.length-1);
    console.info("Tree generated");
  });
};

// Connect
mpc.connect("http://localhost:8080", computation_id, options);


stdin.on("data", input => {
  try {
    let stringInput = input.toString().trim();
    if (stringInput === "open")
      mpc.openTree(nodesCount, root).then(displayTree);
    else {
      let number = parseInt(stringInput);
      mpc.exists(nodesCount, root, parseInt(number)).then(existsThen);
    }
  } catch(error) {
    console.log(error.message);
  }
});

const displayTree = (node, string) => {
  if(!node)
      return;
  console.info(string + ": " + node.openedValue);
  displayTree(node.left, string + ",left");
  displayTree(node.right, string + ",right");
}

const existsThen = (result, query) => result === 0 ? console.info(query + " does not exist.") : console.info(query + " exists!");
