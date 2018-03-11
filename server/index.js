/**
 * Hackathon example server
 * Allows getting logs from CrateDB or RethinkDB using:
 * HTTP GET /logs/cratedb?min=etc&max=etc
 * or HTTP GET /logs/rethinkdb?min=etc&max=etc
 *
 * Feel free to modify this code however you want, or delete
 * it and start over from scratch.
 */

require('dotenv/config');
const nconf = require('nconf');
const Koa = require('koa');
const Router = require('koa-router');
const crate = require('node-crate');
const logger = require('koa-logger');
const rethinkdbdash = require('rethinkdbdash');
const moment = require('moment');

// Start web server using Koa
const app = new Koa();
const router = new Router();

var server = require('http').createServer(app.callback());
var io = require('socket.io')(server);
var fs = require('fs');

const max_limit = 50000;

// Initialize configuration variables
nconf
    .argv({ parseValues: true })
    .env({ parseValues: true, lowerCase: true })
    .defaults({
        rethink_database: 'hackathon',
        rethink_port: 28015,
        crate_port: 4200,
        app_port: 8080
    })
    .required([
        'rethink_database',
        'rethink_host',
        'rethink_port',
        'crate_host',
        'crate_port',
        'app_port'
    ]);

// Connect to databases
const r = rethinkdbdash({
    db: nconf.get('rethink_database'),
    servers: [
        { host: nconf.get('rethink_host'), port: nconf.get('rethink_port') }
    ],
    ssl: { rejectUnauthorized: false }
});

crate.connect(nconf.get('crate_host'), nconf.get('crate_port'));


app.use(logger());

// HTTP GET /logs/rethinkdb?min=etc&max=etc to get logs between dates
router.get('/logs/rethinkdb', async ctx => {
    const { min, max } = ctx.query;
    if (!min || !max)
        ctx.throw(400, 'Must specify min and max in query string.');

    const minDate = moment.utc(min, moment.ISO_8601);
    const maxDate = moment.utc(max, moment.ISO_8601);

    if (!minDate.isValid() || !maxDate.isValid())
        ctx.throw(400, 'Min and max must be ISO 8601 date strings');

    const entries = await r
        .table('logs')
        .between(minDate.toDate(), maxDate.toDate(), { index: 'time' })
        .limit(max_limit)
        .run();

    ctx.status = 200;
    ctx.body = entries;
});

// HTTP GET /logs/cratedb?min=etc&max=etc to get logs between dates
router.get('/logs/cratedb', async ctx => {
    const { min, max } = ctx.query;
    if (!min || !max)
        ctx.throw(400, 'Must specify min and max in query string.');

    const minDate = moment.utc(min, moment.ISO_8601);
    const maxDate = moment.utc(max, moment.ISO_8601);

    if (!minDate.isValid() || !maxDate.isValid())
        ctx.throw(400, 'Min and max must be ISO 8601 date strings');

    const entries = await crate.execute(
        'SELECT * FROM logs WHERE time BETWEEN ? AND ? LIMIT ?',
        [minDate.toDate(), maxDate.toDate(), max_limit]
    );

    ctx.status = 200;
    ctx.body = entries.json;
});

router.get('/test1', async ctx => {
    const { min, max } = ctx.query;
    if (!min || !max)
        ctx.throw(400, 'Must specify min and max in query string.');

    const minDate = moment.utc(min, moment.ISO_8601);
    const maxDate = moment.utc(max, moment.ISO_8601);

    if (!minDate.isValid() || !maxDate.isValid())
        ctx.throw(400, 'Min and max must be ISO 8601 date strings');

    const entries = await crate.execute(
        'SELECT * FROM logs WHERE time BETWEEN ? AND ? LIMIT ?',
        [minDate.toDate(), maxDate.toDate(), max_limit]
    );
	
	var res = [];
	var conLen = [];
	var resTime = [];
	var conLenSum = 0;
	var resTimeSum = 0;
		for(var i = 0; i < entries.json.length; i++)
		{
			res[i] = {};
			res[i].contentLength = entries.json[i].contentLength;
			res[i].ms = entries.json[i].ms;
			res[i].time = entries.json[i].time;
			conLen.push(entries.json[i].contentLength);
			resTime.push(entries.json[i].ms);
			conLenSum = conLenSum + Number(entries.json[i].contentLength);
			resTimeSum = resTimeSum + Number(entries.json[i].ms);
		}

	var data = res;	
	res = {};
	res.data = data;
	res.stat = {};
	res.stat.minConLen = Math.min.apply(null, conLen);
	res.stat.maxConLen = Math.max.apply(null, conLen);
	res.stat.minResTime = Math.min.apply(null, resTime);
	res.stat.maxResTime = Math.max.apply(null, resTime);
	res.stat.avgConLen = (conLenSum/conLen.length).toFixed(3);
	res.stat.avgResTime = (resTimeSum/resTime.length).toFixed(3);
	conLen.sort();
	resTime.sort();
	res.stat.medConLen = conLen[Math.floor(conLen.length/2)];
	res.stat.medResTime = resTime[Math.floor(resTime.length/2)];
	
    ctx.status = 200;
    ctx.body = res;
});

router.get('/test2', async ctx => {
    const { min, max } = ctx.query;
    if (!min || !max)
        ctx.throw(400, 'Must specify min and max in query string.');

    const minDate = moment.utc(min, moment.ISO_8601);
    const maxDate = moment.utc(max, moment.ISO_8601);

    if (!minDate.isValid() || !maxDate.isValid())
        ctx.throw(400, 'Min and max must be ISO 8601 date strings');

    const entries = await crate.execute(
        'SELECT * FROM logs WHERE time BETWEEN ? AND ? LIMIT ?',
        [minDate.toDate(), maxDate.toDate(), max_limit]
    );
	
	var res = []; 
	var k=0;
		for(var i = 0; i < entries.json.length; i++)
		{
			var flag = 0;
			for(var j = 0; j < res.length; j++)
			{
				if(res[j].value == entries.json[i].contentLength)
					flag = 1;
			}
			if(flag == 0)
			{
				res[k] = {};
				res[k].value = entries.json[i].contentLength;
				res[k++].unit = entries.json[i].ms;
			}
			if(res.length == 50)
				break;
		}

	var data = res;	
	res = {};
	res.data = data;
	
	var myData = {};
		myData.JSChart = {};
		myData.JSChart.datasets = [];
		myData.JSChart.datasets[0] = {};
		myData.JSChart.datasets[0].type = "line";
		myData.JSChart.datasets[0].data = data;
		
	fs.writeFileSync('../public/myjsonfile.json', JSON.stringify(myData));
		console.log("json file written");
		ctx.status = 200;
		ctx.body = res;
});

// Use router middleware
app.use(router.routes());
app.use(router.allowedMethods());

// Start server on app port.
const port = nconf.get('app_port');
server.listen(port, () => {
    console.log(`Server started on port ${port}.`);
});
