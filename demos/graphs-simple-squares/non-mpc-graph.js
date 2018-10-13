// our data points (can be pre-populated here)
//var data_points = [{x: 10,y: 20},{x: 15,y: 10}];
//var data_points = [{x: 1,y: 1},{x: 2,y: 2},{x: 3,y: 3},{x: 1,y: 3},{x: 2,y: 4},{x: 3,y: 5}, {x:5, y:9}];
var data_points = [];

// our graph, ready to receive data points and the line of best fit.
var ctx = document.getElementById('myChart').getContext('2d');
var myChart = new Chart(ctx, {
  type: 'line',
  data: {
    datasets: [{
      id:'data-points',
      label:'',
      data: data_points,
      fill:false,
      showLine:false,
      pointBackgroundColor:'rgb(0,0,0)',
      pointRadius:5
    },{
      id:'line',
      label:'',
      data: [],
      fill:false,
      pointBackgroundColor:'rgb(0,0,0)',
      borderColor:'rgb(0,0,0)',
      pointRadius:0.1
    }]
  },
  options: {
    scales: {
      yAxes: [{
        ticks: {
          min: 0,
          max: 100
        }
      }],
      xAxes: [{
        type: 'linear',
        position: 'bottom',
        ticks: {
          min: 0,
          max: 100,
          maxTicksLimit: 20
        }
      }]
    }
  }
});

// adds a data point to the set of points
function pushDataPoint() {
  let p = {x:parseInt(document.getElementById('xVal').value),y:parseInt(document.getElementById('yVal').value)};
  console.log(p);
  data_points.push(p);
  //let lineDataset = myChart.data.datasets.filter(dataset => dataset.id == "data-points");
  //lineDataset[0].data.push(p);
  myChart.update();
  document.getElementById('xVal').value = '';
  document.getElementById('yVal').value = '';
}

// button onclick event to calculate least squares
function calculateLeastSquares(data_points) {
  let x_values = [];
  let y_values = [];

  // map data_points to x_values and y_values
  data_points.forEach(e => {
    x_values.push(e.x);
    y_values.push(e.y);
  });

  console.log(x_values);
  console.log(y_values);

  let leastSquaresResult = leastSquaresCalculator(x_values, y_values);

  // map result back to data_points
  let leastSquaresDataPoints = [];
  for (let i = 0; i < leastSquaresResult.result_values_x.length /*or y.length*/; i++) {
    leastSquaresDataPoints.push({
      x:leastSquaresResult.result_values_x[i],
      y:leastSquaresResult.result_values_y[i]
    });
  }

  // finally display the line
  updateGraph(leastSquaresDataPoints);
}

// calculate least squares
function leastSquaresCalculator(values_x, values_y) {
  var sum_x = 0;
  var sum_y = 0;
  var sum_xy = 0;
  var sum_xx = 0;
  var count = 0;

  /*
    * We'll use those variables for faster read/write access.
    */
  var x = 0;
  var y = 0;
  var values_length = values_x.length;

  if (values_length != values_y.length) {
    throw new Error('The parameters values_x and values_y need to have same size!');
  }
  if (values_length === 0) {
    return [ [], [] ];
  }

  /*
    * Calculate the sum for each of the parts necessary.
    */
  for (var v = 0; v < values_length; v++) {
    x = values_x[v];
    y = values_y[v];
    sum_x += x;
    sum_y += y;
    sum_xx += x*x;
    sum_xy += x*y;
    count++;
  }
  console.log('sum_x:', sum_x);
  console.log('sum_y:', sum_y);
  console.log('sum_xx:', sum_xx);
  console.log('sum_xy:', sum_xy);

  /*
    * Calculate m and b for the formular:
    * y = x * m + b
    */
  // var m = (count*sum_xy - sum_x*sum_y) / (count*sum_xx - sum_x*sum_x);
  // var b = (sum_y/count) - (m*sum_x)/count;

  var num = (count*sum_xy - sum_x*sum_y); console.log('num:', num);
  var denom = (count*sum_xx - sum_x*sum_x); console.log('denom:', denom);
  var m = num/denom; console.log('m:', m);
  var b = (sum_y/count) - (m*sum_x)/count; console.log('b:', b);

  /*
    * We will make the x and y result line now (we only need 2 points though).
    */
  var result_values_x = [];
  var result_values_y = [];

  for (var v = 0; v < values_length; v++) {
    x = values_x[v];
    y = x * m + b;
    result_values_x.push(x);
    result_values_y.push(y);
  }

  return {result_values_x:result_values_x, result_values_y:result_values_y};
}

// print a line on the graph
function updateGraph(points) {
  let lineDataset = myChart.data.datasets.filter(dataset => dataset.id == 'line');
  points.forEach(point => lineDataset[0].data.push(point))
  myChart.update();
}