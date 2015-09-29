/**
 *
 * @return {{}}
 * @type function
 * @constructor
 */
module.exports = (function StickyLoadBalancer() {
    var self=this;

    var farmhash = require('farmhash');

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

        /**
         *
         */
        nodes: [
            /*{ //sample-node
                ip: '127.0.0.1',
                port: 3456,
                rangeFrom: 1234,
                rangeTo: 3452345
            }*/
        ]
    };


    /**
     * take all nodes and split the 32bit-range between them
     */
    self.reDistributeNodes=function(){
        //TODO
    };


    /**
     * create an hash-number from given object
     * @param {*} stringORObject
     * @private
     * @returns {number} the hash as 32-bit-number ( 0 to 2147483647 )
     */
    self._hash=function(stringORObject){
        if(typeof stringORObject!=="string"){
            stringORObject=JSON.stringify(stringORObject);
        }
        farmhash.hash32(stringORObject+'_'+self._state.identifier);
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

    self.addNode=function(ip, port){
        self._state.nodes.push({
            ip: ip,
            port: port
        });
        self.reDistributeNodes();
    };


    return {
        setIdentifier: self.setIdentifier,
        setStickyStrategie: self.setStickyStrategie,
        addNode: self.addNode
    };

});