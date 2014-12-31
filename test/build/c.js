define('d',function(){
    return 'd';
});
define('c',['d','e'],function( require, exports, module ){
    var d = require('d'),
        e = require('e');

    module.exports = d + ' ' + e; 
});
