
function compareExchange(a, i, j) {
  var c = a[i] < a[j];
  c = c ? 1 : 0;
  var d = 1 - c;

  var x = a[i];
  var y = a[j];

  a[i] = (c * x) + (d * y);
  a[j] = (d * x) + (c * y);
}


function oddEvenMerge(a, lo, n, r) {
  var m = r * 2;
  if (m < n) {
    oddEvenMerge(a, lo, n, m);
    oddEvenMerge(a, lo+r, n, m);

    for (var i = (lo+r); (i+r)<(lo+n); i+=m)  {
      compareExchange(a, i, i+r);
    }
  } else {
    compareExchange(a,lo,lo+r);
  }
}

function oddEvenSort(a, lo, n) {
  if (n > 1) {
    var m = n/2;
    oddEvenSort(a, lo, m);
    oddEvenSort(a, lo+m, m);
    oddEvenMerge(a, lo, n, 1);
  }
}


function generateRand(n) {
  var arr = [];
  for (var i = 0; i < n; i++) {
      arr[i] = Math.floor(Math.random() * n);
  }
  return arr;
}
  
function arrayEquality(a, b) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] != b[i]) {
      return false;
    }
  }
  return true;
}


function checkSorted(a) {
  for (var i = 0; i < a.length-1; i++) {
    if (a[i] > a[i+1]) {
      return false;
    }
  }
  return true;
}

function test() {

  for (var i = 0; i < 100; i++) {
    var a = generateRand(128);
  
    oddEvenSort(a, 0, a.length);

    if (!checkSorted(a)) {
      console.log('TEST FAILED: ' + i);
    }

  }
  console.log('ALL TESTS DONE')
    // var n = 128;
    // // for (var i = 0; i < n; i=i/2) {
    //     var a = generateRand(100);
    //     // console.log(a)
    //     var sorted = a.sort();
    //     var oddEvenSorted = oddEvenSort(a, 0, a.length);

    //     if (!arrayEquality(sorted, oddEvenSorted)) {
    //         console.log('Test failed:');
    //     }
    // // }
    // console.log("All tests passed");
}

  test();