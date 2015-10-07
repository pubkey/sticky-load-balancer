/**
 *
 * @return {{}}
 * @type function
 * @constructor
 */
module.exports = (function StickyLoadBalancer() {
    var self = this;

    //dependencies
    var farmhash = require('farmhash');
    var http = require('http');
    var request = require('request');


    /**
     * constructor
     * @param {string} ip
     * @param {number} port
     * @constructor
     */
    var ret = function (ip, port) {

        this.getIp = function(){return ip};
        this.getPort=function(){return port};

        this.identifier = '-' + Math.random() + Math.random() + Math.random() + Math.random() + Math.random() + Math.random();

        /**
         * @type {String[]}
         */
        this.stickyStrategie = [];

        var server=null;
        this.setServer=function(newServer){
          server=newServer;
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
        this.addOneNode=function(node){
            nodes.push(node);
        };
        this.getNodes=function(){
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
         * get the right node for a given hashObj from the StickyStrategy
         * @param {{}|String} hashObj
         * @return {*} the node
         * @private
         */
        var _findDistributionNode = function (self,hashObj) {
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
                var hashNr = self._hash(hashObj);
                //find node with this range
                var returnNode = null;
                self.getNodes().nodes.forEach(function (node) {
                    if (node.range.to >= hashNr && node.range.from <= hashNr) {
                        returnNode = node;
                        return false;
                    }
                });
                return returnNode;
            }
        };


        /**
         * set the identifier
         * @param {string} ident
         */
        var setIdentifier = function (ident) {
            this.identifier = ident;
        };

        /**
         * set a custom sticky-strategie
         * @param {string[]} stringArray everything to use to define the sticky-parameter
         */
        var setStickyStrategie = function (stringArray) {
            this.stickyStrategie = stringArray;
        };

        /**
         * add a node to the balancer
         * @param {string} ip
         * @param {number} port
         * @param {number} balance 1-10 only, if node X has balance=2 and node Y has balance=4, node Y would get double the load than node X
         */
        var addNode = function (ip, port, balance) {
            var self=this;

            //1. check if balance ok
            if (balance < 1 || balance > 10) {
                console.error('sticky-load-balancer.addNode(' + ip + ':' + port + ',' + balance + '): balance must be between 1 and 10');
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
                console.error('sticky-load-balancer.addNode(' + ip + ':' + port + ',' + balance + '): node already exists');
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
         * start the shit!
         */
        var start = function () {
            var self=this;

            if (self.getNodes().length === 0) {
                console.error('sticky-load-balancer.start(): called but no nodes are added at the moment');
            }

            if(self.running==true){
                console.error('sticky-load-balancer.start(): cannot start because already started');
                return false;
            }

            console.log('load balancer started at http://' + self.getIp() + ':' + self.getPort()+'/');
            var server = http.createServer(function (req, res) {


                /**
                 * secret identifier called. add node
                 */
                if (req.method == "POST" && req.url == '/' + self.identifier) {
                    var data = '';
                    req.on('data', function (chunk) {
                        data += chunk;
                    });
                    console.log('secret identifier called. Add node:');
                    req.on('end', function () {
                        try {
                            var nodeData = JSON.parse(data);
                            console.dir(nodeData);
                            self.addNode(nodeData.ip, nodeData.port, nodeData.balance);
                        } catch (e) {
                            res.end('failed to parse body');
                        }
                    });
                } else {
                    //1. get the right node

                    //TODO use sticky strategie
                    //var hashObj = self.stickyStrategie(req);
                    var hashObj={};

                    var useNode = _findDistributionNode(self,hashObj);

                    if(useNode==null){
                        console.error('sticky-load-balancer('+self.getIp()+':'+self.getPort()+') incoming request but couldnt find node');
                        return false;
                    }

                    //2. redirect the request
                    var options = {
                        host: useNode.ip,
                        port: useNode.port,

                        path: req.url,
                        //This is what changes the request to a POST request
                        method: req.method,
                        headers: req.headers
                    };
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
                    req.pipe(connection);
                    req.resume();
                }


            }).listen(self.getPort(), self.getIp());
            self.setServer(server);
            self.running=true;
        };

        return {
            setStickyStrategie:setStickyStrategie,
            setIdentifier: setIdentifier,
            addNode:addNode,
            start:start
        }


    })();


    /**
     * create an hash-number from given object
     * @param {*} stringORObject
     * @private
     * @returns {number} the hash as 32-bit-number ( 0 to 4,294,967,296 )
     */
    self._hash = function (stringORObject) {
        if (typeof stringORObject !== "string") {
            stringORObject = JSON.stringify(stringORObject);
        }
        return farmhash.hash32(stringORObject + '_' + this.identifier);
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
                console.error('sticky-load-balancer.tellBalancer(): cant add node, connection error: ');
                console.dir(err);
                return false;
            }
        })
    };


    return ret;
})();