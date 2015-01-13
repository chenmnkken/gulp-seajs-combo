var gulp = require( 'gulp' ),
    seajsCombo = require( '../index' ),
    handlebars = require( 'gulp-handlebars' ),
    wrap = require( 'gulp-wrap' );

gulp.task( 'a', function(){
    return gulp.src( './src/a.js' )
        .pipe( seajsCombo() )
        .pipe( gulp.dest('./build') );
});

gulp.task( 'c', function(){
    return gulp.src( './src/c.js' )
        .pipe( seajsCombo({
            ignore : [ 'e' ]
        }))
        .pipe( gulp.dest('./build') );
});

gulp.task( 'f', function(){
    return gulp.src( './src/f.js' )
        .pipe( seajsCombo() )
        .pipe( gulp.dest('./build') );
});

gulp.task( 'k', function(){
    return gulp.src( './src/k.js' )
        .pipe( seajsCombo({
            map : { 
                'test/src/l' : './l'
            }
        }))
        .pipe( gulp.dest('./build') );
});

gulp.task( 'm', function(){
    return gulp.src( './src/m.js' )
        .pipe( seajsCombo() )
        .pipe( gulp.dest('./build') );
});

gulp.task( 'q', function(){
    return gulp.src( './src/q.js' )
        .pipe( seajsCombo({
            plugins : [{
                ext : [ '.tpl' ],
                use : [
                    handlebars(),
                    wrap('define(function(){return Handlebars.template(<%= contents %>)});')
                ]
            }]
        }))
        .pipe( gulp.dest('./build') );
});

gulp.task( 'default', ['a', 'c', 'f', 'k', 'm', 'q'] );