"use strict";
let jiff_instance;
let computation_id;
let party_count;

let root;

const connect = function() {
    computation_id = $('#computation_id').val();
    party_count = parseInt($('#count').val());
    if(!computation_id || !party_count)
        return;
    $("#connectButton").attr("disabled", true);

    let hostname = window.location.hostname.trim();
    let port = window.location.port;
    if(port == null || port == '')
        port = "8080";
    if(!(hostname.startsWith("http://") || hostname.startsWith("https://")))
        hostname = "http://" + hostname;
    if(hostname.endsWith("/"))
        hostname = hostname.substring(0, hostname.length-1);
    hostname = hostname + ":" + port;

    // Create an MPC instance and connect
    MPCconnect(hostname, computation_id, party_count);
}

const MPCconnect = function(hostname, computation_id, party_count) {
    var options = { 'party_count': party_count };
    options.onError = function(error) { $("#result").append("<p class='error'>"+error+"</p>"); };
    options.onConnect = function() {
        $("#submitButton").attr("disabled", false);
        $("#result").append("All parties Connected!<br/>");
    };

    jiff_instance = jiff.make_jiff(hostname, computation_id, options);
}

let nodesCount = 0;
class Node {
    constructor(share, leftNode, rightNode) {
        this.share = share;
        this.left = leftNode;
        this.right = rightNode;
        this.openedValue = null;
    }
}

const submitArray = function() {
    $("#submitButton").attr("disabled", true);
    let arr = JSON.parse(document.getElementById('inputText').value);

    for(let i = 0; i < arr.length; i++) {
        if(typeof arr[i] !== 'number') {
            return;
        }
    }

    jiff_instance.share_array(arr, null, function(_, arr) {
        let concat = [];
        for(let party in arr)
            concat = [...concat, ...arr[party]];

        const sortedShares = bubbleSort(concat);

        root = makeTree(sortedShares, 0, sortedShares.length-1);

        $("#openButton").attr("disabled", false);
        $("#buttonCheckIfExists").attr("disabled", false);
        $("#result").append("Tree generated!<br/>");
    });
}

const makeTree = function(arr, start, end) {
    if(start > end)
        return null;
    ++nodesCount;
    ++openedNodesCounter;
    const middle = Math.floor((start + end) / 2);
    const node = new Node(arr[middle], makeTree(arr, start, middle-1), makeTree(arr, middle+1, end));
    return node;
}

const bubbleSort = function(arr) {
    for (var i = 0; i < arr.length; i++)
        for (var j = 0; j < (arr.length - i - 1); j++) {
            var a = arr[j];
            var b = arr[j+1];
            var c = a.lt(b);
            var d = c.not();
            arr[j] = (a.mult(c)).add((b.mult(d)));
            arr[j+1] = (a.mult(d)).add((b.mult(c)));
        }
    return arr; 
}

let openedNodesCounter = 0;
const openTree = function(node, root) {
    if(node) {
        (function(n) {
            n.share.open(function(o) {
                n.openedValue = o;
                if(--openedNodesCounter === 0) {
                    displayTree(root, "root");
                }
            });
        })(node);

        openTree(node.left, root);
        openTree(node.right, root);
    }
}

const displayTree = function(node, string) {
    if(!node)
        return;
    $("#result").append(string + ": " + node.openedValue + "<br/>");
    displayTree(node.left, string+",left");
    displayTree(node.right, string+",right");
}

let exists;
let checkIfExistsNodesCounter = 0;
const checkIfExists = function(node, query) {
    if(node) {
        exists = exists ? exists.add(node.share.eq(query)) : node.share.eq(query);
        checkIfExists(node.left, query);
        checkIfExists(node.right, query);
        if(++checkIfExistsNodesCounter === nodesCount) {
            checkIfExistsNodesCounter = 0;
            exists.open(function(exists_opened) {
                if(exists_opened === 0)
                    $("#result").append(query, " doesn't exist.<br/>");
                else
                    $("#result").append(query, " exists!<br/>");
                exists = null;
                $("#buttonCheckIfExists").attr("disabled", false);                
            });
        }
    }
}