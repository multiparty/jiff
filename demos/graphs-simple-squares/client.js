// The limits of the graph. The minimum and maximum X and Y values.
var minX = -5;
var maxX = 5;
var minY = -5;
var maxY = 5;
var maxAccuracy = 2;

// Stores the coordinates of the vertices
var coordinates = [];
var line = [];

// Chart for drawing
var myChart;
window.onload = function () {
  var ctx = document.getElementById('myChart').getContext('2d');

  var scales = {
    yAxes: [{ ticks: { min: minY,  max: maxY, maxTicksLimit: 5 } }],
    xAxes: [{ type: 'linear', position: 'bottom', ticks: { min: minX, max: maxX, maxTicksLimit: 20 } }]
  };

  // eslint-disable-next-line no-undef
  myChart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [
      { id: 'data-points', label: 'input', data: coordinates, fill: false, showLine: false, borderColor: '#000000', pointBackgroundColor: 'rgb(0,0,0)', pointRadius: 5 },
      { id: 'least-line', label: 'output', data: line, fill: false, pointBackgroundColor: '#000099', borderColor: '#000099', pointRadius: 0 }
    ]},
    options: {
      elements: { line: { tension: 1 } },
      scales: scales
    }
  });
};


// eslint-disable-next-line no-unused-vars
function pushCoordinate() {
  var xInput = Number($('#xVal').val());
  var yInput = Number($('#yVal').val());

  if (isNaN(xInput) || isNaN(yInput)) {
    alert('Coordinates must be a number');
    return;
  }

  if (xInput <= minX || xInput >= maxX) {
    alert('X Values must be within range ('+minX+', '+maxX+')');
    return;
  }
  if (yInput <= minX || yInput >= maxY) {
    alert('Y Values must be within range ('+minY+', '+maxY+')');
    return;
  }

  var xAcc = xInput * Math.pow(10, maxAccuracy);
  var yAcc = yInput * Math.pow(10, maxAccuracy);
  if (xAcc !== Math.floor(xAcc) || yAcc !== Math.floor(yAcc)) {
    alert('Coordinates must have at most ' + maxAccuracy + ' digits of accuracy');
    return;
  }

  $('#output').append('<p>'+xInput+'<br/>'+yInput+'</p>');

  // push coordinate to the 'coordinates' array
  coordinates.push( { x: xInput, y: yInput } );
  myChart.update();
  $('#xVal').val('');
  $('#yVal').val('');
}

// eslint-disable-next-line no-unused-vars
function clearCoordinates() {
  while (coordinates.length > 0) {
    coordinates.pop();
  }
  myChart.update();
  $('#output').innerHTML = '';
}

// eslint-disable-next-line no-unused-vars
function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = $('#count').val();

  var options = {
    party_count: party_count,
    /*
    Zp: '2199023255531',
    integer_digits: 6,
    decimal_digits: 3
  };
    Zp: '2147483647',
    integer_digits: 5,
    decimal_digits: 2
  };
    Zp: '33554393',
    integer_digits: 3,
    decimal_digits: 2
  }; */
    Zp: '268435399',
    integer_digits: 4,
    decimal_digits: 2
  };
  options.onError = function (_, error) {
    $('#output').append("<p class='error'>"+error+'</p>');
  };
  options.onConnect = function () {
    $('#connectButton').prop('disabled', true);
    $('#output').append('<p>All parties Connected!</p>');
    $('#submitButton').prop('disabled', false);
    $('#addButton').prop('disabled', false);
    $('#clearButton').prop('disabled', false);
    $('#xVal').prop('disabled', false);
    $('#yVal').prop('disabled', false);
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
  jiff_instance = mpc.connect(hostname, computation_id, options);
}

// eslint-disable-next-line no-unused-vars
function submit() {
  if (coordinates.length < 1) {
    alert('Please input at least one point.');
    return;
  }
  $('#submitButton').prop('disabled', true);

  // eslint-disable-next-line no-undef
  var promise = mpc.compute(coordinates);
  promise.then(handleResult);
}

// eslint-disable-next-line no-unused-vars
function handleResult(result) {
  $('#submitButton').prop('disabled', false);
  var m = result.m; // slope
  var p = result.p; // yIntercept

  var points = [];
  for (var i = minX; i <= maxX; i++) {
    var y = m.times(i).plus(p).toNumber();
    points.push({x: i, y: y});
  }

  while (line.length > points.length) {
    line.pop();
  }

  for (var k = 0; k < points.length; k++) {
    line[k] = points[k];
  }
  myChart.update();
}
