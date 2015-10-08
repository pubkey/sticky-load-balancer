# sticky-load-balancer
NPM-Module for Nodejs to create a loadbalancer with a sticky-strategie.

# custom sticky strategies
Create own sticky strategies to distribute requests.

# Installation
`npm install sticky-load-balancer --save`

# Visit
[Visit npm-page](https://www.npmjs.com/package/sticky-load-balancer)
[Visit github-page](https://github.com/danielsun174/sticky-load-balancer)

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
 * define which parts of a request should be take to create your sticky strategie
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


# Example Code to remotely add one Node to the balancer
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