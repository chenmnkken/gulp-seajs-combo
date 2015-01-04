/*
 * seajs(CMD) Module combo pulgin for gulp
 * Author : chenmnkken@gmail.com
 * Date : 2015-01-04
 */

var fs = require( 'fs' ),
    path = require( 'path' ),
    through = require( 'through2' ),
    gutil = require( 'gulp-util' ),
    PluginError = gutil.PluginError,

    rFirstStr = /[\s\r\n\=]/,
    rDefine = /define\(\s*(['"](.+?)['"],)?/,
    rDeps = /(['"])(.+?)\1/g,
    rAlias = /alias\s*\:([^\}]+)\}/,
    rPaths = /paths\s*\:([^\}]+)\}/,
    rVars = /vars\s*\:([^\}]+)\}/,
    rVar = /\{([^{]+)}/g,
    rSeajsConfig = /seajs\.config\([^\)]+\);?/g,
    rModId = /([^\\\/?]+?)(\.(?:js|css))?(\?.*)?$/,
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
     * 格式化模块后合并内容
     * param { Object } 数据存储对象
     * param { String } 文件内容
     * param { String } 模块的绝对路径
     * return { Array } 依赖模块的相对路径列表
     */
    comboContent = function( options, content, filePath ){
        var isSeajsUse = !!~content.indexOf( 'seajs.use(' ),
            modName = filePath.match( rModId )[1],
            depModNames = [],
            deps = [],
            defineStr, result, name;

        // 标准模块
        if( !isSeajsUse ){
            // require( '../js/a' ) => require( 'a' )
            content = content.replace( rRequire, function( $, _, $2 ){
                var result = $,
                    depModName, firstStr;

                if( $2 && $2.slice(0, 4) !== 'http' ){
                    firstStr = result.charAt( 0 );

                    deps.push( $2 );
                    depModName = $2.match( rModId )[1];
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
                            depModName;

                        if( $2 && $2.slice(0, 4) !== 'http' ){
                            deps.push( $2 );
                            depModName = $2.match( rModId )[1];
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
        
        // 合并
        options.contents = content + '\n' + options.contents;
        
        if( options.verbose ){
            gutil.log( 'gulp-seajs-combo:', '✔ Module [' + filePath + '] combo success.' );
        }

        return deps;
    },

    /*
     * 解析模块的依赖模块列表，如果有依赖模块则递归调用再次解析，直到所有的依赖模块都解析完
     * param { Object } 数据存储对象
     * param { String | Array } 文件内容 | 依赖模块列表
     * param { String } 模块的绝对路径
     * return { String } 合并和的文件内容
     */
    formatDeps = function( options, content, filePath ){
        var deps = [],
            i = 0,
            modName, basePath;

        if( Array.isArray(content) ){
            content.forEach(function( depPath ){
                var depContent, _deps;

                modName = depPath.match( rModId )[1];

                // 检测该模块是否在忽略列表中
                if( !options.ignore[modName] ){
                    if( !~depPath.indexOf('.js') ){
                        depPath += '.js'
                    }

                    try{
                        depContent = fs.readFileSync( depPath, options.encoding );
                    }
                    catch( _ ){
                        throw new PluginError( PLUGIN_NAME, gutil.colors.red("File [" + depPath + "] not found.") );
                    }

                    _deps = comboContent( options, depContent, depPath );

                    if( _deps.length ){
                        deps = deps.concat( _deps );
                        basePath = path.resolve( depPath, '..' );
                        deps = mergePath( options, deps, basePath );
                    }
                }
            });
        }
        else{
            modName = filePath.match( rModId )[1];

            // 检测该模块是否在忽略列表中
            if( !options.ignore[modName] ){
                deps = comboContent( options, content, filePath );
                basePath = path.resolve( filePath, '..' );
                deps = mergePath( options, deps, basePath );
            }
        }
        
        if( deps.length ){
            formatDeps( options, deps );
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
        }

        return through.obj(function( file, enc, callback ){
            var contents;

            if( file.isBuffer() ){
                contents = file.contents.toString();
                formatDeps( o, contents, file.path );
                file.contents = new Buffer( o.contents );
                if( o.verbose ){
                    gutil.log( 'gulp-seajs-combo:', gutil.colors.green('✔ Module [' + file.path + '] completed the combo of all dependencies.') );
                }
            }

            callback( null, file );
        });
    };

module.exports = function( options ){
    var stream = createStream( options );
    return stream;
};