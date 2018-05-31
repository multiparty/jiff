// the limits of the graph
let minX1 = 0;
let maxX1 = 10;
let minY1 = 0;
let maxY1 = 25;

const points1 = [];
const datasetPoints1 = {
    id:"data-points",
    label:"",
    data: points1,
    fill:false,
    showLine:false,
    pointBackgroundColor:"rgb(0,0,0)",
    pointRadius:5
};
const datasetLines1 = {
    id:"line",
    label:"",
    data: [],
    fill:false,
    pointBackgroundColor:"rgb(0,0,0)",
    borderColor:"rgb(0,0,0)",
    pointRadius:0.1
};
const ctx1 = document.getElementById("chart1").getContext('2d');
const chart1 = new Chart(ctx1, {
    type: 'line',
    data: {
        datasets: [datasetPoints1, datasetLines1]
    },
    options: {
        scales: {
            yAxes: [{
                ticks: {
                    min: minY1,
                    max: maxY1
                }
            }],
            xAxes: [{
                type: 'linear',
                position: 'bottom',
                ticks: {
                    min: minX1,
                    max: maxX1,
                    maxTicksLimit: 20
                }
            }]
        }
    }
});


// the limits of the graph
let minX2 = 0;
let maxX2 = 10;
let minY2 = 0;
let maxY2 = 25;

const points2 = [];
const datasetPoints2 = {
    id:"data-points",
    label:"",
    data: points2,
    fill:false,
    showLine:false,
    pointBackgroundColor:"rgb(0,0,0)",
    pointRadius:5
};
const datasetLines2 = {
    id:"line",
    label:"",
    data: [],
    fill:false,
    pointBackgroundColor:"rgb(0,0,0)",
    borderColor:"rgb(0,0,0)",
    pointRadius:0.1
};
const ctx2 = document.getElementById("chart2").getContext('2d');
const chart2 = new Chart(ctx2, {
    type: 'line',
    data: {
        datasets: [datasetPoints2, datasetLines2]
    },
    options: {
        scales: {
            yAxes: [{
                ticks: {
                    min: minY2,
                    max: maxY2
                }
            }],
            xAxes: [{
                type: 'linear',
                position: 'bottom',
                ticks: {
                    min: minX2,
                    max: maxX2,
                    maxTicksLimit: 20
                }
            }]
        }
    }
});

/**
 * Function takes the noisy point and the non-noisy point, displays both on the two graphs
 * and updates the avarages on the two graphs.
 * @param {object} points - The json object containing the two points {raw:{x,y},noisy:{x,y}}
 */
const displayPointsOnTwoGraphs = function(points) {
    // sainity checks
    if(isNaN(points.raw.x) || isNaN(points.raw.y) || isNaN(points.noisy.x) || isNaN(points.noisy.y)) {
        alert("One of the values is not a number.");
        console.warn(points);
        return;
    }
    
    // border controls
    minX1 = points.raw.x < minX1 ? points.raw.x+10 : minX1;
    maxX1 = points.raw.x > maxX1 ? points.raw.x+10 : maxX1;
    minY1 = points.raw.y < minY1 ? points.raw.y+10 : minY1;
    maxY1 = points.raw.y > maxY1 ? points.raw.y+10 : maxY1;
    minX2 = points.noisy.x < minX2 ? points.noisy.x+10 : minX2;
    maxX2 = points.noisy.x > maxX2 ? points.noisy.x+10 : maxX2;
    minY2 = points.noisy.y < minY2 ? points.noisy.y+10 : minY2;
    maxY2 = points.noisy.y > maxY2 ? points.noisy.y+10 : maxY2;
    console.log(minX1, maxX1, minY1, maxY1, minX2, maxX2, minY2, maxY2)
    chart1.options.scales = {
        yAxes: [{
            ticks: {
                min: minY1,
                max: maxY1
            }
        }],
        xAxes: [{
            type: 'linear',
            position: 'bottom',
            ticks: {
                min: minX1,
                max: maxX1,
                maxTicksLimit: 20
            }
        }]
    }
    chart2.options.scales = {
        yAxes: [{
            ticks: {
                min: minY2,
                max: maxY2
            }
        }],
        xAxes: [{
            type: 'linear',
            position: 'bottom',
            ticks: {
                min: minX2,
                max: maxX2,
                maxTicksLimit: 20
            }
        }]
    }

    // display the input points
    points1.push(points.raw);
    points2.push(points.noisy);
    
    // display the average
    const avg1 = points1.reduce((acc,curr) => acc+curr.y, 0) / points1.length;
    const avg2 = points2.reduce((acc,curr) => acc+curr.y, 0) / points2.length;
    datasetLines1.data = [{x:minX1, y:avg1}, {x:maxX1, y:avg1}];
    datasetLines2.data = [{x:minX2, y:avg2}, {x:maxX2, y:avg2}];

    // finally update the charts
    chart1.update();
    chart2.update();
}

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