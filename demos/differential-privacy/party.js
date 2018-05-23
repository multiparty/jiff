
      var jiff_instance;

      function connect() {
        $('#connectButton').prop('disabled', true);
        var computation_id = $('#computation_id').val();
        var party_count = parseInt($('#count').val());

        if(isNaN(party_count)) {
          $("#output").append("<p class='error'>Party count must be a valid number!</p>");
          $('#connectButton').prop('disabled', false);
        } else {
          var options = {party_count: party_count, Zp: new BigNumber(32416190071), autoConnect: false };
          options.onError = function(error) { $("#output").append("<p class='error'>"+error+"</p>"); };
          options.onConnect = function() { $("#sumButton").attr("disabled", false); $("#output").append("<p>All parties Connected!</p>"); };

          var hostname = window.location.hostname.trim();
          var port = window.location.port;
          if(port == null || port == '') 
            port = "80";
          if(!(hostname.startsWith("http://") || hostname.startsWith("https://")))
            hostname = "http://" + hostname;
          if(hostname.endsWith("/"))
            hostname = hostname.substring(0, hostname.length-1);
          if(hostname.indexOf(":") > -1)
            hostanme = hostname.substring(0, hostname.indexOf(":"));

          hostname = hostname + ":" + port;
          jiff_instance = jiff.make_jiff(hostname, computation_id, options);
          jiff_instance = jiff_bignumber.make_jiff(jiff_instance, options)
          jiff_instance = jiff_fixedpoint.make_jiff(jiff_instance, { decimal_digits: 5, integral_digits: 5}); // Max bits after decimal allowed
          jiff_instance.connect();
        }
      }



      function vote() {

        let vote = 0;
        if (document.getElementById('hillary').checked) {
          vote++;
        }

        const noise = generateNoise();
        console.log(noise)

        MPC([vote, noise]);
        
    
      }

      function generateNoise() {
        
        const variance = calcVariance(0.5, 1, jiff_instance.party_count);

        const distribution = gaussian(jiff_instance.party_count, variance);

        return distribution.ppf(Math.random());

      }

      function calcVariance(epsilon, del, n) {
        return ((2 * Math.log(1.25/del)) * (((2 * n) - 1) / (epsilon * epsilon))) / n;
      }

      function sumShares(shares) {
        var sum = shares["1"];

        for (var i = 2; i <= Object.keys(shares).length; i++) {
          sum = sum.add(shares[i])
        }   
        
        return sum;
      }

      function MPC(inputs) {
        $("#sumButton").attr("disabled", true);
        $("#output").append("<p>Starting...</p>");

        const votes = jiff_instance.share(inputs[0]);
        const noises = jiff_instance.share(inputs[1]);

        const voteSum = sumShares(votes);
        const noiseSum = sumShares(noises);

        const finalSum = voteSum.sadd(noiseSum);

        jiff_instance.open(finalSum).then(handleResult);
      }

      function handleResult(results) {
        console.log('results',results)

        for(var i = 0; i < results.length; i++) {
          if(results[i] == null) continue;
          $("#res"+i).html(results[i]);
        }

        $("#sumButton").attr("disabled", false);
      }

      function handleError() {
        console.log("Error in open_all");
      }