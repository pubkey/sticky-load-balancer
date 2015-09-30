var http=require('http');
var server=http.createServer(function(req,res){

    console.log('request comming');
    res.setHeader('foooo', 'baaaar');

    res.write('fooo');

    setTimeout(function(){
        res.end('baar');
    },3000);

}).listen(5000);