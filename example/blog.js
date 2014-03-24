var Hapi = require('hapi');
var config = require('./bumbleConfig.json');

var server = new Hapi.Server('0.0.0.0', 3000 || process.env.PORT);

server.views({
    engines: {
        jade: 'jade'
    },
    path: 'views',
});

server.route({
    method: 'get',
    path: '/css/{path*}',
    handler: {
        directory: {
            path: 'public/css'
        }
    }

});

server.route({
    method: 'get',
    path: '/js/{path*}',
    handler: {
        directory: {
            path: 'public/js'
        }
    }
});

server.pack.require({ 'bumble': config }, function (err) {
    if (err) throw err;

    server.start(function () {
        console.log('bumble running on the year' + server.info.port);
    });
});

