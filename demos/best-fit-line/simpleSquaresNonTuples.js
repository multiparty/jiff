"use strict";

let jiff_instance;
const connect = function() {
    $('#connectButton').prop('disabled', true);
    const computation_id = $('#computation_id').val();
    const party_count = parseInt($('#count').val());

    const options = {party_count:2}; //, Zp: new BigNumber(32416190071)};
    options.onError = function(error) { $("#output").append("<p class='error'>"+error+"</p>"); };
    options.onConnect = function() {
        $("#output").append("<p>All parties Connected!</p>");
        if(jiff_instance.id == 1) {
            $('input:radio[name=choice]').val(['x']).attr("disabled", true);
            $("#output").append(
                `Please input x coordinates.<br/>
                >>Their count has to be equal to the count of the other party's coordinates.<br/>
                >> They have to be between -100 and -50.<br/>
                >> Each entered point has to be greater than the previous entered point.<br/>
                >> Each entered point can't be more than 5 points apart from the previous point.<br/>`);
        } else {
            $('input:radio[name=choice]').val(['y']).attr("disabled", true);
            $("#output").append(
                `Please input y coordinates.<br/>
                >> Their count has to be equal to the count of the other party's coordinates.<br/>
                >> They have to be between 50 and 100.<br/>
                >> Each entered point has to be greater than the previous entered point.<br/>
                >> Each entered point can't be 'less than 5 points' apart from the previous point.<br/>
                >> Each entered point can't be 'more than than 10 points' apart from the previous point.<br/>`);
        }
    };
    
    let hostname = window.location.hostname.trim();
    const port = window.location.port;
    if(port == null || port == '') 
        port = "80";
    if(!(hostname.startsWith("http://") || hostname.startsWith("https://")))
        hostname = "http://" + hostname;
    if(hostname.endsWith("/"))
        hostname = hostname.substring(0, hostname.length-1);
    
    hostname = hostname + ":" + port;
    jiff_instance = jiff.make_jiff(hostname, computation_id, options);
    // jiff_instance = jiff_bignumber.make_jiff(jiff_instance, options)
    // jiff_instance = jiff_fixedpoint.make_jiff(jiff_instance, { decimal_digits: 5, integral_digits: 5}); // Max bits after decimal allowed
}


// The limits of the graph. The minimum and maximum X and Y values.
const minX = -100;
const maxX = 0;
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
    if(!jiff_instance) {
        alert("Please connect to jiff server first =)");
        return;
    }

    // check that the input is a numerical value
    let input = parseInt(value);
    if(isNaN(input))
        return;

    // check that the value conforms to the restrictions.
    if(restrict(input, $('input[name=choice]:checked').val(), coordinates) == 1)
        return;

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


/**
 * The button onclick event to start the computation to calculate the best fit line.
 * 
 * @param {Array} values - The array of numbers input by the user. 
 */
const calculateLeastSquares = function(values) {
    if(!jiff_instance) {
        alert("Please connect to jiff server first =)");
        return;
    }
    if(values.length < 2) {
        alert("2 points or more are needed to make a straight line.");
        return;
    }
    $('#calculate').attr("disabled", true);
    $("#output").append("<p>Working...</p>");

    let this_axis = $('input[name=choice]:checked').val();
    let shares_array = [];

    if(this_axis == 'x') { // The ID of this party is 1
        let sum_x = values.reduce((a,c) => a + c);
        let sum_xx = values.reduce((a,c) => a+c*c, 0);
        let t1 = values.length*sum_xx-sum_x*sum_x;

        let sum_xy = shareAndCalculateSumXY(values);
        let c__sum_xy = sum_xy.mult(values.length);

        let sum_x__sum_y = jiff_instance.share(sum_x);
        sum_x__sum_y = sum_x__sum_y[1].mult(sum_x__sum_y[2]);

        let mNumerator = c__sum_xy.sub(sum_x__sum_y);

        let denom = values.length*sum_xx-sum_x*sum_x;
        denom = jiff_instance.share(denom);
        denom = denom[1].add(denom[2]);
        let m = mNumerator.div(denom);

        m.open(function(m_opened) {
            console.info("Slope:", m_opened);
            let m_sum_x_d_count = Math.floor(-1*(m_opened*sum_x)/values.length);
            console.info("-1*(m*sum_x/count)=", m_sum_x_d_count);
            m_sum_x_d_count = jiff_instance.share(m_sum_x_d_count);
            let b = m_sum_x_d_count[1].add(m_sum_x_d_count[2]);
            b.open(function(b_opened) {
                console.info("Y intercept:", b_opened);
                display_after_open(m_opened, b_opened);
            });
        });

    } else { // The ID of this party is 2
        let sum_y = values.reduce((a,c) => a + c);

        let sum_xy = shareAndCalculateSumXY(values);
        let c__sum_xy = sum_xy.mult(values.length);

        let sum_x__sum_y = jiff_instance.share(sum_y);
        sum_x__sum_y = sum_x__sum_y[1].mult(sum_x__sum_y[2]);

        let mNumerator = c__sum_xy.sub(sum_x__sum_y);

        let denom = jiff_instance.share(0);
        denom = denom[1].add(denom[2]);
        let m = mNumerator.div(denom);

        m.open(function(m_opened) {
            console.info("Slope:", m_opened);
            let sum_y_d_count = Math.floor(sum_y/values.length);
            console.info("sum_y/count=", sum_y_d_count);
            sum_y_d_count = jiff_instance.share(sum_y_d_count);
            let b = sum_y_d_count[1].add(sum_y_d_count[2]);
            b.open(function(b_opened) {
                console.info("Y intercept:", b_opened);
                display_after_open(m_opened, b_opened);
            });
        });
    }
}

/**
 * Helper function calculates sum_xy.
 * 
 * @param {Array} values - The array of values input by this party. 
 */
const shareAndCalculateSumXY = function(values) {
    let sum_xy_res;
    for(let i = 0; i < values.length; i++) {
        let t = jiff_instance.share(values[i]);
        t = t[1].mult(t[2]);
        if(sum_xy_res)
            sum_xy_res = sum_xy_res.add(t);
        else
            sum_xy_res = t;
    }
    return sum_xy_res;
}


/**
 * Function displays the line of best fit on the graph after the computation finishes.
 * It computes the two points at the minimum X and maximum X of the graph, puts them in an
 * array and passes it to the printLineToGraph function.
 * 
 * @param {number} m - The slope.
 * @param {number} b - The y intercept.
 */
const display_after_open = (m, b) => printLineToGraph( [{x:minX,y:m*minX+b}, {x:maxX,y:m*maxX+b}] );


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