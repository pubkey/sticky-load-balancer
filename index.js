/**
 *
 * @return {{}}
 * @type function
 * @constructor
 */
module.exports = (function StickyLoadBalancer() {
    var self=this;

    //dependencies
    self.farmhash = require('farmhash');
    self.http=require('http');


    /**
     * @type {{identifier: String, stickyStrategie: Function}}
     * @private
     */
    self._state={
        identifier: Math.random()+Math.random()+Math.random()+Math.random()+Math.random()+Math.random(),
        /**
         *
         * @param req
         * return {String|Object}
         */
        stickyStrategie: function(req){
            //TODO implement default sticky-strategy
        },


        server: null,


        /**
         * @type {String}
         */
        status: 'stop',

        /**
         *
         */
        nodes: [
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
        ]
    };


    /**
     * take all nodes and split the 32bit-range between them
     * @private
     */
    self._reDistributeNodes=function(){

        //1. calculate balance.sum()
        var balanceSum=0;
        self._state.nodes.forEach(function(node){
            balanceSum=balanceSum+node.balance;
        });

        var rangePerBalance=Math.ceil(4294967296/balanceSum);

        //2. spread to the nodes
        var startRange=0;
        self._state.nodes.forEach(function(node){
            node.range.from=startRange;
            var addRange=node.balance*rangePerBalance;
            var endRange=startRange+addRange;
            node.range.to=endRange;
            startRange=endRange;
        });

        //3. set round-robin-flag to the first node
        self._state.nodes[0].roundRobin=0;
    };


    /**
     * get the right node for a given hashObj from the StickyStrategy
     * @param {{}|String} hashObj
     * @return {*} the node
     * @private
     */
    self._findDistributionNode=function(hashObj){
        if(Object.keys(hashObj).length===0 || hashObj===''){
            //use round robin because hashObj is empty
            var robinNode=null;
            self._state.nodes.forEach(function(node,i){
                if(node.roundRobin!=null){
                    robinNode=node;
                    //set the round-robin-flag to next
                    node.roundRobin++;
                    if(node.roundRobin>node.balance){
                        node.roundRobin=null;

                        var nextIndex=i+1;
                        if(nextIndex>self._state.nodes.length-1){
                            nextIndex=0;
                        }

                        self._state.nodes[nextIndex].roundRobin=0;
                    }
                    return false;
                }
            });
            return robinNode;
        }else{
            //use sticky-mode
            var hashNr=self._hash(hashObj);
            //find node with this range
            var returnNode=null;
            self._state.nodes.forEach(function(node){
                if(node.range.to>=hashNr && node.range.from<=hashNr){
                    returnNode=node;
                    return false;
                }
            });
            return returnNode;
        }
    };



    /**
     * create an hash-number from given object
     * @param {*} stringORObject
     * @private
     * @returns {number} the hash as 32-bit-number ( 0 to 4,294,967,296 )
     */
    self._hash=function(stringORObject){
        if(typeof stringORObject!=="string"){
            stringORObject=JSON.stringify(stringORObject);
        }
        return self.farmhash.hash32(stringORObject+'_'+self._state.identifier);
    };


    /**
     * set the identifier
     * @param {string} ident
     */
    self.setIdentifier=function(ident){
        self._state.identifier=ident;
    };

    /**
     * set a custom sticky-strategie
     * @param {function({})} f function with req as attribute
     */
    self.setStickyStrategie=function(f){
        self._state.stickyStrategie=f;
    };

    /**
     * add a node to the balancer
     * @param {string} ip
     * @param {number} port
     * @param {number} balance 1-10 only, if node X has balance=2 and node Y has balance=4, node Y would get double the load than node X
     */
    self.addNode=function(ip, port, balance){

        //1. check if balance ok
        if(balance<1 || balance>10){
            console.error('sticky-load-balancer.addNode('+ip+':'+port+','+balance+'): balance must be between 1 and 10');
            return false;
        }

        //2. check if node doesnt exist
        var exists=false;
        self._state.nodes.forEach(function(node){
            if(node.ip==ip && node.port==port){
                exists=true;
                return false;
            }
        });
        if(exists==true){
            console.error('sticky-load-balancer.addNode('+ip+':'+port+','+balance+'): node already exists');
            return false;
        }


        self._state.nodes.push({
            ip: ip,
            port: port,
            balance: balance,
            range:{
                from: 0,
                to: 0
            },
            roundRobin: null
        });
        self._reDistributeNodes();
    };


    /**
     * start the shit!
     * @param {string} listenIP
     * @param {number} port
     */
    self.start=function( listenIP,port){


        if(self._state.nodes.length===0){
            console.error('sticky-load-balancer.start(): cannot start because no node is added');
            return false;
        }

        console.log('load balancer started at '+listenIP+':'+port);
        self.server=self.http.createServer(function(req,res){

            //1. get the right node
            var hashObj=self._state.stickyStrategie(req);
            var useNode=self._findDistributionNode(hashObj);

            //TODO 2. redirect the request
            var options = {
                host: useNode.ip,
                port: useNode.port,

                path: req.url,
                //This is what changes the request to a POST request
                method: req.method,
                headers: req.headers
            };
            delete options.headers.host;

            console.log('request to '+useNode.port);
            console.dir(options);

            /**
             * @link http://stackoverflow.com/questions/13472024/simple-node-js-proxy-by-piping-http-server-to-http-request
             */
            var connection = http.request(options, function(serverResponse) {
                serverResponse.pause();
                res.writeHeader(serverResponse.statusCode, serverResponse.headers);
                serverResponse.pipe(res);
                serverResponse.resume();
            });
            req.pipe(connection);
            req.resume();

        }).listen(port,listenIP);
        self._state.status='start';
    };

    return {
        setIdentifier: self.setIdentifier,
        setStickyStrategie: self.setStickyStrategie,
        addNode: self.addNode,
        start: self.start,
        //TODO remove private method
        findDistributionNode: self._findDistributionNode
    };

})();