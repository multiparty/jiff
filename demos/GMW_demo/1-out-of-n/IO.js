/*
 *  the IO object to be used for OT
 *  to pass as the IO parameter for 1-out-of-N.
 *
 */
// IO send
const give = function ( op_id, jiff,session_id, tag, msg) {
  /* give a message */
  const createMSGObj=function (msg,op_id,tag,jiff) {
    var four_opts={};
    four_opts['opts']=msg;
    four_opts['sender_id']=jiff.id;
    four_opts['op_id']=op_id;
    four_opts['tag']=tag;
    return four_opts;
  };
  var temp=(op_id.split('.')[0]).split('-');
  var to=parseInt(temp[2]); // sending msg to partyid
  var from=parseInt(temp[1]);
  var four_opts=createMSGObj(msg,op_id,tag,jiff) ;
  four_opts = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'open', four_opts], 2);
  msg=JSON.stringify(four_opts);// jason object[]
  var to_party=to;
  if (jiff.id===to) {
    to_party=from;
  }
  var recls=[];
  recls.push(to_party);
  jiff.emit('OT',recls,msg,true);//string
  return ;
};


// IO receive
const get = function (op_id,jiff,session_id, tag) {
  /* get a message */
  var temp=(op_id.split('.')[0]).split('-');
  var fromId=parseInt(temp[1]);
  var toId=parseInt(temp[2]);
  var shareid=op_id+'-'+tag;

  var from_party=fromId;
  if (jiff.id===fromId) {
    from_party=toId;
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

module.exports = {
  give: give,
  get: get
};
