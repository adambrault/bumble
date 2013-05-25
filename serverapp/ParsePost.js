var EventEmitter = require('events').EventEmitter,
    path    = require('path'),
    logger  = require('winston'),
    walk    = require('walk'),
    sugar   = require('sugar'),
    jf      = require('jsonfile'),
    util    = require('util'),
    fs      = require('fs'),
    config  = require('getconfig');

var dir = config.postDir,
    home = config.blogHome,
    walker = walk.walk(dir),
    endsWith = sugar.endsWith,
    dateFormat = /(\d{4})\-((0|1)\d)\-((0|1|2|3)\d)-/,
    posts = new Array(), postDate, postSlug, postDateText;

function ParsePosts() {
  EventEmitter.call(this);
}

ParsePosts.prototype = new EventEmitter();

ParsePosts.prototype.setup = function () {
  var self = this;
  if (home == '/') { home == '' };

  walker.on("file", function(root,file,next){

    // does the file have a .md extension?
    if (file['name'].endsWith('.md')) {

      logger.info('01 matches .md');

      // set the slug to the filename
      postSlug = file['name'].remove(dateFormat).remove('.md');
      // var postSlug = 'readme';
      logger.info('02 postSlug: ' + postSlug);      

      // does it start with the proper date format? (YYYY-MM-DD)
      if (file['name'].startsWith(dateFormat)) {
        postDateText = file['name'].first(10);
        postDate = Date.create(postDateText)
        logger.info('03 postDate: ' + postDate + ' (from filename)');
      }

      else {
        // get the date from the file created timestamp
        postDate = Date.create(fs.stat(dir + '/' + file['name']).ctime);
        logger.info('03 postDate: ' + postDate + ' (from timestamp)');

      };

      // read the JSON metadata associated with each post
      jf.readFile(__dirname + '/../' + dir + "/" + postDateText + '-' + postSlug + '.json', function (err, obj) {
        if (err) { logger.error("Bonk" + util.inspect(err)) };
        logger.info('04 reading file: ' + __dirname + '/../' + dir + '/' + postDateText + '-' + postSlug + '.json')

        logger.info('05 obj: ' + obj + ' | postDate: ' + postDate + ' | postSlug: ' + postSlug);

        var postData = obj;
        logger.info('06 postData: ' + postData + ' | postDate: ' + postDate + ' | postSlug: ' + postSlug);
        postData.date = postDate;
        postData.slug = postSlug;
        postData.blogTitle = config.blogTitle;
        postData.blogSubTitle = config.blogSubTitle;
        postData.siteUrl = config.siteUrl;
        postData.rssUrl = config.rssUrl;
        postData.url = home + Date.create(postDateText).format('{yyyy}/{MM}/{dd}/') + postSlug;
        postData.permalink = config.siteUrl + postData.url;

        // add the metadata to the post array
        posts.push(postData);

        // go to the next file
        next();
        logger.info('   - - - - - - - - - - - - - - - ')
      })      

      //logger.info(util.inspect(posts));

    }
    else {
      next();
    }
  });

  walker.on("end", function() {
    logger.info(util.inspect(posts));
    self.emit('ready', posts)
    logger.info('<<EMIT!>> <<EMIT!>> Ohboy. I think I just emit.')
  });

}

module.exports = ParsePosts;