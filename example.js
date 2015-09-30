stickyLoadBalancer=require('./index.js');

var url=require('url');


//stickyLoadBalancer.setIdentifier('fooooooooobaaaaar');

stickyLoadBalancer.setStickyStrategie(function(request){

    var ret={};
    var url_parts = url.parse(request.url, true);

    if(url_parts.query.articleID){
        ret.articleID=url_parts.query.articleID;
    }


    return ret;
});

stickyLoadBalancer.addNode('127.0.0.1', 5000, 2);
//stickyLoadBalancer.addNode('127.0.0.1', 5001, 2);
//stickyLoadBalancer.addNode('127.0.0.1', 5002, 2);


stickyLoadBalancer.start('127.0.0.1', 2000);