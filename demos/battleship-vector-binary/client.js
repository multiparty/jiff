//==============================
// Game Variables
//==============================
var jiffPartyID;

var numRows = 8;
var numCols = 8;

var guesses_len = 5;
var ships_len = 15;

var emptyBoard = []; // will be filled and then copied for guesses and myShips

var myShips = [];
var myShipsCount = 0;

// these reset every turn
var guesses = [];
var guessesCount = 0;
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
    answer_promise.then(handleAnswers);
}

//==============================
// Update UI
//==============================
  
function handlePartyID(result) {
    jiffPartyID = result;
    console.log('My partyID is: ' + jiffPartyID);
}

function handleAnswers(result) {
    console.log('reached handle answers');
    // Gati's two functions to update gameboards
    let p1_answers = result.splice(0, emptyBoard.length);
    let p2_answers = result;

    let myAnswers = (jiffPartyID == 1) ? p1_answers : p2_answers;
    let oppoAnswers = (jiffPartyID == 1) ? p2_answers : p1_answers;
    
    updateOppoBoard(myAnswers);
    updateMyBoard(oppoAnswers);
}

//==============================
// Game Functions -- Set Up Board
//==============================

// removes elements of menu and calls function to create new board
function startSetUpBoard() {
    $('#menu').remove();

    for(let i = 0; i < numCols*numRows; i++) {
        emptyBoard.push(0);
    }

    myShips = emptyBoard.slice();
    guesses = emptyBoard.slice();

    // add buttons here
    createOppoBoard();
    createMyBoard();
    $('#status').text('Pick ' + ships_len + ' locations on your board to place your ships');
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
        text: 'Hits On Opponent: 0/' + ships_len,
        id: 'hitsOnOppo',
        left: '50%',
    }));

    $('#status').text('Pick ' + guesses_len + ' locations to attack');

    for (let i = 0; i < numRows*numCols; i++) {
        var button = $('<button/>', {
            text: i,
            id: 'o_' + i,
            disabled: false,
            width: window.innerWidth/(numCols + 1),
            height: 25,
        }).click(clickOppoBoardButton);
    
        $('#oppoBoard').append(button);
        if(i%numCols === numCols-1) $('#oppoBoard').append($('<br/>'));
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
    
    guesses[guess] = 1;
    guessesCount++;

    if (guessesCount == guesses_len) {

        canPlay = false;
        $('#status').text('Waiting for other player...');

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
    
    for (let i = 0; i < numRows*numCols; i++) {
        var button = $('<button/>', {
            text: i,
            id: 'm_' + i,
            disabled: false,
            width: window.innerWidth/(numCols + 1),
            height: 25,
            class: 'myboard-buttons',
        }).click(placeShips);

        $('#myBoard').append(button);
        if(i%numCols === numCols-1) $('#myBoard').append($('<br/>'));
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
        
        myShips[index] = 1;
        myShipsCount++;
        $('#hitsOnMe').text('Ships placed: ' + myShipsCount  + '/' + ships_len);
    }
    if (myShipsCount === ships_len) {
        isSettingUp = false;
        canPlay = true;
        $('.myboard-buttons').attr("disabled", "disabled");
        $('#status').text('Pick ' + guesses_len + ' locations on your Opponent\'s board to attack!');
        // send MPC server ship locations to share
        submit_ship_locations();
    }
}

//==============================
// Game Functions -- Update UI
//==============================

function updateOppoBoard(data) {
    $('#my_answer_log').text('Answers for my guesses: ' + data);

    for(let i = 0; i < data.length; i++) {
        let id = '#o_' + i;
        
        if(data[i] == 1) {
            // hits are brownish
            $(id).css("background-color", "Crimson");
            numHitsOnOppo++;
        }
    }
}

// update myBoard second
function updateMyBoard(data) {
    $('#oppo_answer_log').text('Answers for opponent\'s guesses: ' + data);

    for(let i = 0; i < data.length; i++) {

        if(data[i] == 1) {
            numHitsOnMe++;
        }
    }
    // reset so can play next turn
    resetGameVars();
}

function resetGameVars() {
    canPlay = true;
    $('#status').text('Pick ' + guesses_len + ' locations on your Opponent\'s board to attack!');
    $('#hitsOnMe').text('Hits On Me: ' + numHitsOnMe + '/' + ships_len);
    $('#hitsOnOppo').text('Hits On Opponent: ' + numHitsOnOppo + '/' + ships_len);

    guesses = emptyBoard.slice();
    guessesCount = 0;

    if (numHitsOnOppo === ships_len) {iWon();}

    else if(numHitsOnMe === ships_len) {iLost();}
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

