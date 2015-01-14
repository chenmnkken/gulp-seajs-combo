/*
 * seajs(CMD) Module combo pulgin for gulp
 * Author : chenmnkken@gmail.com
 * Date : 2015-01-14
 */

var Q = require( 'q' ),
    fs = require( 'fs' ),
    path = require( 'path' ),
    through = require( 'through2' ),
    gutil = require( 'gulp-util' ),
    execPlugins = require( './lib/execplugins' ),
    PluginError = gutil.PluginError,

    rFirstStr = /[\s\r\n\=]/,
    rDefine = /define\(\s*(['"](.+?)['"],)?/,
    rDeps = /(['"])(.+?)\1/g,
    rAlias = /alias\s*\:([^\}]+)\}/,
    rPaths = /paths\s*\:([^\}]+)\}/,
    rVars = /vars\s*\:([^\}]+)\}/,
    rVar = /\{([^{]+)}/g,
    rSeajsConfig = /seajs\.config\([^\)]+\);?/g,
    rModId = /([^\\\/?]+?)(\.(?:js))?([\?#].*)?$/,
    rQueryHash = /[\?#].*$/,
    rExistId = /define\(\s*['"][^\[\('"\{\r\n]+['"]\s*,?/,
    rSeajsUse = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*seajs\.use|(?:^|[^$])\bseajs\.use\s*\((.+)/g,

    rRequire = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g;

const PLUGIN_NAME = 'gulp-seajs-cmobo';

/*
 * 将配置对象中的忽略列表数组转化成忽略列表对象
 * param { Object } 配置对象
 * return { Object } 忽略列表
 */
var createIgnore = function( options ){
        var obj = {};

        if( options.ignore ){
            options.ignore.forEach(function( item ){
                obj[ item ] = true;
            });
        }

        return obj;
    },

    /*
     * 初始化插件
     * param { Object } 老配置对象
     * param { Object } 新忽略列表
     */
    initPlugins = function( options, o ){
        var name;

        o.plugins = {};

        options.plugins.forEach(function( item ){
            item.ext.forEach(function( name ){
                o.plugins[ name ] = item.use;
            });
        });
    },

    /*
     * 提取config中的配置，会忽略包含变量的配置，只提取纯字符串
     * param{ String } config字符串
     * return{ Object } 提取出来的配置
     */
    evalConfig = function( configStr ){
        var configArr = configStr,
            config = {};

        configStr = configStr.replace( /\{/, '' );
        configArr = configStr.split( ',' );

        configArr.forEach(function( item ){
            var index, arr, key, value;
            
            index = item.indexOf( ':' );
            key = item.slice( 0, index ).replace( /['"]/g, '' );
            value = item.slice( index + 1 );

            key = key.trim();
            value = value.trim();

            try{
                value = eval( '(function(){return ' + value +'})()' );
                config[ key ] = value;
            }
            catch( _ ){}
        });

        return config;
    },

    /*
     * 解析config字符串，尝试提取alias、paths、vars
     * param{ String } 文件内容
     * return{ Object } 提取出来的配置和提取后的文件内容
     */
    parseConfig = function( content ){
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
    },

    /*
     * 基于basePath将依赖模块的相对路径转化成绝对路径
     * 同时对seajs.config中的paths、alias、vars，还有options.map进行处理
     * param { Object } 数据存储对象
     * param { Array } 依赖模块的相对路径列表
     * param { String } 基础路径
     * return { Array } 依赖模块的绝对路径列表
     */
    mergePath = function( options, deps, basePath ){
        var config = options.config;

        deps.forEach(function( item, i ){
            var arr, modId;

            // 处理build.json => map
            if( options.map && options.map[item] ){
                item = options.map[ item ];
            }

            // 处理seajs.config => vars
            if( config.vars ){
                if( ~item.indexOf('{') ){
                    item = item.replace( rVar, function( $, $1 ){
                        if( config.vars[$1] ){
                            return config.vars[$1];
                        }

                        return $;
                    });
                }
            }

            // 处理seajs.config => alias
            if( config.alias && config.alias[item] ){
                item = config.alias[ item ];
            }

            // 处理seajs.config => paths
            if( config.paths ){
                arr = item.split( path.sep );
                modId = arr.splice( arr.length - 1, 1 );

                arr.forEach(function( _item, i ){
                    if( config.paths[_item] ){
                        arr[i] = config.paths[ _item ];
                    }
                });

                arr = arr.concat( modId );
                item = arr.join( path.sep );
            }

            deps[i] = path.resolve( basePath, item );
        });

        return deps;
    },

    /*
     * 解析模块标识
     * param { String } 模块标识
     * return { Object } filePath : 过滤query和hash后的模块标识, modName : 模块名, extName : 模块后缀
     */
    modResolve = function( filePath ){
        // 过滤query(?)和hash(#)
        filePath = filePath.replace( rQueryHash, '' );

        var modName = filePath.match( rModId )[1],    
            extName = path.extname( filePath );

        if( extName ){
            modName = modName.replace( extName, '' );
        }

        return {
            filePath : filePath,
            modName : modName,
            extName : extName
        };
    },

    /*
     * 格式化模块后合并内容
     * param { Object } 数据存储对象
     * param { String } 文件内容
     * param { String } 模块的绝对路径
     * param { Boolean } 是否为特殊模块
     * return { Array } 依赖模块的相对路径列表
     */
    comboContent = function( options, content, filePath, isSpecial ){
        var isSeajsUse = !!~content.indexOf( 'seajs.use(' ),
            modResult = modResolve( filePath ),
            modName = modResult.modName,
            depModNames = [],
            deps = [],
            defineStr, result, name;

        filePath = modResult.filePath;

        if( !isSpecial ){
            // 标准模块
            if( !isSeajsUse ){
                // require( '../js/a' ) => require( 'a' )
                content = content.replace( rRequire, function( $, _, $2 ){
                    var result = $,
                        depModResult, depModName, firstStr;

                    if( $2 && $2.slice(0, 4) !== 'http' ){
                        depModResult = modResolve( $2 );
                        depModName = depModResult.modName;
                        firstStr = result.charAt( 0 );

                        deps.push( depModResult.filePath );
                        depModNames.push( depModName );
                        result = "require('" + depModName + "')";

                        if( rFirstStr.test(firstStr) ){                        
                            result = firstStr + result;
                        }
                    }

                    return result;
                });

                // 为匿名模块添加模块名，同时将依赖列表添加到头部
                content = content.replace( rDefine, function( $, $1 ){
                    return deps.length ?
                        "define('" + modName + "',['" + depModNames.join("','") + "']," :
                        "define('" + modName + "',";
                });
            }
            // 解析seajs.use
            else{
                result = parseConfig( content );
                content = result.content;
                
                for( name in result.config ){
                    options.config[ name ] = result.config[ name ];
                }

                // seajs.use( '../js/b' ) => seajs.use( 'b' )
                content = content.replace( rSeajsUse, function( $ ){
                    var result = $;

                    if( ~$.indexOf('seajs.use(') ){
                        result = $.replace( rDeps, function( $, _, $2 ){
                            var _result = $,
                                depModResult, depModName;

                            if( $2 && $2.slice(0, 4) !== 'http' ){
                                depModResult = modResolve( $2 );
                                depModName = depModResult.modName;

                                deps.push( depModResult.filePath );
                                _result = "'" + depModName + "'";
                            }

                            return _result;
                        });
                    }

                    return result;
                });
            }

            // 防止标准模块的重复合并
            if( !isSeajsUse ){
                if( options.unique[filePath] ){
                    return deps;
                }

                options.unique[ filePath ] = true;
            }
        }
        
        // 合并
        options.contents = content + '\n' + options.contents;
        
        if( options.verbose ){
            gutil.log( 'gulp-seajs-combo:', '✔ Module [' + filePath + '] combo success.' );
        }

        return deps;
    },

    /*
     * 解析依赖模块列表，如果有依赖模块则开始解析依赖模块
     * param { Object } 数据存储对象
     * param { Array } 依赖模块 
     * param { Function } 回调函数
     */
    parseDeps = function( options, parentDeps, callback ){
        var childDeps = [];

        promiseArr = parentDeps.map(function( depPath ){
            var deferred = Q.defer(),
                result = modResolve( depPath ),
                modName = result.modName,
                extName = result.extName,
                depContent, _deps, stream;

            depPath = result.filePath;
            
            // 检测该模块是否在忽略列表中
            if( !options.ignore[modName] ){
                // 处理特殊的模块，如 tpl 模块（需额外的插件支持）
                // 根据模块后缀来匹配是否使用插件
                if( extName && !~extName.indexOf('.js') && options.plugins[extName] ){
                    // 有插件则执行插件
                    stream = execPlugins( depPath, options.plugins[extName] );
                    stream.pipe( through.obj(function( file, enc, _callback ){
                        comboContent( options, file.contents.toString(), depPath );
                        _callback( null, file );
                    }));

                    stream.on( 'end', function(){
                        deferred.resolve();
                    });
                }
                // 处理普通的js模块
                else{
                    depPath += '.js'

                    try{
                        depContent = fs.readFileSync( depPath, options.encoding );
                    }
                    catch( _ ){
                        throw new PluginError( PLUGIN_NAME, gutil.colors.red("File [" + depPath + "] not found.") );
                    }

                    _deps = comboContent( options, depContent, depPath );

                    if( _deps.length ){
                        childDeps = childDeps.concat( _deps );
                        basePath = path.resolve( depPath, '..' );
                        childDeps = mergePath( options, childDeps, basePath );
                    }

                    deferred.resolve();           
                }
            }
            else{
                deferred.resolve();
            }

            return deferred.promise;
        });

        Q.all( promiseArr ).then(function(){
            if( childDeps.length ){
                parseDeps( options, childDeps, callback );
            }
            else{
                callback();
            }
        });
    },

    /*
     * 解析模块的内容，如果有依赖模块则开始解析依赖模块
     * param { Object } 数据存储对象
     * param { String | Array } 文件内容 
     * param { String } 模块的绝对路径
     * param { Function } 回调函数
     */
    parseContent = function( options, content, filePath, callback ){
        var result = modResolve( filePath ),
            deps = [],
            basePath;

        // 检测该模块是否在忽略列表中
        if( !options.ignore[result.modName] ){
            deps = comboContent( options, content, result.filePath );
            basePath = path.resolve( result.filePath, '..' );
            deps = mergePath( options, deps, basePath );
        }

        if( deps.length ){
            parseDeps( options, deps, callback );
        }
        else{
            callback();
        }
    },

    // 插件入口函数
    createStream = function( options ){
        var ignore = createIgnore( options || {} ),
            o = {
                unique : {},
                config : {},
                contents : '',
                encoding : 'UTF-8',
                ignore : createIgnore( options || {} ),
                verbose : !!~process.argv.indexOf( '--verbose' )
            };

        if( options ){
            if( options.map ){
                o.map = options.map;
            }

            if( options.encoding ){
                o.encoding = options.encoding;
            }

            if( options.plugins ){
                initPlugins( options, o );
            }
        }

        return through.obj(function( file, enc, callback ){
            var contents;

            if( file.isBuffer() ){
                contents = file.contents.toString();

                parseContent( o, contents, file.path, function(){
                    file.contents = new Buffer( o.contents );

                    if( o.verbose ){
                        gutil.log( 'gulp-seajs-combo:', gutil.colors.green('✔ Module [' + file.path + '] completed the combo of all dependencies.') );
                    }

                    callback( null, file );
                });
            }
            else{
                callback( null, file );
            }
        });
    };

module.exports = function( options ){
    var stream = createStream( options );
    return stream;
};
