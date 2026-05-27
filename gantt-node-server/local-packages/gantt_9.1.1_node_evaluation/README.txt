DHTMLX Gantt for Node.js
============

Version 9.1.1, Professional Edition


License
------------

Evaluation License, check license.txt for more details


How to start
------------

- check the documentation https://docs.dhtmlx.com/gantt/desktop__using_gantt_on_server.html
- you can find code samples in the `/samples` folder of the package 

How to Use
-----------

You can either copy `dhtmlxgantt.node.js` from this package into your project,
or install it as a module:

~~~
  "dependencies": {
    "@dhx/gantt-node": "file:../../gantt_9.1.1_node"
  }
~~~

Usage:

~~~
const Gantt = require("@dhx/gantt-node").Gantt;
~~~

or

~~~
import { Gantt } from "@dhx/gantt-node";
~~~

Where `Gantt` is an instance of a Gantt factory object described here https://docs.dhtmlx.com/gantt/desktop__multiple_gantts.html

How to run samples
------------

All the samples in this package are minimalistic apps that demonstrate the basic API of the gantt

Running the samples:

- navigate to '/samples` and open any sample folder
- `npm install` or `yarn install`
- `npm run start` or `yarn start`

or

Package structure
------------

- ./codebase/dhtmlxgantt.node.js - dhtmlxgantt library, minified js.
- ./codebase/sources/dhtmlxgantt.node.js - dhtmlxgantt library, non-minified js.
- ./samples - code samples

Useful links
-------------

- Product information
	https://dhtmlx.com/docs/products/dhtmlxGantt/

- Online documentation
	https://docs.dhtmlx.com/gantt/

- Support forum
	https://forum.dhtmlx.com/c/gantt