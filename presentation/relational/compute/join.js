var binary_search = function (jiff_instance, id, table, schema) {
  var idCol = schema[0];
  var valCol = schema[1];

  while (table.length > 1) {
    // comparison
    var mid = Math.floor(table.length / 2);
    var cmp = id.slt(table[mid][idCol]);

    // Slice array in half, choose slice depending on cmp
    var nTable = [];
    for (var i = 0; i < mid; i++) {
      var obj = {};
      obj[idCol] = cmp.if_else(table[i][idCol], table[mid + i][idCol]);
      obj[valCol] = cmp.if_else(table[i][valCol], table[mid + i][valCol]);
      nTable.push(obj);
    }

    // watch out for off by 1 errors if length is odd.
    if (2 * mid < table.length) {
      var obj2 = {};
      obj2[idCol] = table[2 * mid][idCol];
      obj2[valCol] = table[2 * mid][valCol];
      nTable.push(obj2);
    }

    table = nTable;
  }

  var row = table[0];
  var found = row[idCol].seq(id);
  var val = found.if_else(row[valCol], 0);
  return { found: found, val: val };
};

module.exports = function (jiff_instance, table1, table2, schema1, schema2) {
  for (var d = 0; d < table1.length; d++) {
    var row = table1[d];
    var id = row[schema1[0]];
    var res = binary_search(jiff_instance, id, table2, schema2);

    var found = res.found;
    for (var i = 2; i < schema1.length; i++) {
      var col = schema1[i];
      row[col] = found.if_else(row[col], 0);
    }
    row[schema2[1]] = res.val;
  }

  return table1;
};