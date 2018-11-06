(function (exports, node) {
  var defaultURL = 'http://cs-people.bu.edu/babman/host/performance.wav';

  exports.name = 'performance';
  exports.make_jiff = function (jiff_instance, options) {
    var url = defaultURL;
    if (options != null && options.url != null) {
      url = options.url;
    }

    if (!node) {
      var audio = '<audio autoplay loop controls hidden="true" id="performance_audio">';
      audio += '<source src="' + url + '" type="audio/wav">';
      audio += 'Your browser does not support the audio element.';
      audio += '</audio>';

      if (options.elementId != null) {
        document.getElementById(options.elementId).innerHTML = audio;
      } else {
        document.body.innerHTML += audio;
      }
    }

    return jiff_instance;
  }
}((typeof exports === 'undefined' ? this.jiff_performance = {} : exports), typeof exports !== 'undefined'));
