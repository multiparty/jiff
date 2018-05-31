// the limits of the graph
const minX = 0;
const maxX = 10;
const minY = 0;
const maxY = 25;


// array holds the coordinates input by the user.
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

/**
 * Function takes the noisy point and the non-noisy point, displays both on the two graphs
 * and updates the avarages on the two graphs.
 * @param {object} points - The json object containing the two points {raw:{x,y},noisy:{x,y}}
 */
const displayPointsOnTwoGraphs = function(points) {
    if(isNaN(points.raw.x) || isNaN(points.raw.y) || isNaN(points.noisy.x) || isNaN(points.noisy.y)) {
        alert("One of the values isNaN");
        console.warn(points);
        return;
    }

    points1.push(points.raw);
    points2.push(points.noisy);
    
    const avg1 = points1.reduce((acc,curr) => acc+curr.y, 0) / points1.length;
    const avg2 = points2.reduce((acc,curr) => acc+curr.y, 0) / points2.length;
    datasetLines1.data = [{x:minX, y:avg1}, {x:maxX, y:avg1}];
    datasetLines2.data = [{x:minX, y:avg2}, {x:maxX, y:avg2}];
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