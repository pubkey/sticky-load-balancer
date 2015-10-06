/**
 * this mirror returns a json-representation of the ingoing requests
 * @return {{}}
 * @type function
 * @constructor
 */
module.exports = (function RequestMirror() {
    var self = this;
    var http = require('http');
    var querystring = require('querystring');

    self._parseCookies = function (req) {
        try {

            var list = {},
                rc = req.headers.cookie;

            rc && rc.split(';').forEach(function (cookie) {
                var parts = cookie.split('=');
                list[parts.shift().trim()] = decodeURI(parts.join('='));
            });

            return list;

        } catch (e) {
            return {};
        }
    };

    self._parseBody=function(bodyData){
        var ret={};
        var done=false;
        try{
            ret=JSON.parse(bodyData);
            done=true;
        }catch(e){}

        try{
            if(done==false){
                ret=querystring.parse(bodyData);
            }
        }catch(e){}

        if(Object.keys(ret).length==0){
            ret='';
        }

        return ret;
    };

    self.start = function (ip, port) {
        console.log('RequestMirror.start( http://' + ip + ':' + port + '/ )');
        http.createServer(function (req, res) {

            console.log('RequestMirror: incomming request');

            var body = '';
            req.on('data', function (data) {
                body += data;
            });
            req.on('end', function () {
                var ret = {
                    method: req.method,
                    url: req.url,
                    headers: req.headers,
                    cookies: self._parseCookies(req),
                    body: self._parseBody(body)
                };


                setTimeout(function () {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(ret));
                }, 1000);
            });
            req.on('error', function (err) {
                res.end('Error');
            });
        }).listen(port,ip);
    };

    return self.start;


})();