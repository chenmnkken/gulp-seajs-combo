seajs.config({

  // 别名配置
  alias: {
    'i' : 'alias/i',
    'jquery': foo + 'jquery/jquery/1.10.1/jquery'
  },

  // 路径配置
  paths: {
    'foo': 'foo/bar/biz',
    'hello' : hello + '/foo/bar/biz'
  },

  // 变量配置
  vars: {
    'locale': 'zh-cn'
  },

  // 映射配置
  map: [
    ['http://example.com/js/app/', 'http://localhost/js/app/']
  ],

  // 预加载项
  preload: [
    Function.prototype.bind ? '' : 'es5-safe',
    this.JSON ? '' : 'json'
  ],

  // 调试模式
  debug: true,

  // Sea.js 的基础路径
  base: 'http://example.com/path/to/base/',

  // 文件编码
  charset: 'utf-8'
});

var hello = 'hello';

seajs.use( ['{locale}/n', 'i', 'o'] );