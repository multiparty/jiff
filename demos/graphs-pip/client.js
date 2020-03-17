// Limits of the graph and inputs
var minX = -25;
var maxX = 25;
var minY = -25;
var maxY = 25;

// Stores the coordinates of the vertices
var vertices = [];

// Chart for drawing
var myChart;
window.onload = function () {
  var ctx = document.getElementById('myChart').getContext('2d');

  var scales = {
    yAxes: [{ ticks: { min: minY,  max: maxY } }],
    xAxes: [{ type: 'linear', position: 'bottom', ticks: { min: minX, max: maxX, maxTicksLimit: 20 } }]
  };

  // eslint-disable-next-line no-undef
  myChart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [
      { id: 'data-points', label: '', data: [], fill: false, showLine: false, pointBackgroundColor: 'rgb(0,0,0)', pointRadius: 5 }
    ]},
    options: {
      elements: { line: { tension: 0 } },
      scales: scales
    }
  });
};

// eslint-disable-next-line no-unused-vars
function addVertix() {
  var x = Number($('#inputX1').val());
  var y = Number($('#inputY1').val());
  vertices.push({ x: x, y: y });

  $('#inputX1').val('');
  $('#inputY1').val('');

  // eslint-disable-next-line no-undef
  var hull = geometry.convexHull(vertices);
  if (hull.length > 2) {
    hull.push(hull[0]);
    $('#submit1Button').prop('disabled', false);
  } else if (hull.length < 3) {
    $('#submit1Button').prop('disabled', true);
  }

  myChart.data.datasets = [{
    id: 'line',
    label: '',
    data: hull,
    fill: true,
    pointBackgroundColor: 'rgb(0,0,0)',
    borderColor: 'rgb(0,0,0)',
    pointRadius: 5
  }];
  myChart.update();
}

// eslint-disable-next-line no-unused-vars
function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = 2;
  var party_id = parseInt($('#role').val());

  var options = {
    party_count: party_count,
    party_id: party_id,
    Zp: '2147483647',
    integer_digits: 3,
    decimal_digits: 3
  };
  options.onError = function (_, error) {
    $('#output').append("<p class='error'>"+error+'</p>');
  };
  options.onConnect = function (jiff_instance) {
    $('#role').attr('disabled', true);
    $('#connectButton').attr('disabled', true);
    $('#output').append('<p>All parties Connected!</p>');
    $('#role' + jiff_instance.id).show();
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

// eslint-disable-next-line no-unused-vars
function submitPoint() {
  $('#submit1Button').prop('disabled', true);

  var x = Number($('#inputX2').val());
  var y = Number($('#inputY2').val());
  var point = { x: x, y: y };

  // eslint-disable-next-line no-undef
  var promise = mpc.compute(point);
  promise.then(displayResult);
}

// eslint-disable-next-line no-unused-vars
function submitPolygon() {
  $('#submit2Button').prop('disabled', true);

  // eslint-disable-next-line no-undef
  var hull = geometry.convexHull(vertices);
  // eslint-disable-next-line no-undef
  hull = geometry.toBigNumber(hull);

  // eslint-disable-next-line no-undef
  var promise = mpc.compute(hull);
  promise.then(displayResult);
}

function displayResult(result) {
  var msg = 'Point is not in polygon';
  if (result) {
    msg = 'Point is in polygon!!';
  }

  $('#output').append('<p>' + msg + '</p>');
  $('#submit1Button').prop('disabled', false);
  $('#submit2Button').prop('disabled', false);
}