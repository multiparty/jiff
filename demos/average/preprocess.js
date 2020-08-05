var mongoose = require('mongoose'); 


var shareSchema = mongoose.Schema({
    op_id: String, 
    ready: Boolean, 
    value: Number, 
    holders: Array, 
    threshold: Number, 
    Zp: Number
})


module.exports = mongoose.model("Share", shareSchema); 