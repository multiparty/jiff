(function(exports, node) {
    
    var saved_instance;
    var ships;
    var guesses;
    var version;

    var p1_answers = null;
    var p2_answers = null;
  
    /**
     * Connect to the server and initialize the jiff instance
     */
    exports.connect = function (hostname, computation_id, options, v) {
        version = v;
        var opt = Object.assign({}, options);
        switch(version) {
            case 1:
                opt.Zp = 67;
                break;
            case 2:
                opt.Zp = 2;
                break;
            case 3:
                opt.Zp = 149;
                break;
        }
        if(node)
            jiff = require('../../lib/jiff-client');
        saved_instance = jiff.make_jiff(hostname, computation_id, opt);
        return saved_instance;
    };


    // share ship locations, return your party_id
    exports.share_ships = function (input, jiff_instance) {
        if(jiff_instance == null) jiff_instance = saved_instance;

        return new Promise(function(resolve) {
            let promise_ships = jiff_instance.share_array(input);
            promise_ships.then(function(res_ships) {
                ships = res_ships;
                resolve(jiff_instance.id);
            });
        });
    };

    /**
     * The MPC computation
     */

    function index_check_answers(p_guesses, p_ships){
        let answers = saved_instance.server_generate_and_share({nonzero: true, count: p_guesses.length});
        // any number = miss
        // 0 = hit
        for (let g = 0; g < p_guesses.length; g++) {
            let a = p_guesses[g];
            for (let s = 0; s < p_ships.length; s++) {
                let b = p_ships[s];
                answers[g] = answers[g].smult(a.ssub(b)); // if this is 0, then there should be a hit
            }
        }
        console.log('checked p answers');
        return answers; // an array of secret shares
    };


    function binary_check_answers(p_guesses, p_ships) {
        let answers = [];
        // 0 = miss
        // 1 = hit
        for (let i = 0; i < p_ships.length; i++) {
            answers[i] = p_ships[i].smult(p_guesses[i]);
        }

        console.log('checked p answers');
        return answers; // an array of secret shares
    };


    function row_col_check_answers(p_guesses, p_ships){
        // any number = miss
        // 0 = hit
        let answers = saved_instance.server_generate_and_share({nonzero: true, count: p_guesses.length/2});
        for (let g = 0; g < p_guesses.length; g+=2) {
            let g_row = p_guesses[g];
            let g_col = p_guesses[g+1];
            for (let s = 0; s < p_ships.length; s+=2) {
                let s_row = p_ships[s];
                let s_col = p_ships[s+1];
                // MPC
                let d1 = g_row.ssub(s_row);
                let d2 = g_col.ssub(s_col);
                answers[g/2] = d1.cadd(5).smult(d2.cadd(5)).csub(25).smult(answers[g/2]);
                // a = ((d1 + 5) * (d2 + 5) - 25) * a;
            }
        }
        console.log('checked p answers');
        return answers; // an array of secret shares
    };



    // gets guesses and partyID, shares guesses, check guesses, return answers and party_id
    exports.share_guesses = function (input, jiff_instance) {
        if(jiff_instance == null) jiff_instance = saved_instance;

        var final_deferred = $.Deferred();
        var final_promise = final_deferred.promise();

        // first share array
        let promise_guesses = jiff_instance.share_array(input);
        promise_guesses.then(function(res_guesses) {
            // assign guesses the secret shares
            guesses = res_guesses;

            // do MPC computation and get answers
            console.log('version: ' + version);
            switch(version) {
                case 1:
                    p1_answers = index_check_answers(guesses[1], ships[2]);
                    p2_answers = index_check_answers(guesses[2], ships[1]);
                    break;
                case 2:
                    p1_answers = binary_check_answers(guesses[1], ships[2]);
                    p2_answers = binary_check_answers(guesses[2], ships[1]);
                    break;
                case 3:
                    p1_answers = row_col_check_answers(guesses[1], ships[2]);
                    p2_answers = row_col_check_answers(guesses[2], ships[1]);
                    break;
                default:
                    p1_answers = index_check_answers(guesses[1], ships[2]);
                    p2_answers = index_check_answers(guesses[2], ships[1]);
            }

            // open returns a promise, put all those promises into arrays, with player1's answers put in first
            var allPromises = [];
            for(let i = 0; i < p1_answers.length; i++) {
                allPromises.push(jiff_instance.open(p1_answers[i]));
            }
            console.log('finished putting p1 answers in allPromises');
            for(let i = 0; i < p2_answers.length; i++) {
                allPromises.push(jiff_instance.open(p2_answers[i]));
            }
            console.log('finished putting p2 answers in allPromises');

            // resolve all promises and put them into final_deferred
            Promise.all(allPromises).then(function(results) {
                console.log('at: final_defered.resolve(results)');
                final_deferred.resolve(results);
            });
        });
        // wrap final_deferred into a promise and return it
        console.log('returned final_promise');
        return final_promise;
    };

  }((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));  