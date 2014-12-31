define('p',function(){
    return 'p'; 
});
define('o',['p'],function(){
    var p=require('p')
    return 'o' + ' ' + p  
} )
define('i',function(){
    return 'i'; 
});
define('n', function( require ){
    return 'n';
});


var hello = 'hello';

seajs.use( ['n', 'i', 'o'] );
