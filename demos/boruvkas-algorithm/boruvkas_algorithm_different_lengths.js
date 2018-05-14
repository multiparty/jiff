"use strict";
var jiff_instance;
var party_count;

/**
 * Edges entered by this user.
 * 
 * [{start,end,weight}]
 */
const edges = [];

/**
 * Maps a senderID to an array of objects having the edges and their shares.
 * 
 * {senderID -> [{start,end,share}]}
 */
const sharesAndTags = {};

/**
 * The forest that should hold the solution tree after the computation.
 * 
 * [{start,end,jiffShare,ref}]
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

const allNodesSet = new Set();

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
            jiff_instance.listen("node-names-list", nodeNamesListHandler);
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
 * The user has completed submitting his inputs. 
 */
function start() {
    if(edges.length == 0) {
        alert("Please add at least one edge");
        return;
    }
    console.time('Total');
    console.time('Iteration');
    $("#addEdge").attr("disabled", true);
    $("#start").attr("disabled", true);
    const tagsArray = [];
    edges.forEach(e => {
        let start = cy.getElementById(e.start);
        let end = cy.getElementById(e.end);
        tagsArray.push({
            start:e.start, startX:start.position('x'), startY:start.position('y'),
            end:e.end, endX:end.position('x'), endY:end.position('y')
        });
    });

    jiff_instance.emit("node-names-list", null, JSON.stringify(tagsArray));
}

/**
 * Parses the list of tags received. Loops over the nodes and adds any new nodes
 * to the graph. Checks if all the lists were received and starts the computation.
 */
const nodeNamesListHandler = function(sender, tagList) {
    sharesAndTags[sender] = JSON.parse(tagList);

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

        allNodesSet.add(tag.start);
        allNodesSet.add(tag.end);
    });

    // Check the tag lists
    if(Object.keys(sharesAndTags).length == party_count)
        startProcessing();
}

/**
 * Start processing when all the tag lists were received
 */
const startProcessing = function() {
    $("#output").append("<p>Computation Starting!</p>");

    // At this point preprocessing could be done to reduce mpc overhead

    const edgeWeights = edges.map(edge => edge.weight);
    jiff_instance.share_array(edgeWeights, function(shares_array) {
        shares_array.forEach((share, i) => {
            for(let p in share) { // if the extra shares were shuffled this might fail
                if(sharesAndTags[p][i])
                    sharesAndTags[p][i]["share"] = share[p];
            }
        });
        console.log(sharesAndTags); //complete!

        // Start looping!
        mpcIterate(generateNodesList());
    });
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
                if(!(e.start in nodesList)) {
                    nodesList[e.start] = [];
                }
                nodesList[e.start].push({start:e.start, end:e.end, share:e.share, ref:e});
                if(!(e.end in nodesList)) {
                    nodesList[e.end] = [];
                }
                nodesList[e.end].push({start:e.start, end:e.end, share:e.share, ref:e});
            });
        }
        // convert json object to array
        const firstIterationNodesList = [];
        for(let node in nodesList) {
            firstIterationNodesList.push(nodesList[node]);
        }
        return firstIterationNodesList;
    } else {

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
        console.log("nl"); nodesList.forEach(t => console.log(t));
        return nodesList;
    }
}

/**
 * Iterate over the forest as long as the number of trees is not 1.
 * 
 * Takes a forest as input and generates a node list, then do MPC.
 */
const mpcIterate = function(nodesList) {
    // Loop over the array of 'cut-sets'
    for(let i = 0; i < nodesList.length; i++) {
        if(nodesList[i].length == 1) {
            addArcToForest(nodesList[i][0]);
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

        // no need to open the minimumShare
        // minimumShare.open(function(minimumShareOpened) {
        //   console.log("minShare:", minimumShareOpened);
        // });

        ++incompletePromisesCounter;
        minimumIndex.open(function(minimumIndexOpened) { console.log(minimumIndexOpened);
            // add share objects with arcs
            addArcToForest(nodesList[i][minimumIndexOpened]);
            if(--incompletePromisesCounter == 0) {
                console.timeEnd('Iteration');
                if(forest.length > 1) {
                    console.time('Iteration');
                    mpcIterate(generateNodesList());
                }
                else
                    console.timeEnd('Total');
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
const addArcToForest = function(newArc) {
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
                    displayArc(newArc);
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
        displayArc(newArc);
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
    newArc.ref.added = true;
    return 'added';
}

/**
 * Displays an arc on the graph.
 */
const displayArc = function(arc) {
    cy.add({
        group: 'edges',
        data: {
            // label: weight,
            source: arc.start,
            target: arc.end,
            type: 'solution'
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