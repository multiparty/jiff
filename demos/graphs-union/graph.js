function parse(graph) {
  var nodes = Object.keys(graph);
  var edges = [];
  graph.forEach(function (vertex, s) {
    vertex.forEach(function (edge, t) {
      if (edge === 1) {
        edges.push([s, t]);
      }
    });
  });

  var data = {
    nodes: nodes.map(function (vertex) {
      return {id: vertex};
    }),
    links: edges.map(function (edge) {
      return {source: edge[0].toString(), target: edge[1].toString()};
    })
  };

  return data;
}

// D3 taken from https://github.com/d3/d3-force
var d3;
function render(data) {
  var svg = d3.select('svg'),
    width = +svg.attr('width'),
    height = +svg.attr('height');
  svg.html('');

  var graph = parse(data);

  var color = function () {
    return '#1f77b4'; //d3.scaleOrdinal(d3.schemeCategory20);
  };

  var simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(function (d) {
      return d.id;
    }))
    .force('charge', d3.forceManyBody())
    .force('center', d3.forceCenter(width / 2, height / 2));

  var link = svg.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(graph.links)
    .enter().append('line')
    .attr('stroke-width', function (d) {
      return Math.sqrt(d.value);
    });

  var node = svg.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(graph.nodes)
    .enter().append('g')

  node.append('circle')
    .attr('r', 10)
    .attr('fill', function (d) {
      return color(d.group);
    })
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

  node.append('text')
    .text(function (d) {
      return d.id;
    })
    .attr('x', 0)
    .attr('y', 5);

  node.append('title')
    .text(function (d) {
      return d.id;
    });

  simulation
    .nodes(graph.nodes)
    .on('tick', ticked);

  simulation
    .force('link')
    .links(graph.links);

  function ticked() {
    link
      .attr('x1', function (d) {
        return d.source.x;
      })
      .attr('y1', function (d) {
        return d.source.y;
      })
      .attr('x2', function (d) {
        return d.target.x;
      })
      .attr('y2', function (d) {
        return d.target.y;
      });

    node
      .attr('transform', function (d) {
        return 'translate(' + d.x + ',' + d.y + ')';
      })
  }

  function dragstarted(d) {
    if (!d3.event.active) {
      simulation.alphaTarget(0.3).restart();
    }
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragended(d) {
    if (!d3.event.active) {
      simulation.alphaTarget(0);
    }
    d.fx = null;
    d.fy = null;
  }
}

// eslint-disable-next-line no-unused-vars
function updateGraph(inputText) {
  var graph = JSON.parse(inputText);
  render(graph);
}
