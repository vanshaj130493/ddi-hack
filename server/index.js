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

const sample_data = {"agent":"testdata","architecture":"x86_64","availabilityZone":"us-west-2b","contentLength":"7930","country":"testdata","err":"testdata","hostname":"ip-172-31-32-192","imageId":"ami-b730b0cf","instanceId":"i-07d8e76bcfe0e0afa","level":30,"ms":"12.792","msg":"GET /collection/bf8074ca-0d98-40d4-81d1-496ceb34aaf7 200 12.792 ms - 7930","name":"Venom","pid":16145,"privateIp":"172.31.32.192","publicHostname":"ec2-54-71-13-207.us-west-2.compute.amazonaws.com","publicIpv4":"54.71.13.207","region":"us-west-2","remoteAddress":"174.103.142.39","req":{"remotePort":55022,"headers":{"if-none-match":"W/\"1efa-tO48h5jKp0WmeztjvIoyRFlCOrs\"","x-forwarded-proto":"http","signature":"","access-control-allow-headers":"Content-Type, Origin","x-forwarded-port":"443","x-forwarded-for":"174.103.142.39, 172.31.35.147","protocol-version":"1.1","access-control-allow-methods":"GET, OPTIONS","x-real-ip":"172.31.35.147","access-control-allow-origin":"*","if-modified-since":"Sun, 04 Mar 2018 04:02:42 GMT+00:00","host":"api.im360.com","x-nginx-proxy":"true","connection":"upgrade","content-type":"application/json","accept-encoding":"gzip","key":"61d74a94-b52d-4aa7-ab09-25531ed9638a","user-agent":"Dalvik/2.1.0 (Linux; U; Android 7.0; SM-G950U Build/NRD90M)"},"method":"GET","url":"/api/v1.1/collection/bf8074ca-0d98-40d4-81d1-496ceb34aaf7","remoteAddress":"127.0.0.1"},"reqStart":"2018-03-04T18:42:08.637Z","res":{"header":"HTTP/1.1 200 OK\r\nX-DNS-Prefetch-Control: off\r\nStrict-Transport-Security: max-age=15552000; includeSubDomains\r\nX-Download-Options: noopen\r\nX-Content-Type-Options: nosniff\r\nX-XSS-Protection: 1; mode=block\r\nServer-Version: v1.8.6-2-g3dac0d9\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: 7930\r\nETag: W/\"1efa-tO48h5jKp0WmeztjvIoyRFlCOrs\"\r\nDate: Sun, 04 Mar 2018 18:42:08 GMT\r\nConnection: keep-alive\r\n\r\n","statusCode":200},"resStart":"2018-03-04T18:42:08.650Z","startTime":"testdata","time":"2018-03-04T18:42:08.650Z","type":"access","url":"testdata","v":0,"venom_version":"v1.8.6-2-g3dac0d9","version":"v1.8.6-2-g3dac0d9"};

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
	res.stat.medConLen = (Math.min.apply(null, conLen) + Math.max.apply(null, conLen))/2;
	res.stat.medResTime = (Math.min.apply(null, resTime) + Math.max.apply(null, resTime))/2;
	
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
		
	fs.writeFileSync('../public/myjsonfile.json', JSON.stringify(myData));//, function(err){
		console.log("json file written");
		ctx.status = 200;
		ctx.body = res;
	//}); 
});

router.get('/test', async ctx => {
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
	
	var i = 0;
	/*io.on('connection', function(){ 
		io.emit('broadcast', getNextData(i++));
	});
	*/
	
	//setTimeout(function(){
		io.sockets.emit('broadcast', getNextData(i++,entries.json));
	//}, 3000); 
    ctx.status = 200;
    ctx.body = entries.json;
});

function getNextData(i,data) {
	return data[i];
}

// Use router middleware
app.use(router.routes());
app.use(router.allowedMethods());

// Start server on app port.
const port = nconf.get('app_port');
server.listen(port, () => {
    console.log(`Server started on port ${port}.`);
});
