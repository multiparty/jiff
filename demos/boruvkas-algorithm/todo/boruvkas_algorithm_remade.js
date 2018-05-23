"use strict";
let jiff_instance;
let party_count;


/**
 * A Node has an ID, an x-coordinate and a y-coordinate
 */
class Node {
    constructor(ID, posX, posY) {
        this.ID = ID;
        if(posX && posY) {
            this.posX = posX;
            this.posY = posY;
        } else {
            let {newXPos, newYPos} = graph.getNewPosition();
            this.posX = newXPos;
            this.posY = newYPos;
        }
    }
}

/**
 * An Edge connects two nodes.
 * 
 * The value of the edge can be a share or a number.
 */
class Edge {
    constructor(startNode, endNode, share, weight) {
        this.startNode = startNode;
        this.endNode = endNode;
        // the edge has either a weight or a shared weight
        this.share = share;
        this.weight = weight;
    }
}

class Tree {
    constructor(node) {
        this.nodes = new Set([node]);
        this.edges = []; // array of Edges
    }
}

const forest = []; // array of trees


/**
 * Holds the data belonging to one party.
 */
class PartyData {
    constructor() {
        this.sharedEdgesArray = [];
        this.receivedNodes = null;
        this.edgesBeingShared = [];
    }
}
const partiesData = {}; // {party_id => PartyData}

/**
 * Holds the data that's more related to this party, some of which may not
 * be shared in the computation at all.
 */
class Local {
    constructor() {
        this.nodes = new Set(); //allLocalNodes

        this.edges = []; //edges input by the user. shared edges stay here

        this.edgesBeingShared = []; //edges that were owned but now being shared

        // owned nodes and their surrounding edges
        this.ownedNodes = new Set();
        this.ownedEdges = [];
    }

    addUserInputEdge(edge) {
        this.nodes.add(edge.startNode.ID);
        this.nodes.add(edge.endNode.ID);
        this.edges.push(edge);
    }

    /**
     * Determine which edges does this party own and move them from edges to ownedEdges.
     * 
     * Owned nodes was populated through mpc.
     */
    determineOwnedEdges() {
        // loop over the input edges
        for(let i = 0; i < this.edges.length; i++) {
            // if the edge is between two owned nodes, remove it from public edges and add it to the owned edges
            if(this.ownedNodes.has(this.edges[i].startNode.ID) && this.ownedNodes.has(this.edges[i].endNode.ID)) {
                this.edgesBeingShared.push(this.edges[i]);
                this.ownedEdges.push(this.edges.splice(i--, 1)[0]);
            }
        }
        //make a set of local.nodes?
    }
}


const allNodes = new Set();
const foreignNodes = new Set(); // nodes owned by any party including this party.
const otherParties = []; //array of other parties ex: [2,3]

/**
 * Class responsible for displaying things for the user.
 */
class Graph {
    constructor(elementId) {

        /**
         * Array of edges
         */
        const edges = [];

        /**
         * The cytoscape graph!
         */
        this._cy = cytoscape({
            container: document.getElementById(elementId), // container to render in

            // should work but it causes problems with the position
            // elements: [ // list of graph elements to start with
            //   { // node a
            //     data: { id: 'origin' , position:{x:0, y:0}}
            //   }
            // ],

            style: [ // the stylesheet for the graph
                {
                    selector: 'node',
                    style: {
                        'background-color': '#666',
                        'label': 'data(id)'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 3,
                        'line-color': '#ccc',
                        'target-arrow-color': '#ccc',
                        'target-arrow-shape': 'triangle'
                    }
                },
                {
                    selector: 'edge[type="solution"]',
                    style: {
                        'width': 10,
                        'line-color': '#f00',
                        'target-arrow-color': '#f00',
                        'target-arrow-shape': 'triangle'
                    }
                },
                {
                    selector: 'node[type="origin"]',
                    style: {
                        'background-color': '#666',
                        'label': 'data(id)',
                        'width':10,
                        'height':10
                    }
                },
            ],

            layout: {
                name: 'grid',
                rows: 1
            }
            // should work but it doesn't work
            // ,zoom: 221,
            // pan: { x: 0, y: 0 },
        });
        this._cy.zoom({
            level: 0.8,
            renderedPosition: { x: 300, y: 300 }
        });
        this._cy.add({
            group: 'nodes',
            data:{ id:'origin', type:'origin', position: {x:0, y:0}}
        });
        this._cy.getElementById('origin').ungrabify();

        // Variables holding default values for adding new nodes
        this.newXPos = 100;
        this.newYPos = 0;
        this.newPosJump = 100;
    }
    
    demoA1() {
        addEdge('A', 'B', 13, 150, 150, 50, 250);
        addEdge('B', 'C', 7, null, null, 250, 250);
        addEdge('A', 'C', 6);
        addEdge('B', 'D', 1, null, null, 50, 350);
        addEdge('D', 'C', 14);
        addEdge('C', 'E', 8, null, null, 250, 350);
    }
    demoA2() {
        addEdge('F', 'E', 2, 150, 450, 250, 350);
        addEdge('E', 'J', 18, null, null, 350, 350);
        addEdge('D', 'F', 3, 50, 350);
        addEdge('E', 'D', 9, null, null);
    }
    demoA3() {
        addEdge('G', 'H', 15, 425, 150, 350, 250);
        addEdge('G', 'I', 5, null, null, 500, 250);
        addEdge('G', 'K', 10, null, null, 500, 350);
        addEdge('L', 'K', 12, 425, 450);
        addEdge('I', 'K', 11);
        addEdge('C', 'H', 20, 250, 250);
        addEdge('H', 'J', 17, null, null, 350, 350);
        addEdge('J', 'L', 4);
        addEdge('J', 'K', 16);
        addEdge('G', 'J', 19);
    }

    /**
     * Get a default value for the node and setup the next
     * default value for the next input node.
     */
    getNewPosition() {
        let r = {newXPos:this.newXPos, newYPos:this.newYPos};
        this.newXPos += this.newPosJump;
        if(this.newXPos == 700) {
            this.newXPos = 0;
            this.newYPos += this.newPosJump;
        }
        return r;
    }

    makeNodeObject(edge) {
        let start = this._cy.getElementById(edge.startNode.ID);
        let end = this._cy.getElementById(edge.endNode.ID);
        return {
            start:edge.startNode.ID, startX:start.position('x'), startY:start.position('y'),
            end:edge.endNode.ID, endX:end.position('x'), endY:end.position('y')
        }
    }

    /**
     * Display the node if it doesn't already exist.
     * 
     * @param {string} id - The ID of the node
     * @param {number} [x=newXPos] - (Optional) X coordinate for the node if it doesn't already exist.
     * @param {number} [y=newYPos] - (Optional) Y coordinate for the node if it doesn't already exist.
     */
    tryDisplayNode(node) {
        let exists = this._cy.getElementById(node.ID);
        if(exists.length == 0)
            this._cy.add({
                group: 'nodes',
                data: {
                    id:node.ID,
                },
                position: {
                    x:node.posX,
                    y:node.posY
                }
            });
    }

    displayEdge(edge, type) {
        this.tryDisplayNode(edge.startNode);
        this.tryDisplayNode(edge.endNode);
        let w = edge.weight ? edge.weight.toString() : '';
        this._cy.add({
            group: 'edges',
            data: {
                source: edge.startNode.ID,
                target: edge.endNode.ID,
                type: type
            },
            style: {
                label:w
            }
        });
    }
}

const graph = new Graph('cy');
const local = new Local();
// const data = new Data();


const connect = function() {
    $('#connectButton').prop('disabled', true);
    var computation_id = $('#computation_id').val();
    party_count = parseInt($('#count').val());

    if(isNaN(party_count)) {
        $("#output").append("<p class='error'>Party count must be a valid number!</p>");
        $('#connectButton').prop('disabled', false);
    } else {
        const options = { party_count: party_count };
        options.onError = function(error) { $("#output").append("<p class='error'>"+error+"</p>"); };
        options.onConnect = function() {
            $("#addEdge").attr("disabled", false);
            $("#start").attr("disabled", false);
            $("#output").append("<p>All parties Connected!</p>");
            
            for(let i = 1; i <= party_count; i++) {
                partiesData[i] = new PartyData();
                if(i !== jiff_instance.id)
                    otherParties.push(i);
            }

            jiff_instance.listen("nodes-list", nodesListHandler);
            jiff_instance.listen("edges-list", edgesListHandler);
            jiff_instance.listen("foreign-computation-result", foreignComputationResultHandler);
            jiff_instance.listen("cut-lists", cutListsHandler);
        }
        
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
}


/**
 * Adds an edge that was input by the user to the graph, creating the nodes if they don't exist. 
 */
function addEdge(startNode, endNode, weight, sPosX, sPosY, ePosX, ePosY) {
    // let startNode = document.getElementById("start_node").value,
    //     endNode = document.getElementById("end_node").value,
    //     weight = document.getElementById("weight").value;
    let parsedWeight = parseFloat(weight);
    if(isNaN(parsedWeight) || parsedWeight != Math.floor(parsedWeight) || parsedWeight < 0) {
        alert('Values must be positive integers only.');
        return;
    }
    if(startNode === endNode) {
        alert("Please add edges that join together two different nodes.");
        return;
    }

    // display first node if it doesn't exist
    // graph.tryDisplayNode(startNode);
    // display second node if it doesn't exist
    // graph.tryDisplayNode(endNode);

    let edge = new Edge(new Node(startNode, sPosX, sPosY), new Node(endNode, ePosX, ePosY), null, parsedWeight);
    // add edge between the two nodes
    graph.displayEdge(edge, '');

    // push object to the edges array for mpc
    local.addUserInputEdge(edge);
}

/**
 * The user has completed submitting his inputs. 
 */
const start = function() {
    if(local.edges.length == 0) {
        alert("Please add at least one edge");
        return;
    }
    $("#addEdge").attr("disabled", true);
    $("#start").attr("disabled", true);
    console.time('Total');
    console.time('Iteration');

    jiff_instance.emit("nodes-list", null, JSON.stringify(Array.from(local.nodes)));
}


// counter variables for nodesListHandler
let nlPartyPointer = 1;
let nlSumCounter = 0;
const nodesListHandler = function(sender, receivedData) {
    partiesData[sender].receivedNodes = new Set(JSON.parse(receivedData));
    if(sender === nlPartyPointer)
        while(partiesData[nlPartyPointer] &&
            partiesData[nlPartyPointer].receivedNodes) {
            for (let elem of partiesData[nlPartyPointer].receivedNodes) {
                allNodes.add(elem);
            }
            ++nlPartyPointer;
        }
    if(nlPartyPointer-1 == party_count) {
        for(let nodeID of allNodes) {
            // forest.push(new Tree(nodeID));

            let share;
            if(local.nodes.has(nodeID))
                share = jiff_instance.share(1);
            else
                share = jiff_instance.share(0);

            let sum = share[1];
            for(var i = 2; i <= jiff_instance.party_count; i++)
                sum = sum.add(share[i]);
                
            ++nlSumCounter;
            (function(nodeID) {
                sum.open(function(sum_opened) {
                    if(sum_opened === 1) { // if only one party has edges connecting to that node
                        if(local.nodes.has(nodeID)) // if it's us
                            local.ownedNodes.add(nodeID);
                        foreignNodes.add(nodeID); // add that node to the set of foreign nodes anyway
                    }
                    if(--nlSumCounter === 0) {
                        local.determineOwnedEdges(); //first iteration we can easily know which edges we own
                        // spark(); return;
                        const tagsArray = local.edges.map(e => graph.makeNodeObject(e));
                        jiff_instance.emit("cut-lists", null, JSON.stringify({subscribe:local.ownedNodes.size > 0, array:tagsArray}));
                    }
                });         
            })(nodeID);
        }
    }
}


// const foreignComputationSubscribtions = [];
// let receivedEdgesList = 0;
const edgesListHandler = function(s,r){}
// const edgesListHandler = function(sender, receivedData) {
//     let edgesList = JSON.parse(receivedData);
//     console.log(edgesList);

//     partiesData[sender].sharedEdgesArray = edgesList.array.map(edgeObject => new Edge(new Node(edgeObject.start, edgeObject.startX, edgeObject.startY), new Node(edgeObject.end, edgeObject.endX, edgeObject.endY)));
//     if(edgesList.subscribe) {
//         if(foreignComputationSubscribtions.indexOf(sender) == -1)
//             foreignComputationSubscribtions.push(sender);
//     }

//     // Loop over the tagList and display missing nodes if any
//     partiesData[sender].sharedEdgesArray.forEach(edge => {
//         graph.tryDisplayNode(edge.startNode);
//         graph.tryDisplayNode(edge.endNode);
//     });

//     // Check the tag lists
//     if(++receivedEdgesList == party_count) {
//         $("#output").append("<p>Computation Starting!</p>");

//         // spark(); return;

//         const edgeWeights = local.edges.map(edge => edge.weight);
//         jiff_instance.share_array(edgeWeights, function(shares_array) {
//             shares_array.forEach((share, i) => {
//                 for(let p in share) { // if the extra shares were shuffled this might fail
//                     if(partiesData[p].sharedEdgesArray[i])
//                     partiesData[p].sharedEdgesArray[i]["share"] = share[p];
//                 }
//             });
//             console.log(partiesData);
    
//             // Start looping!
//             // mpcIterate(generateNodesList());
//             // if(ownedNodes.size > 0)
//             //     localComputation();
//         });
//     }
// }

//trying to mimic ShareCutLists
let c1 = 0;
const spark = function() {
    if(forest.length = 0) {
        
    } else {

    }
    // let edgesListToShare = [];
    // c1 = 0;
    // for(let i = 0; i < forest.length; i++) {
    //     let tree = forest[i];

    //     let weOwnIt = true;
    //     for(let party in partiesData) {

    //     }
    // }
}





const foreignComputationSubscribtions = [];
let receivedForeignComputations = 0;
let incompletePromises = 0;

let ownedTreesCounter = 0;

// const shareCutLists = function() {}
let receivedCutListsCounter = 0;
const cutListsHandler = function(sender, receivedData) {
    let parsed = JSON.parse(receivedData);
    partiesData[sender].edgesBeingShared = parsed.array.map(edgeObject => new Edge(
        new Node(edgeObject.start, edgeObject.startX, edgeObject.startY),
        new Node(edgeObject.end, edgeObject.endX, edgeObject.endY)
    ));
    if(parsed.subscribe)
        if(foreignComputationSubscribtions.indexOf(sender) == -1)
            foreignComputationSubscribtions.push(sender);
    if(!parsed.subscribe && foreignComputationSubscribtions.indexOf(sender) > -1)
        foreignComputationSubscribtions.splice(foreignComputationSubscribtions.indexOf(sender), 1);

    // Loop over the tagList and add missing nodes if any
    partiesData[sender].edgesBeingShared.forEach(edge => {
        graph.tryDisplayNode(edge.startNode);
        graph.tryDisplayNode(edge.endNode);
    });

    // Check the tag lists
    if(++receivedCutListsCounter === party_count) {
        const edgeWeights = local.edgesBeingShared.map(edge => edge.weight);
        jiff_instance.share_array(edgeWeights, function(shares_array) {
            shares_array.forEach((share, i) => {
                for(let p in share) { // if the extra shares were shuffled this might fail
                    if(partiesData[p].edgesBeingShared[i])
                        partiesData[p].edgesBeingShared[i].share = share[p];
                }
            });
            for(let p in partiesData) {
                partiesData[p].edgesBeingShared.forEach(s => {
                    partiesData[p].sharedEdgesArray.push(s);
                });
            }
            for(let i = 0; i < local.edgesBeingShared.length; i++) {
                edges.push(local.edgesBeingShared[i]);
            }
            local.edgesBeingShared = [];





            // Start looping!
            mpcIterate(generateNodesList());
            if(ownedTreesCounter > 0)
                localComputation();
        });
    }
}

let ownersCounter = 0;
const localComputation = function() {
    let res = [];
    let splices = [];

    for(let node of local.ownedNodes) {
        let minimumEdge;
        let minimumEdgeWeight = Infinity;
        let owned = false;
        let index;
        local.edges.forEach((edge, i) => {
            if((edge.start === node || edge.end === node) && edge.weight < minimumEdgeWeight) {
                minimumEdge = edge;
                minimumEdgeWeight = edge.weight;
                index = i;
            }
        });
        local.ownedEdges.forEach((edge, i) => {
            if((edge.start === node || edge.end === node) && edge.weight < minimumEdgeWeight) {
                minimumEdge = edge;
                minimumEdgeWeight = edge.weight;
                owned = true;
                index = i;
            }
        });
        if(minimumEdge) {
            res.push(minimumEdge);
            addArcToForest(minimumEdge, 'solution');
            splices.push({owned:owned, index:index});
        }
    }
    splices.forEach(s => {
        if(s.owned)
            local.ownedEdges[s.index] = null;
        else
            edges[s.index] = null;
    });
    ownedEdges = ownedEdges.filter(e => e);
    edges = edges.filter(e => e);
    

    let resSend = res.map(edge => graph.makeNodeObject(edge));


    ++ownersCounter;
    jiff_instance.emit("foreign-computation-result", otherParties, JSON.stringify(resSend));
}

/**
 * Adds an arc to the forest.
 * Finds a tree containing one of the arc's two nodes and adds the arc to the tree.
 * Keeps looping over the forest and if it finds another tree having one of the nodes
 * of the arc it merges the two trees into one.
 */
const addArcToForest = function(newArc, type) {
    let added = null;
    let indexOfAdded;
    // loop over the trees of the forest
    for(let i = 0; i < forest.length; i++) {
        let tree = forest[i];
        // loop over the arcs of the tree
        for(let j = 0; j < tree.edges.length; j++) {
            let arc = tree.edges[j];
            // if one of the nodes of the arc is in this tree add that arc to the tree
            if
            (
                arc.startNode.ID === newArc.startNode.ID ||
                arc.startNode.ID === newArc.endNode.ID || 
                arc.endNode.ID === newArc.startNode.ID || 
                arc.endNode.ID === newArc.endNode.ID
            ) {
                // if that arc wasn't added to any tree before add it to this tree
                if(!added) {
                    // add that arc to the tree
                    addArcToTree(tree, newArc);
                    displayArc(newArc, type);
                    added = tree;
                    indexOfAdded = i;
                }
                // else remove this tree from forest and merge it with
                // the previous tree where that arc was added
                else {
                    forest[indexOfAdded] = [...added,...tree];
                    forest.splice(i--, 1);
                }
                break;
            }
        }
    }
    // if the arc wasn't added to any tree at all, make a new tree
    if(!added) {
        forest.push([newArc]);
        displayArc(newArc, 'solution');
        if(newArc.ref)
            newArc.ref.added = true;
    }
}

/**
 * Adds an arc to a tree without duplicating it
 */
const addArcToTree = function(tree, newArc) {
    for(let i = 0; i < tree.edges.length; i++)
        if((tree.edges[i].startNode.ID === newArc.startNode.ID && tree.edges[i].endNode.ID === newArc.endNode.ID)
        || (tree.edges[i].startNode.ID === newArc.endNode.ID && tree.edges[i].endNode.ID === newArc.startNode.ID))
            return 'dup';
    tree.edges.push(newArc);
    if(newArc.ref)
        newArc.ref.added = true;
    return 'added';
}


// const localComputation = function(){}
const foreignComputationResultHandler = function(sender, receivedData) {
    let parsed = JSON.parse(receivedData);
    parsed.forEach(arc => {
        addArcToForest(arc, 'solution');
    });
    console.log("oc", ownersCounter, "toc", totalOwners.length, "ipc", incompletePromisesCounter);
    if(++ownersCounter === totalOwners.length && incompletePromisesCounter == 0) {
        ownersCounter = 0;
        console.timeEnd('Iteration');
        if(forest.length > 1) {
            console.time('Iteration');
            shareCutLists();
        }
        else
            console.timeEnd('Total');
    }
}



/**
 * Generate a list of 'cut-sets' which are defined as all the edges
 * who have one node inside a tree and another node outside the tree.
 * 
 * The code to generate the list in the first iteration is different from the rest of the iterations,
 * because the forest in this code is a list of trees, each is a list of arcs not nodes.
 */
const generateNodesList = function() {

        // sort the trees of the forest according to the nodes of its set of arcs. wait what? O_o
        let dict = Array.from(allNodesSet);
        let valueMapping = forest.map(tree => tree.reduce((acc, curr) => acc.concat(curr.start).concat(curr.end), "")).map(st => {
            let r = 0;
            for(let i = 0; i < st.length; i++) {
                r += dict.indexOf(st[i]);
            }
            return r;
        });

        let order = [];
        for(let i = 0; i < forest.length; i++) {
            let indexOfMin = valueMapping.indexOf(Math.min(...valueMapping));
            order.push(indexOfMin);
            valueMapping[indexOfMin] = Infinity;
        }
        let sortedForest = [];
        order.forEach(o => sortedForest.push(forest[o]));



        /**
         * The list of 'cut-sets'.
         */
        const nodesList = [];
        // loop over the forest
        sortedForest.forEach(tree => {
            // make a set of nodes for each tree
            let setOfNodes = new Set();
            let l = [];
            // add all edges in the tree to the set
            tree.forEach(edge => {
                setOfNodes.add(edge.start);
                setOfNodes.add(edge.end);
            });
            // loop over all the edges shared by all the parties (excluding those added already)
            for(let party in sharesAndTags) {
                sharesAndTags[party].filter(edge => !edge.added).forEach(edge => {
                    // if an edge has one node inside the set and one node outside the set add it to this 'cut-set'
                    if( (setOfNodes.has(edge.start) && !setOfNodes.has(edge.end)) || (setOfNodes.has(edge.end) && !setOfNodes.has(edge.start)) ) {
                        l.push({start:edge.start, end:edge.end, share:edge.share, ref:edge});
                    }
                });
            }
            // add the 'cut-set' if it's not empty
            if(l.length > 0)
                nodesList.push(l);
        });
        //console.log(nodesList);
        return nodesList;
    
}

/**
 * Iterate over the forest as long as the number of trees is not 1.
 */
const mpcIterate = function(nodesList) {
    // Loop over the array of 'cut-sets'
    for(let i = 0; i < nodesList.length; i++) {
        if(nodesList[i].length == 1) {
            addArcToForest(nodesList[i][0], 'solution');
            nodesList[i][0].ref.added = true;
            continue;
        }

        /**
         * var array = [1,3,2];
         * var min = array[0];
         * var min_index = 0;
         * for(let i = 1; i < array.length; i++) {
         *   var cmp = min < array[i];
         *   min = array[i]+(min-array[i]) * cmp;
         *   min_index = min_index + (i-min_index) * !cmp;
         * }
         */
        let minimumShare = nodesList[i][0].share; //TODO: fix bug when first min. share is undefined. .lt throws an error
        let minimumIndex = 0;
        for(let j = 1; j < nodesList[i].length; j++) {
            let comparison = minimumShare.lt(nodesList[i][j].share);
            minimumShare = nodesList[i][j].share.add(
                (minimumShare.sub(nodesList[i][j].share)).mult(comparison)
            );
            if(j == 1)
                minimumIndex = (comparison.mult(minimumIndex - j)).add(j);
            else
                minimumIndex = ((minimumIndex.sub(j)).mult(comparison)).add(j);
        }

        ++incompletePromisesCounter;
        minimumIndex.open(function(minimumIndexOpened) {
            // add share objects with arcs
            addArcToForest(nodesList[i][minimumIndexOpened], 'solution');
            console.log("oc", ownersCounter, "toc", totalOwners.length, "ipc", incompletePromisesCounter);
            if(--incompletePromisesCounter === 0 && ownersCounter === totalOwners.length) {
                ownersCounter = 0;
                console.timeEnd('Iteration');
                if(forest.length > 1) {
                    console.time('Iteration');
                    shareCutLists();
                }
                else
                    console.timeEnd('Total');
            }
        });
    }
}