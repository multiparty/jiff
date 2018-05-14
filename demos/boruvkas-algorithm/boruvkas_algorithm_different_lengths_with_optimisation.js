"use strict";
var jiff_instance;
var party_count;

/**
 * Edges entered by this user.
 * 
 * [{start,end,weight}]
 */
let edges = [];

/**
 * Maps a senderID to an array of objects having the edges and their shares.
 * 
 * {senderID -> [{start,end,share}]}
 */
const sharesAndTags = {};

/**
 * The forest that should hold the solution tree after the computation.
 * 
 * [[{start,end,jiffShare,ref}]]
 * 
 * start is the start node.
 * end is the end node (the graph is undirected so it shouldn't matter).
 * jiffShare is the share object.
 * The ref is a pointer to the share object in the sharesAndTags object.
 * It's used to mark the arcs that were already added to the graph.
 */
const forest = [];

/**
 * A counter that counts promises that are still not resolved.
 * It's needed to decide when to start a new iteration.
 */
let incompletePromisesCounter = 0;

/**
 * An object that manages the position of new nodes.
 * It arranges them them in a rectangular fashion.
 */
let positions = {
    newXPos:100,
    newYPos:0,
    jump:100,
    incrementPos:function() {
        positions.newXPos += positions.jump;
        if(positions.newXPos == 700) {
            positions.newXPos = 0;
            positions.newYPos += positions.jump;
        }
    }
}

const otherParties = [];

// data structures for optimization preprocessing
const thisPartyAllNodes = new Set();
const allPartiesNodesArrays = {};
let partyPointer = 1;
const allNodesSet = new Set();
const guestEdgesPartiesCounts = [];
// data structures for optimization iteration
const ownedNodes = new Set();
const foreignOwnedNodes = new Set();
let receivedGuestEdgesCount = 0;
let ownedEdges = [];
let totalOwners = 0;
let ownersCounter = 0;

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

            for(let i = 1; i <= party_count; i++)
                if(i !== jiff_instance.id)
                    otherParties.push(i);

            jiff_instance.listen("nodes-list", nodesListHandler);
            jiff_instance.listen("edges-list", edgesListHandler);
            jiff_instance.listen("local-computation-result", localComputationResultHandler);
            jiff_instance.listen("cut-lists", cutListsHandler);
        };
        
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
function addEdge() {
    let startNode = document.getElementById("start_node").value,
        endNode = document.getElementById("end_node").value,
        weight = document.getElementById("weight").value;
    let parsedWeight = parseFloat(weight);
    if(isNaN(parsedWeight) || parsedWeight != Math.floor(parsedWeight) || parsedWeight < 0) {
        alert('Values must be positive integers only.');
        return;
    }
    if(startNode === endNode) {
        alert("Please add edges that join together two different nodes.");
        return;
    }

    // add first node if it doesn't exist
    let node = cy.getElementById(startNode);
    if(node.length == 0) {
        cy.add({
            group: 'nodes', // 'nodes' for a node, 'edges' for an edge
            data: {
                id: startNode, // mandatory (string or number) id for each element, assigned automatically on undefined
            },
            position: { // the model position of the node (optional on init, mandatory after)
                x: positions.newXPos,
                y: positions.newYPos
            }
        });
        positions.incrementPos();
    }
    // add second node if it doesn't exist
    node = cy.getElementById(endNode);
    if(node.length == 0) {
        cy.add({
            group: 'nodes',
            data: {
                id: endNode,
            },
            position: {
                x: positions.newXPos,
                y: positions.newYPos
            }
        });
        positions.incrementPos();
    }

    // add edge between the two nodes
    cy.add({
        group: 'edges',
        data: {
            // label: weight,
            source: startNode,
            target: endNode
        },
        style: {
            label: weight
        }
    });

    // push object to the edges array for mpc
    edges.push({start:startNode, end:endNode, weight:parsedWeight});
}

/**
 * Unused
 * 
 * Function tries to optimise the mpc overhead. It compares (the list of edges input
 * by the user) against (the lists of tags received from the other parties). It
 * looks for a set of edges input by the user such that no other parties have
 * information related to those edges, then it pre-computes minimal spanning trees
 * locally on those edges if possible and sends the solution to the other parties.
 * 
 * This optimisation should be used if parties are okay to share with their adversaries 
 * their set of edges (but only without their values).
 */
function optimize() {
    // const allEdges = [];
    // for(let party in sharesAndTags) {
    //     if(party != jiff_instance.id)
    //         sharesAndTags[party].forEach(edge => {
    //             allEdges.push({start:edge.start, end:edge.end, weight:Number.NEGATIVE_INFINITY});
    //         });
    // }
    // edges.forEach(edge => allEdges.push(edge));
    // console.log(allEdges);

    const allEdges = [];
    for(let party in sharesAndTags) {
        if(party != jiff_instance.id)
            sharesAndTags[party].forEach(edge => {
                allEdges.push({start:edge.start, end:edge.end, weight:Number.NEGATIVE_INFINITY});
            });
    }

    // let t = localMST(allEdges);
    let t = localMST(edges, setOfNodesUnknownWeight);
    console.log(t);
    t.forEach(x => displayArc(x, 'annotation'));
    let tt = t.filter(e => e.weight != Number.NEGATIVE_INFINITY);
    console.log(tt);
    tt.forEach(x => displayArc(x, 'solution'));
}

/**
 * Unused
 * 
 * Function to compute a Minimal Spanning tree locally on a set of arcs.
 * 
 * @param edges - Array of weighted edges [{start, end, weight}]
 */
function localMST(edges) {
    if(edges.length == 0)
        return [];
    let solution = [];
    let sortedEdges = edges.sort((a,b) => {
        return a.weight - b.weight;
    });
    let setOfNodes = new Set();
    edges.forEach(edge => {
        setOfNodes.add(edge.start);
        setOfNodes.add(edge.end);
    });
    let setsOfNodes = [];
    for(let node of setOfNodes)
        setsOfNodes.push(new Set(node));

    sortedEdges.forEach(edge => {
        if(disjointSets(edge, setsOfNodes))
            solution.push(edge);
    });
    return solution;
}

/**
 * Unused
 * 
 * Function to detect whether adding the edge to the solution will cause a cycle or not.
 * It implements the disjoint sets algorithm.
 * It's a helper function for localMST()
 * 
 * @param {edge} newEdge - the new edge that we're not sure whether to add to the solution or not
 * @param {[Set(node)]} setsOfNodes - an array of sets of nodes
 */
function disjointSets(newEdge, setsOfNodes) {
    let firstSet;
    for(let i = 0; i < setsOfNodes.length; i++) {
        if(setsOfNodes[i].has(newEdge.start)) {
            firstSet = setsOfNodes.splice(i,1)[0];
            break;
        }
    }

    for(let i = 0; i < setsOfNodes.length; i++) {
        if(setsOfNodes[i].has(newEdge.end)) {
            let secondSet = setsOfNodes.splice(i,1)[0];
            for (let elem of secondSet) {
                firstSet.add(elem);
            }
            setsOfNodes.push(firstSet);
            return true;
        }
    }
    setsOfNodes.push(firstSet);
    return false;
}

/**
 * The user has completed submitting his inputs. 
 */
function start() {
    if(edges.length == 0) {
        alert("Please add at least one edge");
        return;
    }
    $("#addEdge").attr("disabled", true);
    $("#start").attr("disabled", true);
    console.time('Iteration');
    console.time('Owners');

    edges.forEach(edge => {
        thisPartyAllNodes.add(edge.start);
        thisPartyAllNodes.add(edge.end);
    });
    jiff_instance.emit("nodes-list", null, JSON.stringify(Array.from(thisPartyAllNodes)));
}

const nodesListHandler = function(sender, nodesList) {
    allPartiesNodesArrays[sender] = new Set(JSON.parse(nodesList));
    if(sender == partyPointer) 
        while(allPartiesNodesArrays[partyPointer]) {
            for (let elem of allPartiesNodesArrays[sender]) {
                allNodesSet.add(elem);
            }
            ++partyPointer;
        }
    if(partyPointer-1 == party_count) {
        for(let node of allNodesSet) {
            let share;
            if(thisPartyAllNodes.has(node))
                share = jiff_instance.share(1);
            else
                share = jiff_instance.share(0);

            let sum = share[1];
            for(var i = 2; i <= jiff_instance.party_count; i++)
                sum = sum.add(share[i]);
            let pointer = {node:node, share:sum};
            guestEdgesPartiesCounts.push(pointer);
            
            (function(pointer){
                sum.open(function(sum_opened) {
                    pointer.value = sum_opened;
                    if(pointer.value == 1) {
                        if(thisPartyAllNodes.has(pointer.node)) {
                            ownedNodes.add(pointer.node);
                        }
                        foreignOwnedNodes.add(pointer.node);
                    }
                    if(++receivedGuestEdgesCount == guestEdgesPartiesCounts.length)
                        processOwnedEdges();
                });         
            })(pointer)
        }
    }
}

const processOwnedEdges = function() {
    // loop over the input edges
    for(let i = 0; i < edges.length; i++) {
        // if the edge is between two owned nodes, remove it from public edges and add it to the owned edges
        if(ownedNodes.has(edges[i].start) && ownedNodes.has(edges[i].end))
            ownedEdges.push(edges.splice(i--, 1)[0]);
    }
    console.timeEnd('Owners');

    const tagsArray = [];
    edges.forEach(e => {
        let start = cy.getElementById(e.start);
        let end = cy.getElementById(e.end);
        tagsArray.push({
            start:e.start, startX:start.position('x'), startY:start.position('y'),
            end:e.end, endX:end.position('x'), endY:end.position('y')
        });
    });
    jiff_instance.emit("edges-list", null, JSON.stringify({subscribe:ownedNodes.size > 0, array:tagsArray}));
}

/**
 * Parses the list of tags received. Loops over the nodes and adds any new nodes
 * to the graph. Checks if all the lists were received and starts the computation.
 */
const edgesListHandler = function(sender, tagList) {
    let parsed = JSON.parse(tagList);
    sharesAndTags[sender] = parsed.array;
    if(parsed.subscribe)
        totalOwners++;

    // Loop over the tagList and add missing nodes if any
    sharesAndTags[sender].forEach(tag => {
        let node = cy.getElementById(tag.start);
        if(node.length == 0) {
            cy.add({
                group: 'nodes',
                data: {
                    id: tag.start,
                },
                position: {
                    x: tag.startX,
                    y: tag.startY
                }
            });
        }
        node = cy.getElementById(tag.end);
        if(node.length == 0) {
            cy.add({
                group: 'nodes',
                data: {
                    id: tag.end,
                },
                position: {
                    x: tag.endX,
                    y: tag.endY
                }
            });
        }
    });

    // Check the tag lists
    if(Object.keys(sharesAndTags).length == party_count)
        startProcessing();
}

/**
 * Start processing when all the tag lists are received
 */
const startProcessing = function() {
    $("#output").append("<p>Computation Starting!</p>");

    const edgeWeights = edges.map(edge => edge.weight);
    jiff_instance.share_array(edgeWeights, function(shares_array) {
        shares_array.forEach((share, i) => {
            for(let p in share) { // if the extra shares were shuffled this might fail
                if(sharesAndTags[p][i])
                    sharesAndTags[p][i]["share"] = share[p];
            }
        });

        // Start looping!
        mpcIterate(generateNodesList());
        if(ownedNodes.size > 0)
            localComputation();
    });
}

const localComputation = function() {
    let res = [];
    let splices = [];

    for(let node of ownedNodes) {
        let minimumEdge;
        let minimumEdgeWeight = Infinity;
        let owned = false;
        let index;
        edges.forEach((edge, i) => {
            if((edge.start === node || edge.end === node) && edge.weight < minimumEdgeWeight) {
                minimumEdge = edge;
                minimumEdgeWeight = edge.weight;
                index = i;
            }
        });
        ownedEdges.forEach((edge, i) => {
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
            ownedEdges[s.index] = null;
        else
            edges.splice[s.index] = null;
    });
    ownedEdges = ownedEdges.filter(e => e);
    edges = edges.filter(e => e);
    

    let resSend = res.map(edge => {
        let start = cy.getElementById(edge.start);
        let end = cy.getElementById(edge.end);
        return {
            start:edge.start, startX:start.position('x'), startY:start.position('y'),
            end:edge.end, endX:end.position('x'), endY:end.position('y')
        }
    });


    ++ownersCounter;
    jiff_instance.emit("local-computation-result", otherParties, JSON.stringify(resSend));
}

const localComputationResultHandler = function(sender, result) {
    let parsed = JSON.parse(result);
    parsed.forEach(arc => {
        addArcToForest(arc, 'solution');
    });
    if(++ownersCounter === totalOwners && incompletePromisesCounter == 0) {
        ownersCounter = 0; 
        if(forest.length > 1) {
            console.time('Iteration');
            shareCutLists();
        }
    }
}

let tempArrayBetweenOwnedEdgesAndEdges = [];
let ownedTreesCounter;

const shareCutLists = function() {
    let arrayToShare = [];
    ownedTreesCounter = 0;
    for(let i = 0; i < forest.length; i++) {
        let tree = forest[i];
        // make a set of nodes for each tree
        let setOfNodes = new Set();
        // add all edges in the tree to the set
        tree.forEach(edge => {
            setOfNodes.add(edge.start);
            setOfNodes.add(edge.end);
        });
        // check whether we own that tree
        let weOwnIt = true;
        for(let party in sharesAndTags) {
            sharesAndTags[party].filter(edge => !edge.added).forEach(edge => {
                // if an edge has one node inside the tree and one node outside the tree, we don't own it
                if((setOfNodes.has(edge.start) && !setOfNodes.has(edge.end))
                || (setOfNodes.has(edge.end) && !setOfNodes.has(edge.start))) {
                    weOwnIt = false;
                    //break; -_-
                }
            });
        }
        if(!weOwnIt) {
            // if we don't own it, share any edges we have retained (if there's any) that should be in the cut-list of that tree
            for(let i = 0; i < ownedEdges.length; i++) {
                let edge = ownedEdges[i];
                if((setOfNodes.has(edge.start) && !setOfNodes.has(edge.end))
                || (setOfNodes.has(edge.end) && !setOfNodes.has(edge.start))) {
                    let start = cy.getElementById(edge.start);
                    let end = cy.getElementById(edge.end);
                    arrayToShare.push({
                        start:edge.start, startX:start.position('x'), startY:start.position('y'),
                        end:edge.end, endX:end.position('x'), endY:end.position('y')
                    });
                    // put it back to the edges
                    tempArrayBetweenOwnedEdgesAndEdges.push(ownedEdges.splice(i--, 1)[0]);
                }
            }
        } else
            ++ownedTreesCounter;


    }
    
    jiff_instance.emit('cut-lists', null, JSON.stringify({subscribe:ownedTreesCounter > 0, array:arrayToShare}));
}

const tempSharesAndTags = {};

const cutListsHandler = function(sender, cutlists) {
    let parsed = JSON.parse(cutlists);
    tempSharesAndTags[sender] = parsed.array;
    if(!parsed.subscribe)
        --totalOwners;

    // Loop over the tagList and add missing nodes if any
    sharesAndTags[sender].forEach(tag => {
        let node = cy.getElementById(tag.start);
        if(node.length == 0) {
            cy.add({
                group: 'nodes',
                data: {
                    id: tag.start,
                },
                position: {
                    x: tag.startX,
                    y: tag.startY
                }
            });
        }
        node = cy.getElementById(tag.end);
        if(node.length == 0) {
            cy.add({
                group: 'nodes',
                data: {
                    id: tag.end,
                },
                position: {
                    x: tag.endX,
                    y: tag.endY
                }
            });
        }
    });

    // Check the tag lists
    if(Object.keys(tempSharesAndTags).length == party_count) {
        const edgeWeights = tempArrayBetweenOwnedEdgesAndEdges.map(edge => edge.weight);
        jiff_instance.share_array(edgeWeights, function(shares_array) {
            shares_array.forEach((share, i) => {
                for(let p in share) { // if the extra shares were shuffled this might fail
                    if(tempSharesAndTags[p][i])
                        tempSharesAndTags[p][i]["share"] = share[p];
                }
            });
            // console.log("tsnt"); for(let w in tempSharesAndTags){console.log(tempSharesAndTags[w]);};//complete!
            // console.log("snt"); for(let w in sharesAndTags){console.log(sharesAndTags[w]);};
            // for(let i = 0; i < tempSharesAndTags.length; i++) {
            //     sharesAndTags.push(tempSharesAndTags[i]);
            // }
            for(let snt in sharesAndTags) {
                tempSharesAndTags[snt].forEach(s => {
                    sharesAndTags[snt].push(s);
                });
            }
            // console.log("taboent"); tempArrayBetweenOwnedEdgesAndEdges.forEach(thing => console.log(thing));
            for(let i = 0; i < tempArrayBetweenOwnedEdgesAndEdges.length; i++) {
                edges.push(tempArrayBetweenOwnedEdgesAndEdges[i]);
            }
            tempArrayBetweenOwnedEdgesAndEdges = [];
            // console.log("tsnt"); console.log(tempSharesAndTags)
            // console.log("snt"); console.log(sharesAndTags);
            // console.log("==forest"); forest.forEach(t => {console.log('>tree'); t.forEach(a => console.log(a))});
            // console.log("taboent"); console.log(tempArrayBetweenOwnedEdgesAndEdges);
            // console.log(edges);
            // return;





            // Start looping!
            mpcIterate(generateNodesList());
            if(ownedTreesCounter > 0)
                localComputation();
        });
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
    // if it's the first iteration the forest will be empty, otherwise it will have trees.
    if(forest.length == 0) {
        const nodesList = {};
        for(let party in sharesAndTags) {
            sharesAndTags[party].forEach(e => {
                // make the 'cut-set' for each node
                // add an entry for each node if no entry exists
                if(!foreignOwnedNodes.has(e.start)) {
                    if(!(e.start in nodesList)) {
                        nodesList[e.start] = [];
                    }
                    nodesList[e.start].push({start:e.start, end:e.end, share:e.share, ref:e});
                }
                if(!foreignOwnedNodes.has(e.end)) {
                    if(!(e.end in nodesList)) {
                        nodesList[e.end] = [];
                    }
                    nodesList[e.end].push({start:e.start, end:e.end, share:e.share, ref:e});
                }
            });
        }
        // convert json object to array
        const firstIterationNodesList = [];
        for(let node in nodesList) {
            firstIterationNodesList.push(nodesList[node]);
        }
        // console.log(firstIterationNodesList);
        return firstIterationNodesList;
    } else {

        // sort the trees of the forest according to the nodes of its set of arcs. wait what? O_o
        let dict = Array.from(allNodesSet);
        console.log(dict);
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
}

/**
 * Iterate over the forest as long as the number of trees is not 1.
 */
const mpcIterate = function(nodesList) { //console.log("cutlist"); console.log(nodesList);
    // Loop over the array of 'cut-sets'
    for(let i = 0; i < nodesList.length; i++) {
        if(nodesList[i].length == 1) { //console.log("adding", nodesList[i][0]);
            addArcToForest(nodesList[i][0], 'solution');
            nodesList[i][0].ref.added = true;
            continue;
        }
        // console.log("O_o")

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

        // no need to open the minimumShare
        // minimumShare.open(function(minimumShareOpened) {
        //   console.log("minShare:", minimumShareOpened);
        // });

        ++incompletePromisesCounter; //console.log(incompletePromisesCounter);
        minimumIndex.open(function(minimumIndexOpened) { // console.log("open");
            // add share objects with arcs
            addArcToForest(nodesList[i][minimumIndexOpened], 'solution');
            // console.log("dpc");
            // console.log("pc", incompletePromisesCounter-1, "oc", ownersCounter, "to", totalOwners);
            if(--incompletePromisesCounter === 0 && ownersCounter === totalOwners) {
                ownersCounter = 0;
                console.timeEnd('Iteration');
                if(forest.length > 1) {
                    console.log("it");
                    // console.log("==forest"); forest.forEach(t => {console.log('>tree'); t.forEach(a => console.log(a))});
                    //mpcIterate(generateNodesList());
                    console.time('Iteration');
                    shareCutLists();
                }
            }
        });
    }
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
        for(let j = 0; j < tree.length; j++) {
            let arc = tree[j];
            // if one of the nodes of the arc is in this tree add that arc to the tree
            if
            (
                arc.start === newArc.start ||
                arc.start === newArc.end || 
                arc.end === newArc.start || 
                arc.end === newArc.end
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
    // console.log("==forest"); forest.forEach(t => {console.log('>tree'); t.forEach(a => console.log(a))});
}
/**
 * Adds an arc to a tree without duplicating it
 */
const addArcToTree = function(tree, newArc) {
    for(let i = 0; i < tree.length; i++)
        if((tree[i].start === newArc.start && tree[i].end === newArc.end)
        || (tree[i].start === newArc.end && tree[i].end === newArc.start))
            return 'dup';
    tree.push(newArc);
    if(newArc.ref)
        newArc.ref.added = true;
    return 'added';
}

/**
 * Displays an arc on the graph.
 */
const displayArc = function(arc, type) {
    if(cy.getElementById(arc.start).length == 0) {
        cy.add({
            group: 'nodes',
            data: {
                id: arc.start,
            },
            position: {
                x: arc.startX,
                y: arc.startY
            }
        });
    }
    if(cy.getElementById(arc.end).length == 0) {
        cy.add({
            group: 'nodes',
            data: {
                id: arc.end,
            },
            position: {
                x: arc.endX,
                y: arc.endY
            }
        });
    }
    cy.add({
        group: 'edges',
        data: {
            // label: weight,
            source: arc.start,
            target: arc.end,
            type: type
        }
    });
}


/**
 * The cytoscape graph!
 */
const cy = cytoscape({
    container: document.getElementById('cy'), // container to render in

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
            selector: 'edge[type="annotation"]',
            style: {
                'width': 5,
                'line-color': '#00f',
                'target-arrow-color': '#00f',
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
cy.zoom({
    level: 0.8,
    renderedPosition: { x: 300, y: 300 }
});
cy.add({
    group: 'nodes',
    data:{ id:'origin', type:'origin', position: {x:0, y:0}}
});
cy.getElementById('origin').ungrabify();