stickyLoadBalancer = require('../index.js');
async = require('async');
request = require('request');
crypto=require('crypto');
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

//start mirror-server
var testPort = 61234;
RequestMirror('127.0.0.1', testPort);


//start tests

var testFailed = [];
async.series([
    function w8(next) {
        console.log('Starting tests');
        //w8 a bit so all is started up
        setTimeout(function () {
            next();
        }, 1000);
    },
    function getRequest(next) {

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

            try{
                if(json.method!='GET'){
                    testFailed.push('getRequest(): method is not GET');
                }
                if(json.url!='/foobar?bliebla=imba'){
                    testFailed.push('getRequest(): url is wrong');
                }
                if(json.headers['user-agent']!='foobar agent'){
                    testFailed.push('getRequest(): user-agent is not foobar agent');
                }
                if(json.cookies.foo!='bar'){
                    testFailed.push('getRequest(): cookie[foo] is not bar');
                }
                if(json.body!=''){
                    testFailed.push('getRequest(): body is not empty');
                }

            }catch(e){
                testFailed.push('getRequest(): unknown error');
            }
            next();

        });
    },
    function POSTrequest(next) {

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

            try{
                if(json.method!='POST'){
                    testFailed.push('POSTrequest(): method is not POST');
                }
                if(json.url!='/foobar?bliebla=imba'){
                    testFailed.push('POSTrequest(): url is wrong');
                }
                if(json.headers['user-agent']!='foobar agent'){
                    testFailed.push('POSTrequest(): user-agent is not foobar agent');
                }
                if(json.cookies.foo!='bar'){
                    testFailed.push('POSTrequest(): cookie[foo] is not bar');
                }
                if(json.body.foobar!='furchtbar'){
                    testFailed.push('POSTrequest(): body.foobar!=furchtbar');
                }

            }catch(e){
                testFailed.push('POSTrequest(): unknown error');
            }
            next();

        });
    },
    function jsonRequest(next){
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

            try{
                if(json.method!='POST'){
                    testFailed.push('jsonRequest(): method is not POST');
                }
                if(json.url!='/foobar?bliebla=imba'){
                    testFailed.push('jsonRequest(): url is wrong');
                }
                if(json.headers['user-agent']!='foobar agent'){
                    testFailed.push('jsonRequest(): user-agent is not foobar agent');
                }
                if(json.cookies.foo!='bar'){
                    testFailed.push('jsonRequest(): cookie[foo] is not bar');
                }
                if(json.body.ar.length!=2){
                    testFailed.push('jsonRequest(): body.ar.length!=2');
                }

            }catch(e){
                testFailed.push('jsonRequest(): unknown error');
            }
            next();

        });
    },
    function bigRequest(next){
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
            try{
                if(json.method!='POST'){
                    testFailed.push('bigRequest(): method is not POST');
                }
                if(json.url!='/foobar?bliebla=imba'){
                    testFailed.push('bigRequest(): url is wrong');
                }
                if(json.headers['user-agent']!='foobar agent'){
                    testFailed.push('bigRequest(): user-agent is not foobar agent');
                }
                if(json.cookies.foo!='bar'){
                    testFailed.push('bigRequest(): cookie[foo] is not bar');
                }
                if(json.body.foo.length<2000){
                    testFailed.push('bigRequest():body.foo.length<2000');
                }

            }catch(e){
                testFailed.push('bigRequest(): unknown error');
                console.dir(e);
            }
            next();

        });
    },
    function finish(next) {
        console.log('failed tests:');
        console.dir(testFailed);
        setTimeout(process.exit(1));
    }
]);





