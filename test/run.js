StickyLoadBalancer = require('../index.js');
async = require('async');
request = require('request');
crypto = require('crypto');
RequestMirror = require('./RequestMirror.js');

function randomString(howMany, chars) {
    chars = chars
        || "abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789";
    var rnd = crypto.randomBytes(howMany)
        , value = new Array(howMany)
        , len = chars.length;

    for (var i = 0; i < howMany; i++) {
        value[i] = chars[rnd[i] % len]
    }

    return value.join('');
}


StickyLoadBalancer.setLogging(true);

var testPort = 61234;
var balancer = new StickyLoadBalancer('127.0.0.1', testPort);


balancer.setIdentifier('foooooobar');
balancer.setStickyStrategy([
    'url',
    'body.foo',
    'body.foobar',
    'headers.user-agent',
    'cookie.foo'
]);

var mirrorPort = 34645;
RequestMirror('127.0.0.1', mirrorPort);
StickyLoadBalancer.tellBalancer({ip: '127.0.0.1', port: testPort, identifier: balancer.identifier}, {
    ip: '127.0.0.1',
    port: mirrorPort,
    balance: 6
});
balancer.start();


//start tests

var testFailed = [];
var runTest=function(cb){

    /**
     * save chained balancers here
     * @type {{}}
     */
    var balancers={};
    var useBalancer=null;

    async.series([
        function createChainedBalancers(next){
            var currentPort = 15000;
            var lip = '127.0.0.1';
            var amount = 100;

            //create balancer-chain
            var c = 0;
            while (c < amount) {

                var prevBalancer = balancers[(c - 1)];

                //create balancer
                balancers[c] = new StickyLoadBalancer(lip, currentPort);
                balancers[c].setStickyStrategy([
                    'url',
                    'body.foo',
                    'cookie.foo'
                ]);
                balancers[c].start();

                //add to previous balancer
                if (prevBalancer) {
                    StickyLoadBalancer.tellBalancer({
                        ip: prevBalancer.getIp(),
                        port: prevBalancer.getPort(),
                        identifier: prevBalancer.identifier
                    }, {
                        ip: lip,
                        port: balancers[c].getPort(),
                        balance: 6
                    });
                }
                currentPort++;
                c++;
            }
            useBalancer = balancers[0];
            var lastBalancer=balancers[Object.keys(balancers)[Object.keys(balancers).length - 1]];
            //add mirror to last balancer
            StickyLoadBalancer.tellBalancer(
                {
                    ip: lastBalancer.getIp(),
                    port: lastBalancer.getPort(),
                    identifier: lastBalancer.identifier
                }, {
                    ip: lip,
                    port: mirrorPort,
                    balance: 6
                });
            next();
        },
        function w8(next) {
            console.log('Starting tests');
            //w8 a bit so all is started up
            setTimeout(function () {
                next();
            }, 1);
        },
        function getRequest(next) {
            console.time("getRequest");
            request({
                url: 'http://localhost:' + testPort + '/foobar?bliebla=imba',
                headers: {
                    'User-Agent': 'foobar agent',
                    'cookie': 'foo=bar; centralnotice_buckets_by_campaign=%7B%22wlm%202015%22%3A%7B%22val%22%3A0%2C%22start%22%3A1440284460%2C%22end%22%3A1447275540%7D%7D; GeoIP=:::::v6; dewikimwuser-sessionId=b7361cbc5cb3b9b2; WMF-Last-Access=06-Oct-2015'
                }
            }, function (err, response, body) {
                if (err) {
                    testFailed.push('getRequest(): error in request');
                }
                var json = {};
                try {
                    json = JSON.parse(body);
                } catch (e) {
                    testFailed.push('getRequest(): cant parse body to json');
                }

                try {
                    if (json.method != 'GET') {
                        testFailed.push('getRequest(): method is not GET');
                    }
                    if (json.url != '/foobar?bliebla=imba') {
                        testFailed.push('getRequest(): url is wrong');
                    }
                    if (json.headers['user-agent'] != 'foobar agent') {
                        testFailed.push('getRequest(): user-agent is not foobar agent');
                    }
                    if (json.cookies.foo != 'bar') {
                        testFailed.push('getRequest(): cookie[foo] is not bar');
                    }
                    if (json.body != '') {
                        testFailed.push('getRequest(): body is not empty');
                    }

                } catch (e) {
                    testFailed.push('getRequest(): unknown error');
                }
                console.timeEnd("getRequest");
                next();

            });
        },
        function POSTrequest(next) {
            console.time("POSTrequest");
            request({
                method: 'POST',
                url: 'http://localhost:' + testPort + '/foobar?bliebla=imba',
                headers: {
                    'User-Agent': 'foobar agent',
                    'cookie': 'foo=bar; centralnotice_buckets_by_campaign=%7B%22wlm%202015%22%3A%7B%22val%22%3A0%2C%22start%22%3A1440284460%2C%22end%22%3A1447275540%7D%7D; GeoIP=:::::v6; dewikimwuser-sessionId=b7361cbc5cb3b9b2; WMF-Last-Access=06-Oct-2015'
                },
                form: {
                    foobar: "furchtbar",
                    fooArray: ['foo', 'bar']
                }
            }, function (err, response, body) {
                if (err) {
                    testFailed.push('POSTrequest(): error in request');
                }
                var json = {};
                try {
                    json = JSON.parse(body);
                } catch (e) {
                    testFailed.push('POSTrequest(): cant parse body to json');
                }

                try {
                    if (json.method != 'POST') {
                        testFailed.push('POSTrequest(): method is not POST');
                    }
                    if (json.url != '/foobar?bliebla=imba') {
                        testFailed.push('POSTrequest(): url is wrong');
                    }
                    if (json.headers['user-agent'] != 'foobar agent') {
                        testFailed.push('POSTrequest(): user-agent is not foobar agent');
                    }
                    if (json.cookies.foo != 'bar') {
                        testFailed.push('POSTrequest(): cookie[foo] is not bar');
                    }
                    if (json.body.foobar != 'furchtbar') {
                        testFailed.push('POSTrequest(): body.foobar!=furchtbar');
                    }

                } catch (e) {
                    testFailed.push('POSTrequest(): unknown error');
                }
                console.timeEnd("POSTrequest");
                next();
            });
        },
        function jsonRequest(next) {
            console.time("jsonRequest");
            request({
                method: 'POST',
                url: 'http://localhost:' + testPort + '/foobar?bliebla=imba',
                headers: {
                    'User-Agent': 'foobar agent',
                    'cookie': 'foo=bar; centralnotice_buckets_by_campaign=%7B%22wlm%202015%22%3A%7B%22val%22%3A0%2C%22start%22%3A1440284460%2C%22end%22%3A1447275540%7D%7D; GeoIP=:::::v6; dewikimwuser-sessionId=b7361cbc5cb3b9b2; WMF-Last-Access=06-Oct-2015'
                },
                body: {
                    foo: 'bar',
                    ar: ['foo', 'bar']
                },
                json: true
            }, function (err, response, json) {
                if (err) {
                    testFailed.push('jsonRequest(): error in request');
                }

                try {
                    if (json.method != 'POST') {
                        testFailed.push('jsonRequest(): method is not POST');
                    }
                    if (json.url != '/foobar?bliebla=imba') {
                        testFailed.push('jsonRequest(): url is wrong');
                    }
                    if (json.headers['user-agent'] != 'foobar agent') {
                        testFailed.push('jsonRequest(): user-agent is not foobar agent');
                    }
                    if (json.cookies.foo != 'bar') {
                        testFailed.push('jsonRequest(): cookie[foo] is not bar');
                    }
                    if (json.body.ar.length != 2) {
                        testFailed.push('jsonRequest(): body.ar.length!=2');
                    }

                } catch (e) {
                    testFailed.push('jsonRequest(): unknown error');
                }
                console.timeEnd("jsonRequest");
                next();

            });
        },
        function bigRequest(next) {
            console.time("bigRequest");
            request({
                method: 'POST',
                url: 'http://localhost:' + testPort + '/foobar?bliebla=imba',
                headers: {
                    'User-Agent': 'foobar agent',
                    'cookie': 'foo=bar; centralnotice_buckets_by_campaign=%7B%22wlm%202015%22%3A%7B%22val%22%3A0%2C%22start%22%3A1440284460%2C%22end%22%3A1447275540%7D%7D; GeoIP=:::::v6; dewikimwuser-sessionId=b7361cbc5cb3b9b2; WMF-Last-Access=06-Oct-2015'
                },
                form: {
                    foo: randomString(2000),
                    bar: randomString(2000),
                    is: randomString(2000),
                    basinga: randomString(2000),
                    boom: randomString(200000)
                }
            }, function (err, response, body) {
                if (err) {
                    testFailed.push('bigRequest(): error in request');
                }
                var json = {};
                try {
                    json = JSON.parse(body);
                } catch (e) {
                    testFailed.push('bigRequest(): cant parse body to json');
                    console.error(body);
                }
                try {
                    if (json.method != 'POST') {
                        testFailed.push('bigRequest(): method is not POST');
                    }
                    if (json.url != '/foobar?bliebla=imba') {
                        testFailed.push('bigRequest(): url is wrong');
                    }
                    if (json.headers['user-agent'] != 'foobar agent') {
                        testFailed.push('bigRequest(): user-agent is not foobar agent');
                    }
                    if (json.cookies.foo != 'bar') {
                        testFailed.push('bigRequest(): cookie[foo] is not bar');
                    }
                    if (json.body.foo.length < 2000) {
                        testFailed.push('bigRequest():body.foo.length<2000');
                    }

                } catch (e) {
                    testFailed.push('bigRequest(): unknown error');
                    console.dir(e);
                }
                console.timeEnd("bigRequest");
                next();

            });
        },
        function chainedBalancersPost(next) {
            //next();return false; //comment in to skip this test
            //make requests
            var makeRequest=function(cb){
                var rand=Math.ceil(Math.random()*1000);
                console.time("chainedBalancersPost("+rand+")");
                request({
                    method: 'POST',
                    url: 'http://' + useBalancer.getIp() + ':' + useBalancer.getPort() + '/foobar?bliebla=imba',
                    headers: {
                        'User-Agent': 'foobar agent',
                        'cookie': 'foo=bar; centralnotice_buckets_by_campaign=%7B%22wlm%202015%22%3A%7B%22val%22%3A0%2C%22start%22%3A1440284460%2C%22end%22%3A1447275540%7D%7D; GeoIP=:::::v6; dewikimwuser-sessionId=b7361cbc5cb3b9b2; WMF-Last-Access=06-Oct-2015'
                    },
                    body: {
                        foo: 'bar'+rand,
                        ar: ['foo', 'bar']
                    },
                    json: true
                }, function (err, response, json) {
                    if (err) {
                        testFailed.push('chainedBalancers(): error in request');
                    }
                    try {
                        if (json.method != 'POST') {
                            testFailed.push('chainedBalancers(): method is not POST');
                        }
                        if (json.url != '/foobar?bliebla=imba') {
                            testFailed.push('chainedBalancers(): url is wrong');
                        }
                        if (json.headers['user-agent'] != 'foobar agent') {
                            testFailed.push('chainedBalancers(): user-agent is not foobar agent');
                        }
                        if (json.cookies.foo != 'bar') {
                            testFailed.push('chainedBalancers(): cookie[foo] is not bar');
                        }
                        if (json.body.ar.length != 2) {
                            testFailed.push('chainedBalancers(): body.ar.length!=2');
                        }

                    } catch (e) {
                        testFailed.push('chainedBalancers(): unknown error');
                    }
                    console.timeEnd("chainedBalancersPost("+rand+")");
                    cb();
                });
            };
            var c=0;
            var doAmount=10;
            var done=0;
            while(c<doAmount){
                setTimeout(function(){
                    makeRequest(function(){
                        done++;
                        if(done==doAmount){
                            next();
                        }
                    });
                }, 200*c);

                c++;
            }
        },

        function finish() {
            console.log('failed tests:');
            console.dir(testFailed);
            cb();
            // setTimeout(process.exit(1));
        }
    ]);
};



    runTest(function(){
       process.exit();
    });



