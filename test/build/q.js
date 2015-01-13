define('u',function(){return Handlebars.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
  return "<div>This is test Handlebars tpl.</div>";
  },"useData":true})});
define('q',['u'],function( require ){
    var tpl = require('u');
    console.log( tpl );
});
