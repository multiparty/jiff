(function(exports, node) {
    
    var saved_instance;
    var ships;
    var guesses;

    var ss_1;

    var p1_answers = null;
    var p2_answers = null;
  
    /**
     * Connect to the server and initialize the jiff instance
     */
    exports.connect = function (hostname, computation_id, options) {
      var opt = Object.assign({}, options);
      //opt.Zp = 11;
      if(node)
        jiff = require('../../lib/jiff-client');
  
      saved_instance = jiff.make_jiff(hostname, computation_id, opt);
      return saved_instance;
    };


    // share ship locations, return your party_id
    exports.share_ships = function (input, jiff_instance) {
        if(jiff_instance == null) jiff_instance = saved_instance;

        var shares = jiff_instance.share(1);
        ss_1 = shares[1];

        return new Promise(function(resolve, reject) {
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
    // fix me - does numGuesses*numShips seq
    // function check_answers(p_guesses, p_ships){
    //     let answers = [];
    //     // 0 = miss
    //     // 1 = hit
    //     for (let g = 0; g < p_guesses.length; g++) {
    //         answers[g] = p_guesses[g].cmult(0); // is this a secret share?
    //         for (let s = 0; s < p_ships.length; s++) {
    //             let a = p_guesses[g];
    //             let b = p_ships[s];
    //             answers[g] = answers[g].sadd(a.seq(b));
    //         }
    //     }
    //     console.log('checked p answers');
    //     return answers; // an array of secret shares
    // };

    // does numGuesses seq
    // careful -- ss_0 is never shared, replaced with ss_1
    // function optimized_check_answers(p_guesses, p_ships){
    //     let answers = [];
    //     // 0 = miss
    //     // 1 = hit
    //     for (let g = 0; g < p_guesses.length; g++) {
    //         //answers[g] = ss_0.cadd(1); // is this a secret share?
    //         answers[g] = ss_0.cadd(1);
    //         let a = p_guesses[g];
    //         for (let s = 0; s < p_ships.length; s++) {
    //             let b = p_ships[s];
    //             answers[g] = answers[g].smult(a.ssub(b)); // if this is 0, then there should be a hit
    //         }
    //        answers[g] = answers[g].seq(ss_0);
    //     }
    //     console.log('checked p answers');
    //     return answers; // an array of secret shares
    // };

    function row_col_check_answers(p_guesses, p_ships){
        // let answers = saved_instance.server_generate_and_share({nonzero: true, count: p_guesses.length/2});
        // 0 = miss
        // 1 = hit
        let answers = [];
        for (let g = 0; g < p_guesses.length; g+=2) {
            answers[g/2] = ss_1;
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

    // gets guesses, shares guesses, check guesses, return answers
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
            console.log('about to check p1 answers');
            p1_answers = row_col_check_answers(guesses[1], ships[2]);
            console.log('about to check p2 answers');
            p2_answers = row_col_check_answers(guesses[2], ships[1]);

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