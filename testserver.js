stickyLoadBalancer=require('./index.js');


var own={
    ip: '127.0.0.1',
    port: 5000,
    balance: 2
};

var balancer={
    ip: '127.0.0.1',
    port: 2000,
    identifier: 'fooooooooobaaaaar'
};

var http=require('http');
var server=http.createServer(function(req,res){

    console.log('request comming');
    res.setHeader('foooo', 'baaaar');

    res.write('fooo');

    setTimeout(function(){
        res.end('baar');
    },3000);

}).listen(5000);


//tell the node-balancer that I am here
function tell(){
    stickyLoadBalancer.tellBalancer(balancer, own);
}

tell();
//do this every 20 secs
setInterval(tell, 20000);