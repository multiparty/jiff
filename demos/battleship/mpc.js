(function(exports, node) {
    
    var saved_instance;
    var ships;
    var guesses;

    var p1_answers = null;
    var p2_answers = null;
  
    /**
     * Connect to the server and initialize the jiff instance
     */
    exports.connect = function (hostname, computation_id, options) {
      var opt = Object.assign({}, options);
  
      if(node)
        jiff = require('../../lib/jiff-client');
  
      saved_instance = jiff.make_jiff(hostname, computation_id, opt);
      return saved_instance;
    };


    // share ship locations, return your party_id
    exports.share_ships = function (input, jiff_instance) {
        if(jiff_instance == null) jiff_instance = saved_instance;

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
    // fix me
    function check_answers(p_guesses, p_ships){
        let answers = [];
        // 0 = miss
        // 1 = hit
        for (let g = 0; g < p_guesses.length; g++) {
            answers[g] = p_guesses[g].cmult(0); // is this a secret share?
            for (let s = 0; s < p_ships.length; s++) {
                let a = p_guesses[g];
                let b = p_ships[s];
                answers[g] = answers[g].sadd(a.seq(b));
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
            console.log('about to check p1 answers');
            p1_answers = check_answers(guesses[1], ships[2]);
            console.log('about to check p2 answers');
            p2_answers = check_answers(guesses[2], ships[1]);

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



    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! from array-substring/mpc !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!



    // exports.compute = function (input, jiff_instance) {
    //     if(jiff_instance == null) jiff_instance = saved_instance;
    
    //     // The MPC implementation should go *HERE*
    //     var final_deferred = $.Deferred(); // this will resolve to the final result
    //     var final_promise = final_deferred.promise(); // which is an array of 0/1 values for every index in the haystack
        
    //     // First, turn the string into an array of numbers
    //     var asciiCodes = [];
    //     for(var i = 0; i < input.length; i++)
    //       asciiCodes.push(input.charCodeAt(i));
    
    //     // Now secret share the array of numbers
    //     var inputPromise = jiff_instance.share_array(asciiCodes);
    
    //     // Perform the computation
    //     inputPromise.then(function(shares) {
    //       // Party 1 provides the haystack in which to look
    //       var haystack = shares[1];
    
    //       // Party 2 provides the needle to find
    //       var needle = shares[2];
          
    //       // Store a promise to the result of looking for the needle in every index
    //       var results = [];
    
    //       // Look for needle at every index in the haystack
    //       for(var i = 0; i <= haystack.length - needle.length; i++) {
    //         // Compare all the characters till the end of the substring
    //         var comparison = haystack[i].seq(needle[0]);
    //         for(var j = 1; j < needle.length; j++) {
    //           comparison = comparison.smult(haystack[i+j].seq(needle[j]));
    //         }
    
    //         results[i] = comparison.open();
    //       }
    
    //       // Combine the promises for every index, when the result is ready, pass it to the final_promise
    //       Promise.all(results).then(function(results) {
    //         final_deferred.resolve(results);
    //       });
    // });









    //!!!!!!!!!!!!!!!!!! SUM STUFF !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // exports.compute = function (input, jiff_instance) {
    //   if(jiff_instance == null) jiff_instance = saved_instance;
  
    //   // The MPC implementation should go *HERE*
    //   var shares = jiff_instance.share(input);
    //   var sum = shares[1];
    //   for(var i = 2; i <= jiff_instance.party_count; i++) {
    //     sum = sum.sadd(shares[i]);
    //   }
      
    //   // Return a promise to the final output(s)
    //   return jiff_instance.open(sum);
    // };






  }((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));  