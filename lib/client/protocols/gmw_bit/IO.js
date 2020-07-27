/*
 *  the IO object to be used for OT
 *  to pass as the IO parameter for 1-out-of-N.
 *
 */
// IO send
const give = function (op_id,session_id,extras,tag,msg) {

  /* give a message */
  var jiff=extras[extras.length-1];
  const createMSGObj=function (msg,op_id,tag,jiff) {
    var four_opts={};
    four_opts['opts']=msg;
    four_opts['sender_id']=jiff.id;
    four_opts['op_id']=op_id;
    four_opts['tag']=tag;
    return four_opts;
  };

  var ids=parse__OT_id(op_id);
  var four_opts=createMSGObj(msg,op_id,tag,jiff) ;
  four_opts = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'open', four_opts], 2);
  msg=JSON.stringify(four_opts);// jason object
  var to_party=ids[1];
  if (jiff.id===ids[1]) {
    to_party=ids[0];
  }
  var recls=[];
  recls.push(to_party);
  jiff.emit('OT',recls,msg,true);
  return ;
};


// IO receive
const get = function (op_id,session_id, extras,tag) {
  /* get a message */
  var jiff=extras[extras.length-1];
  var ids=parse__OT_id(op_id);
  var shareid=op_id+'-'+tag;
  var from_party=ids[0];
  if (jiff.id===ids[0]) {
    from_party=ids[1];
  }

  if (jiff.deferreds[shareid] == null) {
    jiff.deferreds[shareid] = {};
  }
  if (jiff.deferreds[shareid][from_party] == null) { // not ready, setup a deferred
    jiff.deferreds[shareid][from_party] = new jiff.helpers.Deferred();
  }
  // resolving in customized listen
  return jiff.deferreds[shareid][from_party].promise;
};
// helper function to get from_id and to_id from op_id
function parse__OT_id(op_id) {

  var re=[];
  var temp=(op_id.split(':')[3]).split('-');
  var to=parseInt(temp[2]); // sending msg to partyid
  var from=parseInt(temp[1]);
  re.push(from);
  re.push(to);

  return re;

}

module.exports = {
  give: give,
  get: get
};
