
function compareExchange(a, i, j) {
  // console.log('arr', i,j)
  var c = a[i] < a[j];
  c = c ? 1 : 0;
  var d = 1 - c;

  var x = a[i];
  var y = a[j];

  a[i] = (c * x) + (d * y);
  a[j] = (d * x) + (c * y);

  // console.log('arr', a[i], a[j])
}


function getIndices(indices, start) {
  var skipped = [];

  for (var i = start; i < indices.length; i+=2) {
    skipped.push(indices[i]);
  }

  return skipped;
}

function oddEvenMerge(a, indices) {
 

  if (indices.length > 2) {
    evens = getIndices(indices, 0);
    oddEvenMerge(a, evens);
    odds = getIndices(indices,1);
    oddEvenMerge(a, odds);

    for (var i = 0; i < indices.length; i+=2) {
      // console.log('i',indices[i], indices[i+1], indices)
      compareExchange(a, indices[i], indices[i+1]);
    }

  } else if (indices.length === 2) {
    compareExchange(a, indices[0], indices[1]);
  }
}


function oddEvenSort(a, lo, hi) {
  if ((hi - lo) >= 1) {
    var mid = Math.floor(lo + ((hi - lo) / 2));
    // console.log(lo, mid, hi)
    oddEvenSort(a, lo, mid);
    oddEvenSort(a, mid+1, hi);
    var indices = initialIndices(lo,hi);
    // console.log(lo, hi)
    console.log(lo, hi,indices)
    oddEvenMerge(a, indices);
  } 
}

function initialIndices(start,end) {
  var indices = [];

  for (var i = start; i <= end; i++) {
    indices.push(i);
  }

  return indices;

}

var a = [1,0,1,0,1,0,1,0];
// console.log(a.length)

oddEvenSort(a, 0, a.length-1)
console.log('sorted',a)