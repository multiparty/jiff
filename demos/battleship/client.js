//==============================
// Game Variables
//==============================
var jiffPartyID;

var myShips = [];

// these reset every turn
var guesses = [];
var canPlay = false;
var isSettingUp = false;

// these update every time get answers from server
var numHitsOnMe = 0; // number of times opponent hits you
var numHitsOnOppo = 0; // number of times opponent hits you

//==============================
// Connect to JIFF
//==============================

function connect() {
    $('#connectButton').prop('disabled', true);

    // getting computation_id
    var computation_id = $('#computation_id').val();
    $('#room').text('Player Joined ' + computation_id);

    // var party_count = parseInt($('#count').val());
    var party_count = 2; // always 2 player game
  
    // if(isNaN(party_count)) {
    //   $("#output").append("<p class='error'>Party count must be a valid number!</p>");
    //   $('#connectButton').prop('disabled', false);
    // } else {

    // options will be passed down and eventually called when JIFF is ready
    var options = { party_count: party_count};
    options.onError = function(error) { $("#JIFF_output").append("<p class='error'>"+error+"</p>"); };
    options.onConnect = function() {
        // $("#button").attr("disabled", false); 
        $("#JIFF_output").append("<p>All parties Connected!</p>");
        startSetUpBoard();
    };
      
    // getting hostname
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

    //}
}

//==============================
// Send Game Data to JIFF and get data back
//==============================

// returns jiff_instance's id and store it to partyID
function submit_ship_locations() {
    let partyID_promise = mpc.share_ships(myShips);
    partyID_promise.then(handlePartyID);
}

// send guesses, returns answers by partyID
function submit_guesses() {
    let answer_promise = mpc.share_guesses(guesses);
    //answer_promise.then(handleAnswers);
    answer_promise.then(function(results) {
        console.log('resolved answer_promise: ' + results);
    });
}

//!!!!!!!!!!!!!!!!!! SUM STUFF !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // var input = parseInt($("#number").val());
    // if (isNaN(input))
    //   $("#output").append("<p class='error'>Input a valid number!</p>");
    // else if (100 < input || input < 0 || input != Math.floor(input))
    //   $("#output").append("<p class='error'>Input a WHOLE number between 0 and 100!</p>");
    // else {
    //   $("#button").attr("disabled", true);
    //   $("#output").append("<p>Starting...</p>");
    //   var promise = mpc.compute(input);
    //   promise.then(handleResult);
    // }

//==============================================================================================================

//==============================
// Update UI
//==============================
  
function handlePartyID(result) {
    jiffPartyID = result;
    console.log('My partyID is: ' + jiffPartyID);
}

function handleAnswers(result) {
    // Gati's two functions to update gameboards
    console.log('reached handle answers');
    // updateOppoBoard(result.myAnswers);
    // updateMyBoard(result.oppoAnswers);
}

//!!!!!!!!!!!!!!!!!! SUM STUFF !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // $("#output").append("<p>Result is: " + result + "</p>");
    // $("#button").attr("disabled", false);
// }
  
//==============================================================================================================
//==============================================================================================================
//==============================================================================================================
//==============================================================================================================
//==============================================================================================================
//==============================================================================================================


//==============================
// Game Functions -- Set Up Board
//==============================

// removes elements of menu and calls function to create new board
function startSetUpBoard() {
    $('#menu').remove();

    // add buttons here
    createOppoBoard();
    createMyBoard();
    $('#status').text('Pick 15 locations on your board to place your ships');
    isSettingUp = true;
}

//==============================
// Game Functions -- OppoBoard
//==============================

// dynamically generates buttons + header
function createOppoBoard() {

    $('#oppoBoard').append($('<div/>', {
        id: 'key',
        left: '50%',
    }));

    $('#key').append('<p style="color:Crimson;">HITS are RED</p>');
    $('#key').append('<p style="color:DarkBlue;">MISSES are BLUE</p>');
    $('#key').append('<p style="color:#00FA9A;">GUESSES are GREEN</p>');
    $('#key').append('<p style="color:black;">Your undiscovered ships are WHITE</p>');
    

    $('#oppoBoard').append($('<h2/>', {
        text: 'Opponent',
        left: '50%',
    }));

    $('#oppoBoard').append($('<h4/>', {
        text: 'Hits On Opponent: 0/15',
        id: 'hitsOnOppo',
        left: '50%',
    }));

    $('#status').text('Pick 5 locations');

    for (let i = 1; i <= 8; i++) {
        for(let j = 1; j <= 8; j++) {
            var button = $('<button/>', {
                text: i + '' + j,
                id: 'o_' + i + '' + j,
                disabled: false,
                width: window.innerWidth/8.5,
                height: 25,
            }).click(clickOppoBoardButton);
    
            $('#oppoBoard').append(button);
        }
        $('#oppoBoard').append($('<br/>'));
    }
}

// called on click by all buttons generated in create board
function clickOppoBoardButton(event) {
    if (canPlay) {
        index = parseInt(event.target.id.substring(2));
        event.target.disabled = true;
        // guesses are green
        event.target.style.background = 'MediumSeaGreen';
        addGuesses(index);
    }
}

// add all guesses to guesses[] and when get 5 guesses, sort and send to server
function addGuesses(guess) {
    guesses.push(guess);
    if (guesses.length == 5) {

        canPlay = false;
        $('#status').text('Waiting for other player...');

        guesses.sort(function(a, b) {return a-b});

        $('#guess_log').text('Guesses: ' + guesses);

        submit_guesses();
    }
}

//==============================
// Game Functions -- MyBoard
//==============================

// dynamically generates buttons + header
function createMyBoard() {
    
    $('#myBoard').append($('<h2/>', {
        text: 'Me',
        left: '50%',
    }));

    $('#myBoard').append($('<h4/>', {
        text: 'Ships placed: -',
        id: 'hitsOnMe',
        left: '50%',
    }));
    
    for (let i = 1; i <= 8; i++) {
        //let chr = String.fromCharCode(65 + i);
        for(let j = 1; j <= 8; j++) {
            var button = $('<button/>', {
                text: i + '' + j,
                id: 'm_' + i + '' + j,
                disabled: false,
                width: window.innerWidth/8.5,
                height: 25,
                class: 'myboard-buttons',
            }).click(placeShips);

            $('#myBoard').append(button);
        }
        $('#myBoard').append($('<br/>'));
    }

    // logs what guesses sent
    $('#myBoard').append($('<h4/>', {
        text: 'Guesses: -',
        id: 'guess_log',
        left: '50%',
    }));

    // logs what answers recieved
    $('#myBoard').append($('<h4/>', {
        text: 'Answers for my guesses: -',
        id: 'my_answer_log',
        left: '50%',
    }));

    $('#myBoard').append($('<h4/>', {
        text: 'Answers for opponent\'s guesses: -',
        id: 'oppo_answer_log',
        left: '50%',
    }));
}

function placeShips() {
    if (isSettingUp) {
        index = parseInt(event.target.id.substring(2));
        event.target.disabled = true;
        // placement is white
        event.target.style.background = '#ffffff';
        myShips.push(index);
        $('#hitsOnMe').text('Ships placed: ' + myShips.length);
    }
    if (myShips.length === 15) {
        isSettingUp = false;
        canPlay = true;
        $('.myboard-buttons').attr("disabled", "disabled");
        $('#status').text('Pick 5 locations on your Opponent\'s board to attack!');
        // send MPC server ship locations to share
        submit_ship_locations();
    }
}

//==============================
// Game Functions -- Update UI
//==============================

function updateOppoBoard(data) {
    $('#my_answer_log').text('Answers for my guesses: ' + data);

    for(let i = 0; i < guesses.length; i++) {
        let id = '#o_' + guesses[i];
        
        if(data[i] == 1) {
            // hits are brownish
            $(id).css("background-color", "Crimson");
            numHitsOnOppo++;
        }
        else {
            // misses are ocean blue
            $(id).css("background-color", "DarkBlue");
        }
    }
}

// update myBoard second
function updateMyBoard(data) {
    $('#oppo_answer_log').text('Answers for opponent\'s guesses: ' + data);

    for(let i = 0; i < data.length; i++) {

        if(data[i] == 1) {
            // hits are brownish
            numHitsOnMe++;
        }
    }
    // reset so can play next turn
    resetGameVars();
}

function resetGameVars() {
    canPlay = true;
    $('#status').text('Pick 5 locations on the enemy board to attack');
    $('#hitsOnMe').text('Hits On Me: ' + numHitsOnMe + '/15');
    $('#hitsOnOppo').text('Hits On Opponent: ' + numHitsOnOppo + '/15');

    guesses = [];

    if (numHitsOnOppo === 15) {iWon();}

    else if(numHitsOnMe === 15) {iLost();}
}

//==============================
// Game Functions -- Win/Loss Statements
//==============================

function iWon() {
    $('#status').text('YOU WON!');
    canPlay = false;
    alert('YOU WON! You hit all your opponent\'s ships!');
}

function iLost() {
    $('#status').text('YOU LOST...');
    canPlay = false;
    alert('YOU LOST! Your opponent hit all your ships!');
}

