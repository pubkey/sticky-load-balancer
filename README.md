# sticky-load-balancer
Module for nodejs v4+ to create a loadbalancer with a sticky-strategie.

# custom sticky strategies
Create own sticky strategies to distribute requests depending on the incoming data. ( cookies, headers, GET, body.. )

# Dependencies
This module needs the npm-module 'farmhash'. To use this you need a python compiler.
For Linux you can run the following commands to install it. With windows you are screwed.
```{r, engine='bash', count_lines}
apt-get install build-essential
apt-get install python
apt-get install g++
npm install node-gyp -g
```

# Installation
`npm install sticky-load-balancer --save`

# Visit
[npm](https://www.npmjs.com/package/sticky-load-balancer) | 
[github](https://github.com/danielsun174/sticky-load-balancer)

# Example Code
```js
StickyLoadBalancer = require('sticky-load-balancer');

//set loggin to active
StickyLoadBalancer.setLogging(true);

//create new balancer
var balancer = new StickyLoadBalancer('127.0.0.1', 5555);

/**
 * this must be unique if you chain multiple balancers together.
 * @default Math.random()^5
 */
balancer.setIdentifier('foooooobar');

/**
 * define which parts of a request should be take to create your sticky strategie.
 */
balancer.setStickyStrategy([
    'url',
    'body.foo',
    'body.foobar',
    'headers.user-agent',
    'cookie.foo'
]);

//start the balancer
balancer.start();
```


# Example Code to remotely add one node to the balancer
```js
StickyLoadBalancer = require('sticky-load-balancer');
/**
 * tell the balancer that this node exists
 */
StickyLoadBalancer.tellBalancer(
    {
        //stats of the balancer
        ip: '127.0.0.1',
        port: 5555,
        identifier: 'foooooobar'
    },
    {
        //stats of the node
        ip: '127.0.0.1',
        port: 80,
        balance: 6
    }
);
```