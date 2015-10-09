/**
 *
 * @return {{}}
 * @type function
 * @constructor
 */
module.exports = (function StickyLoadBalancer() {
    var self = this;

    var doLog = false;
    var log = function (w) {
        if (doLog) {
            console.dir(w);
        }
    };

    //dependencies
    var farmhash = require('farmhash');
    var http = require('http');
    var request = require('request');
    var querystring=require('querystring');


    /**
     * constructor
     * @param {string} ip
     * @param {number} port
     * @constructor
     */
    var ret = function (ip, port) {

        this.getIp = function () {
            return ip
        };
        this.getPort = function () {
            return port
        };

        this.identifier = '-' + Math.random() + Math.random() + Math.random() + Math.random() + Math.random() + Math.random();

        /**
         * array which contains the current strategie
         * @type {String[]}
         * @private
         */
        var _stickyStrategy = [];
        var _renderState = {
            cookie: false,
            body: false
        };
        this.getRenderState = function () {
            return _renderState;
        };
        /**
         * get the current sticky strategy
         * @return {String[]}
         */
        this.getStickyStrategy = function () {
            return _stickyStrategy;
        };
        /**
         * set a custom sticky-strategie
         * @param {string[]} stringArray everything to use to define the sticky-parameter
         */
        this.setStickyStrategy = function (stringArray) {

            //1. check if strategie is ok
            if (stringArray.length <= 0) {
                log('sticky-load-balancer(): couldnt set sticky strategy (no or empty array given)');
                return false;
            }
            var failed = false;
            stringArray.forEach(function (v) {
                if (typeof v !== "string") {
                    log('sticky-load-balancer(): couldnt set sticky strategy (one array-el is not a string)');
                    failed = true;
                    return false;
                }
            });
            if (failed) {
                return false;
            }

            //2. reset performance-hints
            _renderState.body = false;
            _renderState.cookie = false;

            //3. check performance-hints
            stringArray.forEach(function (v) {
                var split = v.split('.');
                if (split[0] == 'body') {
                    _renderState.body = true;
                }
                if (split[0] == 'cookie') {
                    _renderState.cookie = true;
                }
            });
            _stickyStrategy = stringArray;
        };


        /**
         * represent the running server
         * @type {null}
         * @private
         */
        var _server = null;
        this.setServer = function (newServer) {
            _server = newServer;
        };


        /**
         * @type {boolean}
         */
        this.running = false;


        var nodes = [
            /*{ //sample-node
             ip: '127.0.0.1',
             port: 3456,
             balance: 2,
             range: {
             from: 1234,
             to: 23542345
             },
             roundRobin: null
             }*/
        ];
        this.addOneNode = function (node) {
            nodes.push(node);
        };
        this.getNodes = function () {
            return nodes;
        };


    };

    ret.prototype = (function () {

        /**
         * take all nodes and split the 32bit-range between them
         * @private
         */
        var _reDistributeNodes = function (self) {
            //1. calculate balance.sum()
            var balanceSum = 0;
            self.getNodes().forEach(function (node) {
                balanceSum = balanceSum + node.balance;
            });

            var rangePerBalance = Math.ceil(4294967296 / balanceSum);

            //2. spread to the nodes
            var startRange = 0;
            self.getNodes().forEach(function (node) {
                node.range.from = startRange;
                var addRange = node.balance * rangePerBalance;
                var endRange = startRange + addRange;
                node.range.to = endRange;
                startRange = endRange;
            });

            //3. set round-robin-flag to the first node
            self.getNodes()[0].roundRobin = 0;
        };

        /**
         * set the identifier
         * @param {string} ident
         */
        var setIdentifier = function (ident) {
            this.identifier = ident;
        };

        /**
         * add a node to the balancer
         * @param {string} ip
         * @param {number} port
         * @param {number} balance 1-10 only, if node X has balance=2 and node Y has balance=4, node Y would get double the load than node X
         */
        var addNode = function (ip, port, balance) {
            var self = this;

            //1. check if balance ok
            if (balance < 1 || balance > 10) {
                log('sticky-load-balancer.addNode(' + ip + ':' + port + ',' + balance + '): balance must be between 1 and 10');
                return false;
            }

            //2. check if node doesnt exist
            var exists = false;
            self.getNodes().forEach(function (node) {
                if (node.ip == ip && node.port == port) {
                    exists = true;
                    return false;
                }
            });
            if (exists == true) {
                log('sticky-load-balancer.addNode(' + ip + ':' + port + ',' + balance + '): node already exists');
                return false;
            }


            self.addOneNode({
                ip: ip,
                port: port,
                balance: balance,
                range: {
                    from: 0,
                    to: 0
                },
                roundRobin: null
            });
            _reDistributeNodes(self);
        };

        /**
         * get the right node for a given hashObj from the StickyStrategy
         * @param self
         * @param {{}|String} hashObj
         * @return {*} the node
         * @private
         */
        var _findDistributionNode = function (self, hashObj) {
            if (Object.keys(hashObj).length === 0 || hashObj === '') {
                //use round robin because hashObj is empty
                var robinNode = null;
                self.getNodes().forEach(function (node, i) {
                    if (node.roundRobin != null) {
                        robinNode = node;
                        //set the round-robin-flag to next
                        node.roundRobin++;
                        if (node.roundRobin > node.balance) {
                            node.roundRobin = null;

                            var nextIndex = i + 1;
                            if (nextIndex > self.getNodes().length - 1) {
                                nextIndex = 0;
                            }

                            self.getNodes()[nextIndex].roundRobin = 0;
                        }
                        return false;
                    }
                });
                return robinNode;
            } else {
                //use sticky-mode
                var hashNr = _hash(hashObj);
                //find node with this range
                var returnNode = null;
                self.getNodes().forEach(function (node) {
                    if (node.range.to >= hashNr && node.range.from <= hashNr) {
                        returnNode = node;
                        return false;
                    }
                });
                return returnNode;
            }
        };

        /**
         * returns true if the given request can be piped
         * @param self
         * @param req
         * @return {boolean}
         * @private
         */
        var _canPipe = function (self, req) {
            return !(req.method == "POST" && self.getRenderState().body == true);
        };

        /**
         * get a hashObject from a non-piped request
         * @param self
         * @param req
         * @return {{}}
         * @private
         */
        var _getHashObject = function (self, req) {
            var ret = {};
            //parse cookies if needed
            if(self.getRenderState().cookie){
                req.cookie=_parseCookies(req);
            }

            //parse body if needed
            if(self.getRenderState().body && req.bodyData){
                req.body=_parseBody(req.bodyData);
            }

            self.getStickyStrategy().forEach(function (v) {
                var val = _objectAttributeByString(req, v);
                if (typeof val !== "undefined") {
                    ret[v] = val;
                }
            });
            //add unique identifier
            if(Object.keys(ret).length!=0){
                ret[self.identifier + '______'] = '1';
            }
            return ret;
        };

        /**
         * start the shit!
         */
        var start = function () {
            var self = this;

            if (self.getNodes().length === 0) {
                log('sticky-load-balancer.start(): called but no nodes are added at the moment');
            }

            if (self.running == true) {
                log('sticky-load-balancer.start(): cannot start because already started');
                return false;
            }

            log('load balancer started at http://' + self.getIp() + ':' + self.getPort() + '/');
            var server = http.createServer(function (req, res) {


                /**
                 * secret identifier called. add node
                 */
                if (req.method == "POST" && req.url == '/' + self.identifier) {
                    var data = '';
                    req.on('data', function (chunk) {
                        data += chunk;
                    });
                    log('sticky-load-balancer(' + self.getIp() + ':' + self.getPort() + '): secret identifier called. Add node:');
                    req.on('end', function () {
                        try {
                            var nodeData = JSON.parse(data);
                            log(nodeData);
                            self.addNode(nodeData.ip, nodeData.port, nodeData.balance);
                        } catch (e) {
                            res.end('failed to parse body');
                        }
                    });
                } else {

                    //0. exit if no node exists
                    if (self.getNodes().length == 0) {
                        log('sticky-load-balancer(' + self.getIp() + ':' + self.getPort() + ') incoming request but couldnt find node');
                        return false;
                    }

                    //1. check if request can be piped
                    var hashObj = {};
                    var useNode=null;
                    if (_canPipe(self, req)) {
                        hashObj = _getHashObject(self, req);
                        useNode = _findDistributionNode(self, hashObj);
                        console.dir(hashObj);

                        //2. redirect the request
                        var options = {
                            host: useNode.ip,
                            port: useNode.port,

                            path: req.url,
                            //This is what changes the request to a POST request
                            method: req.method,
                            headers: req.headers
                        };
                        options.headers.originalHostname=req.headers.host;

                        delete options.headers.host;

                        /**
                         * @link http://stackoverflow.com/questions/13472024/simple-node-js-proxy-by-piping-http-server-to-http-request
                         */
                        var connection = http.request(options, function (serverResponse) {

                            serverResponse.pause();
                            res.writeHeader(serverResponse.statusCode, serverResponse.headers);
                            serverResponse.pipe(res);
                            serverResponse.resume();
                        });

                        connection.on('error', function(e){
                            log('req error: ');
                            log(e);
                            _handleError(res);
                        });

                        req.pipe(connection);
                        req.resume();

                    } else {
                        //1.2 w8 for all data
                        var body='';
                        req.on('data', function(chunk){
                            body+=chunk;
                        });
                        req.on('end', function(){
                           req.bodyData=body;

                            hashObj = _getHashObject(self, req);
                            useNode = _findDistributionNode(self, hashObj);

                            //2. redirect the request
                            var options = {
                                host: useNode.ip,
                                port: useNode.port,

                                path: req.url,
                                //This is what changes the request to a POST request
                                method: req.method,
                                headers: req.headers
                            };
                            options.headers.originalHostname=req.headers.host;
                            delete options.headers.host;

                            /**
                             * @link http://stackoverflow.com/questions/13472024/simple-node-js-proxy-by-piping-http-server-to-http-request
                             */
                            var connection = http.request(options, function (serverResponse) {

                                serverResponse.pause();
                                res.writeHeader(serverResponse.statusCode, serverResponse.headers);
                                serverResponse.pipe(res);
                                serverResponse.resume();
                            });

                            connection.on('error', function(e){
                                log('req error: ');
                                log(e);
                                _handleError(res);
                            });

                            connection.end(body);

                        });


                        req.on('error', function(e){
                            console.log('req error: ');
                            console.dir(e);
                        });
                    }
                }

            }).listen(self.getPort(), self.getIp());
            self.setServer(server);
            self.running = true;
        };

        return {
            setIdentifier: setIdentifier,
            addNode: addNode,
            start: start
        }


    })();


    /**
     * get attribute of object by string
     * @param {{}} o
     * @param {string} s
     * @return {*}
     * @private
     */
    var _objectAttributeByString = function (o, s) {
        s = s.replace(/^\./, '');           // strip a leading dot
        var a = s.split('.');
        for (var i = 0, n = a.length; i < n; ++i) {
            var k = a[i];
            if (k in o) {
                o = o[k];
            } else {
                return;
            }
        }
        return o;
    };

    /**
     * create an hash-number from given object
     * @param {*} stringORObject
     * @private
     * @returns {number} the hash as 32-bit-number ( 0 to 4,294,967,296 )
     */
    var _hash = function (stringORObject) {
        if (typeof stringORObject !== "string") {
            stringORObject = JSON.stringify(stringORObject);
        }
        return farmhash.hash32(stringORObject);
    };

    var _parseCookies = function (req) {
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
    var _parseBody = function (bodyData) {
        var ret = {};
        var done = false;
        try {
            ret = JSON.parse(bodyData);
            done = true;
        } catch (e) {
        }

        try {
            if (done == false) {
                ret = querystring.parse(bodyData);
            }
        } catch (e) {
        }

        if (Object.keys(ret).length == 0) {
            ret = {};
        }

        return ret;
    };


    /**
     * handle requests from broken nodes
     * @param res
     * @private
     */
    var _handleError=function(res){
        res.end('StickyLoadBalancer: Error with node');
    };

    /**
     * tell another balancer that I want to be node of it
     * @param {{ip: string, port: number, identifier: string}} balancer
     * @param {{ip: string, port: number, balance: number}} node
     */
    ret.tellBalancer = function (balancer, node) {

        var options = {
            method: 'post',
            body: node,
            json: true,
            url: 'http://' + balancer.ip + ':' + balancer.port + '/' + balancer.identifier
        };
        request(options, function (err, res, body) {
            if (err) {
                log('sticky-load-balancer.tellBalancer(): cant add node, connection error: ');
                log(err);
                return false;
            }
        })
    };


    ret.setLogging = function (onOff) {
        doLog = onOff;
    };

    return ret;
})();