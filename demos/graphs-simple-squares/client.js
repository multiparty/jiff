/**
 * Do not modify this file unless you have too
 * This file has UI handlers.
 */

function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();

  var options = { party_count:2, Zp: new BigNumber(32416190071), autoConnect: false };
  options.onError = function(error) { $("#output").append("<p class='error'>"+error+"</p>"); };
  options.onConnect = function(jiff_instance) {
    $("#button").attr("disabled", false);
    $("#output").append("<p>All parties Connected!</p>");

    if(jiff_instance.id == 1) {
      $('input:radio[name=choice]').val(['x']).attr("disabled", true);
      $("#output").append(`Please input x coordinates.<br/>`);
    } else {
      $('input:radio[name=choice]').val(['y']).attr("disabled", true);
      $("#output").append(`Please input y coordinates.<br/>`);
    }
  };
  
  var hostname = window.location.hostname.trim();
  var port = window.location.port;
  if(port == null || port == '') 
    port = "80";
  if(!(hostname.startsWith("http://") || hostname.startsWith("https://")))
    hostname = "http://" + hostname;
  if(hostname.endsWith("/"))
    hostname = hostname.substring(0, hostname.length-1);
  if(hostname.indexOf(":") > -1 && hostname.lastIndexOf(":") > hostname.indexOf(":"))
    hostname = hostname.substring(0, hostname.lastIndexOf(":"));

  hostname = hostname + ":" + port;
  mpc.connect(hostname, computation_id, options);
}

// The limits of the graph. The minimum and maximum X and Y values.
const minX = 0;
const maxX = 100;
const minY = 0;
const maxY = 100;

/**
 * Array of numbers. It holds the coordinates input by the user.
 */
let coordinates = [];

/** 
 * Array holding data point objects. This is populated automatically when the user inputs a point.
 * It has this format: [{x:number,y:number}]
 */
let input_data_points = [];

/**
 * The Chart.js object.
 */
let myChart;

/**
 * Function instantiates the chart.js object when the document loads.
 */
window.onload = () => {
  const ctx = document.getElementById("myChart").getContext('2d');
  myChart = new Chart(ctx, {
      type: 'line',
      data: {
          datasets: [
              // The specifications for the points input by the user.
              {
                  id:"data-points",
                  label:"",
                  data: input_data_points,
                  fill:false,
                  showLine:false,
                  pointBackgroundColor:"rgb(0,0,0)",
                  pointRadius:5
              },
              // The specifications for the best fit line.
              {
                  id:"line",
                  label:"",
                  data: [],
                  fill:false,
                  pointBackgroundColor:"rgb(0,0,0)",
                  borderColor:"rgb(0,0,0)",
                  pointRadius:0.1
              }
          ]
      },
      options: {
          scales: {
              // The axes specifications
              yAxes: [{
                  ticks: {
                      min: minY,
                      max: maxY
                  }
              }],
              xAxes: [{
                  type: 'linear',
                  position: 'bottom',
                  ticks: {
                      min: minX,
                      max: maxX,
                      maxTicksLimit: 20
                  }
              }]
          }
      }
  });
}


/**
 * The button onclick event to add a data point to the set of points.
 * 
 * @param {number/string} value - The numerical value input by the user.
 */
const pushCoordinate = function(value) {
  // check that jiff_instance is connected
  // if(!jiff_instance) {
  //     alert("Please connect to jiff server first =)");
  //     return;
  // }

  // check that the input is a numerical value
  let input = parseInt(value);
  if(isNaN(input))
      return;

  // check that the value conforms to the restrictions.
  // if(restrict(input, $('input[name=choice]:checked').val(), coordinates) == 1) return;

  $("#output").append("<p>"+input+"</p>");

  // push coordinate to the 'coordinates' array
  coordinates.push(input);

  // create a data point object depending on the axis, then push it to the array.
  let p;
  if($('input[name=choice]:checked').val() == 'x')
    p = {x:input,y:0};
  else
    p = {y:input,x:0};
  input_data_points.push(p);

  myChart.update();
  document.getElementById("val").value = "";
}


const submit = (values) => {
  // if(!jiff_instance) {
  //   alert("Please connect to jiff server first =)");
  //   return;
  // }
  if(values.length < 2) {
    alert("2 points or more are needed to make a straight line.");
    return;
  }
  $('#calculate').attr("disabled", true);
  $("#output").append("<p>Working...</p>");

  let promise;
  if($('input[name=choice]:checked').val() === 'x')
    promise = mpc.computeRoleX(values);
  else
    promise = mpc.computeRoleY(values);
  promise.then(handleResult)
}


/**
 * Function displays the line of best fit on the graph after the computation finishes.
 * It computes the two points at the minimum X and maximum X of the graph, puts them in an
 * array and passes it to the printLineToGraph function.
 * 
 * @param {number} m - The slope.
 * @param {number} b - The y intercept.
 */
const handleResult = (m, b) => printLineToGraph( [{x:minX,y:m*minX+b}, {x:maxX,y:m*maxX+b}] );


/**
 * Function displays an array of points as a curve on the graph.
 * It's used to display the best fit line after the computation is complete.
 * 
 * @param {Array} points - The array of points to display. It has this format: [{x:number,y:number}]
 */
const printLineToGraph = function(points) {
  // Fetch the dataset of the best fit line.
  let lineDataset = myChart.data.datasets.filter(dataset => dataset.id == "line");
  points.forEach(point => lineDataset[0].data.push(point));
  myChart.update();
}


/**
 * Function takes the input value from the user and checks if it
 * conforms to the restriction or not.
 * This function should be removed when the fixed point extension is complete.
 * 
 * @param {number} input - The number entered by the user.
 * @param {string} this_axis - 'x' or 'y'. The axis assigned to this user.
 * @param {Array} coordinates - The array of previously entered coordinates.
 * @returns {number} - 0 if the number conforms to the restrictions, and 1 if it doesn't.
 */
const restrict = function(input, this_axis, coordinates) {
  if(this_axis == 'x') { // The checks if this user has the x axis.
    if(input < -100 || input > -50) {
      alert("Please input a value between -100 and -50!");
      return 1;
    }
    if(input != Math.floor(input)) {
      alert("Please input a whole number.");
      return 1;
    }
    let diff = input - coordinates[coordinates.length -1];
    if(diff > 5) {
      alert("The difference between this number and the last number entered must not be greater than 5");
      return 1;
    }
    if(diff < 1) {
      alert("This number must be greater than the last number");
      return 1;
    }
  }
  else { // The checks if this user has the y axis.
    if(input < 50 || input > 100) {
      alert("Please input a value between fifty and one hundred!");
      return 1;
    }
    if(input != Math.floor(input)) {
      alert("Please input a whole number.");
      return 1;
    }
    let diff = input - coordinates[coordinates.length -1];
    if(diff < 5 || diff > 10) {
      alert("The difference between this number and the last number entered must not be less than 5 nor greater than 10");
      return 1;
    }
    if(diff < 1) {
      alert("This number must be greater than the last number");
      return 1;
    }
  }
  return 0;
}