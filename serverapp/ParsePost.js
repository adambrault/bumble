var EventEmitter = require('events').EventEmitter;
var path    = require('path');
var env  = require('getconfig');
var logger  = require('bucker').createLogger(env.bucker, module);
var walk    = require('walk');
var sugar   = require('sugar');
var jf      = require('jsonfile');
var util    = require('util');
var fs      = require('fs');
var config  = require('../serverapp/useconfig').file('blogConfig.json');
var wtchr   = require('wtchr');
var marked  = require('marked');
var _       = require('underscore');

var dir = config.postDir;
var home = config.blogHome;
var walker = walk.walk(dir);
var endsWith = sugar.endsWith;
var startsWith = sugar.startsWith;
var dateFormat = /(\d{4})\-((0|1)\d)\-((0|1|2|3)\d)-/;
var posts = new Array();
var postDate, postSlug, postDateText;

function ParsePosts() {
    EventEmitter.call(this);
}

ParsePosts.prototype = new EventEmitter();

ParsePosts.prototype.parseFile = function (file, callback) {
    // set the slug to the filename
    postSlug = file.name.remove(dateFormat).remove('.md');
    // var postSlug = 'readme';
    logger.debug('02 postSlug: ' + postSlug);

    // does it start with the proper date format? (YYYY-MM-DD)
    if (file.name.startsWith(dateFormat)) {
        postDateText = file.name.first(10);
        postDate = Date.create(postDateText);
        logger.debug('03 postDate: ' + postDate + ' (from filename)');
        buildData(postDateText, postSlug);
    }

    else {
        // get the date from the file created timestamp
        postDate = Date.create(fs.statSync(config.postDir + '/' + file.name).ctime);
        logger.debug('03 postDate: ' + postDate + ' (from timestamp)');
    }

    // helper function to check for and load metadata
    // if the first line of the file does not start with # we return an
    // empty hash, otherwise we parse until we find a line that does not start with #
    // metadata should be saved in the form
    // # key: value
    function loadMetadata(file, filename) {
        var lines = file.split('\n');
        var metadata = {};
        var post = [];
        var count = 0;
        var key, val;
        var postImage;
        var postImageURL;

        if (lines[0].startsWith('#')) {
            lines.some(function (line) {
                if (line.startsWith('#')) {
                    count++;
                    var parsed = /(\w+)\:(.*)$/.exec(line);
                    if (parsed) {
                        metadata[parsed[1].trim()] = parsed[2].trim();
                    }
                } else {
                    return true;
                }
            });
            post = lines.slice(count).join('\n');
        } else {
            post = lines.join('\n');
        }

        return {
            postBody: marked(post),
            title: metadata.title || lines[count - 1].slice(1).trim(),
            date: metadata.date ? Date.create(metadata.date) : postDate,
            slug: metadata.slug || postSlug,
            tags: metadata.tags,
            blogTitle: config.blogTitle,
            blogSubTitle: config.blogSubTitle,
            author: metadata.author || config.blogAuthor,
            author_slug: metadata.author_slug,
            siteUrl: config.siteUrl,
            rssUrl: config.rssUrl
        };
    }

    // read the metadata and markdown associated with each post
    function buildData(postDateText, postSlug, postMarkdown) {
        fs.readFile(config.postDir + '/' + file.name, 'utf8', function (err, data) {
            logger.debug('reading file: blog/' + postDateText + '-' + postSlug + '.md');

            var postData = loadMetadata(data, file.name);
            postData.formattedDate = Date.create(postData.date).format('{Mon} {dd}, {yyyy}');
            postData.fullSlug = Date.create(postData.date).format('{yyyy}-{MM}-{dd}') + '-' + postSlug;
            postData.url = home + Date.create(postData.date).format('{yyyy}/{MM}/{dd}/') + postSlug;
            postData.permalink = config.siteUrl + postData.url;

            // add the metadata to the post array
            logger.debug(require('util').inspect(postData, false, null, true));
            posts.push(postData);

            // go to the next file
            callback();
        });
    }

    //logger.info(util.inspect(posts));
};

ParsePosts.prototype.setup = function () {
    var self = this;

    walker.on("file", function (root, file, next) {
        // does the file have a .md extension?
        if (file.name.endsWith('.md')) {
            self.parseFile(file, next);
        }
        else {
            next();
        }
    });

    walker.on("end", function () {
        // logger.info(util.inspect(posts));
        self.emit('ready', posts);
        var watcher = wtchr(config.postDir);
        watcher.on('create', function (filename) {
            if (!filename.match(/\.md$/)) return;
            var file = filename.replace(config.postDir + '/', '');
            logger.debug('adding new file:', file);
            self.parseFile({ name: file }, function () {
                self.emit('update', posts);
            });
        });
        watcher.on('change', function (filename) {
            if (!filename.match(/\.md$/)) return;
            var file = filename.replace(config.postDir + '/', '');
            logger.debug('changing file:', file);
            var postIndex = posts.indexOf(_.findWhere(posts, { fullSlug: file.replace(/\.md$/, '') }));
            posts.splice(postIndex, 1);
            self.parseFile({ name: file }, function () {
                self.emit('update', posts);
            });
        });
        watcher.on('delete', function (filename) {
            if (!filename.match(/\.md$/)) return;
            var file = filename.replace(config.postDir + '/', '');
            logger.debug('deleting file: %s', file);
            var postIndex = posts.indexOf(_.findWhere(posts, { fullSlug: file.replace(/\.md$/, '') }));
            posts.splice(postIndex, 1);
            self.emit('update', posts);
        });
        // logger.info('<<EMIT!>> <<EMIT!>> Ohboy. I think I just emit.')
    });

};

module.exports = ParsePosts;
