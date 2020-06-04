/**
 * Do not modify this file unless you have too
 * This file has UI handlers.
 */

// eslint-disable-next-line no-unused-vars
function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = parseInt($('#count').val());

  if (isNaN(party_count)) {
    $('#output').append("<p class='error'>Party count must be a valid number!</p>");
    $('#connectButton').prop('disabled', false);
  } else {
    var options = { party_count: party_count, Zp: 2 };
    options.onError = function (_, error) {
      $('#output').append("<p class='error'>"+error+'</p>');
    };
    options.onConnect = function () {
      $('#processButton').attr('disabled', false); $('#output').append('<p>All parties Connected!</p>');
    };

    var hostname = window.location.hostname.trim();
    var port = window.location.port;
    if (port == null || port === '') {
      port = '80';
    }
    if (!(hostname.startsWith('http://') || hostname.startsWith('https://'))) {
      hostname = 'http://' + hostname;
    }
    if (hostname.endsWith('/')) {
      hostname = hostname.substring(0, hostname.length-1);
    }
    if (hostname.indexOf(':') > -1 && hostname.lastIndexOf(':') > hostname.indexOf(':')) {
      hostname = hostname.substring(0, hostname.lastIndexOf(':'));
    }

    hostname = hostname + ':' + port;
    // eslint-disable-next-line no-undef
    mpc.connect(hostname, computation_id, options);
  }
}

// eslint-disable-next-line no-unused-vars
function submit() {
  $('#processButton').attr('disabled', true);
  $('#output').append('<p>Starting...</p>');

  var inputText = document.getElementById('inputText').value;
  var graph = JSON.parse(inputText);

  render(graph);

  // eslint-disable-next-line no-undef
  var promise = mpc.compute(graph);
  promise.then(handleResult);
}

function handleResult(result) {
  $('#output').append('<p>Result is: ' + JSON.stringify(result) + '</p>');
  $('#processButton').attr('disabled', false);
}

function updateGraph(inputText) {
  var graph = JSON.parse(inputText);
  render(graph);
}

function parse(graph) {
  var nodes = Object.keys(graph);
  var edges = [];
  graph.forEach(function(vertex, s) {
    vertex.forEach(function(edge, t) {
      if(edge === 1) {
        edges.push([s, t]);
      }
    });
  });

  var data = {
    nodes: nodes.map(function (vertex) {return {id: vertex};}),
    links: edges.map(function (edge) {return {source: edge[0], target: edge[1]};})
  };

  return data;
}


// D3 taken from https://github.com/d3/d3-force
function render(data) {
  var svg = d3.select("svg"),
  width = +svg.attr("width"),
  height = +svg.attr("height");
  svg.html('');

  var graph = parse(data);

  var color = d3.scaleOrdinal(d3.schemeCategory20);

  var simulation = d3.forceSimulation()
  .force("link", d3.forceLink().id(function(d) { return d.id; }))
  .force("charge", d3.forceManyBody())
  .force("center", d3.forceCenter(width / 2, height / 2));

  var link = svg.append("g")
  .attr("class", "links")
  .selectAll("line")
  .data(graph.links)
  .enter().append("line")
  .attr("stroke-width", function(d) { return Math.sqrt(d.value); });

  var node = svg.append("g")
  .attr("class", "nodes")
  .selectAll("g")
  .data(graph.nodes)
  .enter().append("g")

  var circles = node.append("circle")
  .attr("r", 10)
  .attr("fill", function(d) { return color(d.group); })
  .call(d3.drag()
  .on("start", dragstarted)
  .on("drag", dragged)
  .on("end", dragended));

  var lables = node.append("text")
  .text(function(d) {
    return d.id;
  })
  .attr('x', 0)
  .attr('y', 5);

  node.append("title")
  .text(function(d) { return d.id; });

  simulation
  .nodes(graph.nodes)
  .on("tick", ticked);

  simulation
  .force("link")
  // .strength(0.1)
  // .distance(70)
  // .charge(+1)
  .links(graph.links);

  function ticked() {
    link
    .attr("x1", function(d) { return d.source.x; })
    .attr("y1", function(d) { return d.source.y; })
    .attr("x2", function(d) { return d.target.x; })
    .attr("y2", function(d) { return d.target.y; });

    node
    .attr("transform", function(d) {
      return "translate(" + d.x + "," + d.y + ")";
    })
  }

  function dragstarted(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragended(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}
