"use strict";
/**
 * Do not modify this file unless you have to.
 * This file has UI handlers.
 */

function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = parseInt($('#count').val());

  if(isNaN(party_count)) {
    $("#output").append("<p class='error'>Party count must be a valid number!</p>");
    $('#connectButton').prop('disabled', false);
  } else {
    var options = { party_count: party_count};
    options.onError = function(error) { $("#output").append("<p class='error'>"+error+"</p>"); };
    options.onConnect = function() { $("#button").attr("disabled", false); $("#output").append("<p>All parties Connected!</p>"); };
    
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

/**
 * The button onclick event to add a data point to the set of points.
 * 
 * @param {string} xVal - The numerical x coordinate value input by the user.
 * @param {string} yVal - The numerical y coordinate value input by the user.
 */
const pushCoordinate = function(xVal, yVal) {
    // if(!jiff_instance) {
    //     alert("Please connect to jiff server first =)");
    //     return;
    // }

    let p = {
        x:parseInt(xVal),
        y:parseInt(yVal)
    };
    if(isNaN(p.x) || isNaN(p.y)) {
        alert("Please entre numeric values.");
        return;
    }

    if(restrict(p.x, p.y) == 1)
        return;

    $("#output").append("<p>"+p.x+"<br/>"+p.y+"</p>");

    // push coordinate to the 'coordinates' array
    coordinates.push(p);

    myChart.update();
    $("#xVal").val("");
    $("#yVal").val("");
}

function submit(values) {
  // if(!jiff_instance) {
  //   alert("Please connect to jiff server first =)");
  //   return;
  // }
  if(values.length < 1) {
      alert("Please input at least one point.");
      return;
  }
  $('#calculate').attr("disabled", true);
  $("#output").append("<p>Working...</p>");

  let promise = mpc.compute(values);
  promise.then(handleResult);
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
const printLineToGraph = (points) => {
    // Fetch the dataset of the best fit line.    
    let lineDataset = myChart.data.datasets.filter(dataset => dataset.id == "line");
    points.forEach(point => lineDataset[0].data.push(point))
    myChart.update();
}

/**
 * Function takes the input coordinate from the user and checks if it
 * conforms to the restriction or not.
 * This function should be removed when the fixed point extension is complete.
 * 
 * @param {number} x - The x coordinate entered by the user.
 * @param {number} y - The y coordinate entered by the user.
 * @returns {number} - 0 if the number conforms to the restrictions, and 1 if it doesn't.
 */
const restrict = function(x, y) {
  if(x < minX || x > maxX) {
      alert("Please input a value between " + minX + " and " + maxX + ".");
      return 1;
  }
  if(y < minY || y > maxY) {
      alert("Please input a value between " + minY + " and " + maxY + ".");
      return 1;
  }
  if(x != Math.floor(x) || y != Math.floor(y)) {
      alert("Please input whole numbers.");
      return 1;
  }
  return 0;
}