/**
 * Do not modify this file unless you have to.
 * This file has UI handlers.
 */

// eslint-disable-next-line no-unused-vars
var computes = [];
function connect(party_id, party_count, compute_count, computation_id) {
  // Compute parties ids
  for (var c = 1; c <= compute_count; c++) {
    computes.push(c);
  }

  // jiff options
  var options = { party_count: party_count, party_id: party_id };
  options.onError = function (error) {
    $('#output').append('<p class=\'error\'>'+error+'</p>');
  };
  options.onConnect = function () {
    $('#output').append('<p>Connected!</p>');
  };

  // host name
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
  mpc.connect(hostname, computation_id, options, computes, function (id, cols) {
    var schema = 'Party ' + (id - computes.length - 1) + ': ' + cols.join(' | ') + '<br/>';
    document.getElementById('schema').innerHTML += schema;
  });
}

// eslint-disable-next-line no-unused-vars
function submit() {
  $('#output').append('<p>Starting...</p>');
  $('#submit').attr('disabled', true);

  // eslint-disable-next-line no-undef
  mpc.compute().then(plot);
}

/**
 * Helpers for drawing lines in a chart
 */
// The limits of the graph. The minimum and maximum X and Y values.
var minX = -5;
var maxX = 5;
var minY = -5;
var maxY = 5;

// Chart for drawing
function initChart(line) {
  var ctx = document.getElementById('myChart').getContext('2d');

  var scales = {
    yAxes: [{ ticks: { min: minY,  max: maxY, maxTicksLimit: 5 } }],
    xAxes: [{ type: 'linear', position: 'bottom', ticks: { min: minX, max: maxX, maxTicksLimit: 20 } }]
  };

  // eslint-disable-next-line no-undef
  var myChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { id: 'least-line', label: 'output', data: line, fill: false, pointBackgroundColor: '#000099', borderColor: '#000099', pointRadius: 0 }
      ]
    },
    options: {
      elements: { line: { tension: 1 } },
      scales: scales
    }
  });
  myChart.update();
}

function plot(data) {
  console.log(data);
  var m = data.slope;
  var p = data.yIntercept;

  var points = [];
  for (var i = minX; i <= maxX; i++) {
    var y = m.times(i).plus(p).toNumber();
    points.push({x: i, y: y});
  }

  $('#output').show();
  initChart(points);
}