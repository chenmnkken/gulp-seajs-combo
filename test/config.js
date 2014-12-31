var fs = require( 'fs' ),
    rBase = /base\s*\:\s*[^,]+[,\r\n]/,
    rAlias = /alias\s*\:([^\}]+)\}/,
    rPaths = /paths\s*\:([^\}]+)\}/,
    rVars = /vars\s*\:([^\}]+)\}/,
    rSeajsConfig = /seajs\.config\([^\)]+\);?/g;

var evalConfig = function( configStr ){
    var configArr = configStr,
        config = {};

    configStr = configStr.replace( /\{/, '' );
    configArr = configStr.split( ',' );

    configArr.forEach(function( item ){
        var index, arr, key, value;
        
        item = item.trim();
        index = item.indexOf( ':' );
        key = item.slice( 0, index ).replace( /['"]/g, '' );
        value = item.slice( index + 1 );

        try{
            value = eval( '(function(){return ' + value +'})()' );
            config[ key ] = value;
        }
        catch( _ ){}
    });

    return config;
};

var evalConfig = function( configStr ){
    var configArr = configStr,
        config = {};

    configStr = configStr.replace( /\{/, '' );
    configArr = configStr.split( ',' );

    configArr.forEach(function( item ){
        var index, arr, key, value;
        
        item = item.trim();
        index = item.indexOf( ':' );
        key = item.slice( 0, index ).replace( /['"]/g, '' );
        value = item.slice( index + 1 );

        try{
            value = eval( '(function(){return ' + value +'})()' );
            config[ key ] = value;
        }
        catch( _ ){}
    });

    return config;
};

var parseConfig = function( content ){
    var config = {};

    content = content.replace( rSeajsConfig, function( $ ){
        $.replace( rAlias, function( _, $1 ){
            config.alias = evalConfig( $1 );
        });

        $.replace( rPaths, function( _, $1 ){
            config.paths = evalConfig( $1 );
        });

        $.replace( rVars, function( _, $1 ){
            config.vars = evalConfig( $1 );
        });

        return '';
    });

    return {
        content : content,
        config : config
    }
};

fs.readFile( 'src/m.js', 'utf-8', function( err, data ){
    var result = parseConfig( data );

    console.log( 'content>>>>>>>>>>>>>>>>>>>>>>' );
    console.log( result.content );
    console.log( 'content>>>>>>>>>>>>>>>>>>>>>>' );
    console.log( result.config );
});