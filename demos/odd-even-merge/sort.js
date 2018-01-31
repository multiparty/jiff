function createSubArr(a, index) {
  var subA = [];
  while (index < a.length) {
    subA.push(a[index]);
    index += 2;
  }
  return subA;
}

function compareExchange(a, i, j) {
  var c = a[i] < a[j];
  c = c ? 1 : 0;
  d = 1 - c;

  a[i] = (c * a[i]) + (d * a[j]);
  a[j] = (d * a[i]) + (c * a[j]);

  return a;
}


function odd_even_merge(a) {
  if (a.length > 2) {
    var evens = createSubArr(a, 0);
    var odds = createSubArr(a, 1);
    a = odd_even_merge(evens);
    a = odd_even_merge(odds);

    for (var i = 0; i < a.length; i+=2) {
      // compare exchange
      a = compareExchange(a, i, i+1);
    }
  } else {
    a = compareExchange(a, 0, 1);
  }
  // return a;
}

function odd_even_sort(a) {
  if (a.length > 1) {
    var mid = a.length / 2;
    odd_even_sort(a.slice(0,mid));
    odd_even_sort(a.slice(mid, a.length));
    odd_even_merge(a);
  }
}