# gulp-seajs-combo

***
> 一个用于 seajs(CMD) 模块合并工具的 gulp 插件。

## 安装

```
$ npm install --save-dev gulp-seajs-combo
```

## 使用

```
var gulp = require( 'gulp' ),
    seajsCombo = require( 'gulp-seajs-combo' );
    
gulp.task( 'seajscombo', function(){
    return gulp.src( 'src/js/main.js' )
        .pipe( seajsCombo() )
        .pipe( gulp.task('build/js') );
}); 
```

## API

### seajsCombo( options )

对于不支持的文件类型会直接忽略。

### options

#### encoding 

Type : `String`

Default : `utf-8`

#### ignore

Type : `Array`

忽略模块列表。合并模块 `main` 时想忽略其以来模块 `global` 和 `common`，那么其配置规则如下：

```
ignore : [ 'global', 'common' ]
```

忽略配置有两种规则，如果需要忽略 `src/a` 和 `src/test/a` 2 个模块，直接配置不带路径的模块标识：

```
ignore : [ 'a' ]
```

如果上面两个模块中只想忽略其中一个，那么配置具体的路径：

```
ignore : [ 'src/test/a' ]
```

#### map

使用 seajs.use 时，模块标识为 `foo/bar/biz`，但是模块的文件路径基于 `gulp.src` 解析出来的路径是 `./biz.js`，那么使用 `map` 配置来映射这种关系。

```
map : {
    'foo/bar/biz' : './biz'
}
```

#### plugins

`plugins` 用于为特殊模块的合并提供插件接口。比如在合并一个 Handlebar 的 tpl 模块时，想在合并前对其进行编译，那么可以借助插件配置和其他 gulp 插件进行配合。

```
var handlebars = require( 'gulp-handlebars' ),
      wrap = require( 'gulp-wrap' );
      
...
plugins : [{
    ext : [ '.tpl' ],
    use : [{
            plugin : handlebars, 
        },{
            plugin : wrap,
            param : ['define(function(){return Handlebars.template(<%= contents %>)});']
    }]
}]
```

## 合并规则

模块 `a.js` :

```
define(function(){
    var b = require( 'deps/b' );
    return 'a' + ' ' + b;
});
```

模块 `b.js` :

```
define(function(){
    return 'b';
});
```

gulp 代码 :

```
gulp.src( 'src/a.js' )
    .pipe( seajsCombo() )
    ...
```

合并好的 `a.js` :

```
define('b',function(){
    return 'b';
});
define('a',['b'],function(){
    var b = require( 'b' );
    return 'a' + ' ' + b;
});
```

文件 `main.js` :

```
seajs.use( 'a' );
```

gulp 代码 : 

```
gulp.src( 'src/main.js' )
    .pipe( seajsCombo() )
    ...
```

合并后的 `main.js` :

```
define('b',function(){
    return 'b';
});
define('a',['b'],function(){
    var b = require( 'b' );
    return 'a' + ' ' + b;
});
seajs.use( 'a' );
```

合并后的模块标识不会保留其路径，`src/a` 的模块标识在合并后就变成了 `a`，`foo/bar/p` 在合并后变成了 `p`。

如果合并的模块中模块标识有重复，gulp-seajs-combo 会修改原来的模块标识。`src/a` 和 `src/test/a` 在合并后由于去掉了路径都会变成 `a`，gulp-seajs-combo 会将后一个依赖 `src/test/a` 改成 `s_gulp_seajs_combo_xx`。

## 解析 `seajs.config`

`gulp-seajs-combo` 会解析 `seajs.config` 中的 `alias` `vars` `paths` 这 3 个配置，其他的配置会忽略，并且配置的值必须为 `String` 类型，会忽略其中的变量，查看更多的 [seajs.config](https://github.com/seajs/seajs/issues/262)。[test/src/m.js](https://github.com/chenmnkken/gulp-seajs-combo/blob/master/test/src/m.js) 和 [test/build/m.js](https://github.com/chenmnkken/gulp-seajs-combo/blob/master/test/build/m.js) 是合并时解析规则的例子。

想深入了解 gulp-seajs-combo 可以查看[使用gulp-seajs-combo合并seajs模块](http://stylechen.com/gulp-seajs-combo.html)

## License

MIT @ [Yiguo Chan](https://github.com/chenmnkken)