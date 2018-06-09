/**
 * Do not modify this file unless you have too
 * This file has UI handlers.
 */

function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = parseInt($('#count').val());
  var party_id = parseInt($('#role').val());

  if(isNaN(party_count)) {
    $("#output").append("<p class='error'>Party count must be a valid number!</p>");
    $('#connectButton').prop('disabled', false);
  } else {
    var options = { party_count: party_count, party_id: party_id }; //, Zp: new BigNumber("32416190071"), autoConnect: false};
    options.onError = function(error) { $("#output").append("<p class='error'>"+error+"</p>"); };
    options.onConnect = function(jiff_instance) {
      $("#role").attr("disabled", true);    
      $("#submit").attr("disabled", false);
      $("#output").append("<p>All parties Connected!</p>");

      if (jiff_instance.id === 1)
        $("#role1").css("display", "block");
      else
        $("#role2").css("display", "block");
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
}


// The limits of the graph. The minimum and maximum X and Y values.
const minX = 0;
const maxX = 10;
const minY = 0;
const maxY = 25;


/**
 * Array of coordinate pairs. It holds the coordinates input by the user.
 * It has the following format: [{x:number,y:number}]
 */
let coordinates = [];
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
                    data: coordinates,
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

const submitLine = (slopeInput, yInterceptInput) => {
  let slope = parseInt(slopeInput);
  let yIntercept = parseInt(yInterceptInput);

  if (isNaN(slope) || isNaN(yIntercept)) {
    alert("Please input numbers.");
    return;
  }

  $("#submit1").attr("disabled", true);
  displayLineSlopeYIntercept(slope, yIntercept);
  const promise = mpc.compute({one:slope, two:yIntercept});
  promise.then(handleResult);
}

const submitPoint = (xValInput, yValInput) => {
  let xVal = parseInt(xValInput);
  let yVal = parseInt(yValInput);

  if (isNaN(xVal) || isNaN(yVal)) {
    alert("Please input numbers.");
    return;
  }

  $("#submit2").attr("disabled", true);
  coordinates.push({x:xVal, y:yVal});
  myChart.update();
  const promise = mpc.compute({one:xVal, two:yVal});
  promise.then(handleResult);
}

const handleResult = (result) => {
  if (result === 1)
    $("#output").append("<p>Point is above line</p>");
  else
    $("#output").append("<p>Point is below line</p>");

  $("#button").attr("disabled", false);
}

/**
 * Function displays the line of best fit on the graph after the computation finishes.
 * It computes the two points at the minimum X and maximum X of the graph, puts them in an
 * array and passes it to the printLineToGraph function.
 * 
 * @param {number} m - The slope.
 * @param {number} b - The y intercept.
 */
const displayLineSlopeYIntercept = (m, b) => printLineToGraph( [{x:minX,y:m*minX+b}, {x:maxX,y:m*maxX+b}] );


/**
 * Function displays an array of points as a curve on the graph.
 * It's used to display the best fit line after the computation is complete.
 * 
 * @param {Array} points - The array of points to display. It has this format: [{x:number,y:number}]
 */
const printLineToGraph = function(points) {
    // Fetch the dataset of the best fit line.    
    let lineDataset = myChart.data.datasets.filter(dataset => dataset.id == "line");
    points.forEach(point => lineDataset[0].data.push(point))
    myChart.update();
}
