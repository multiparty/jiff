/*
 *  the IO object to be used for OT
 *  to pass as the IO parameter for 1-out-of-N.
 *
 */
// IO send
const give = function (op_id,session_id,tag,msg,jiff) {
  /* give a message */
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
  var message_to_send = {tag: 'OT', party_id: to_party, message: msg, encrypted: true};
  message_to_send = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'custom', message_to_send], 2);

  if (message_to_send['encrypted'] !== false) {
    message_to_send['message'] = jiff.hooks.encryptSign(jiff, message_to_send['message'], jiff.keymap[message_to_send['party_id']], jiff.secret_key);
    message_to_send['encrypted'] = true;
  }

  jiff.socket.safe_emit('OT', JSON.stringify(message_to_send));
  return ;
};


// IO receive
const get = function (op_id,session_id,tag, jiff) {
  /* get a message */
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
