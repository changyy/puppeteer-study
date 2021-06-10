// https://www.npmjs.com/package/puppeteer
// https://pptr.dev/#?product=Puppeteer&version=v10.0.0&show=api-class-page
const puppeteer = require('puppeteer');
// https://devdocs.io/puppeteer/index#puppeteerdevices
// https://github.com/puppeteer/puppeteer/blob/main/src/common/DeviceDescriptors.ts
let device = puppeteer.devices['iPhone X'];

let watch_tags = [];
let watch_tags_property = [];
let watch_request_keywords = [];
let skip_resource_type = [];
let url_init = [];
// https://nodejs.org/docs/latest/api/process.html#process_process_argv
if (process && process.argv) {
	for (let i=0, cnt=process.argv.length ; i<cnt ; ++i) {
		switch(process.argv[i]) {
			case '-tag':
				if (i+1 < cnt) {
					const fields = process.argv[++i].split('.');
					if (!watch_tags.includes(fields[0]))
						watch_tags.push(fields[0]);
					if (fields.length == 2) {
						if (!watch_tags_property[fields[0]])
							watch_tags_property[fields[0]] = [];
						if (!watch_tags_property[fields[0]].includes(fields[1]))
							watch_tags_property[fields[0]].push(fields[1]);
					}
				}
				break;
			case '-request':
				if (i+1 < cnt) {
					const fields = process.argv[++i].split('&&');
					if (!watch_request_keywords.includes(fields))
						watch_request_keywords.push(fields);
				}
				break;
			case '-skip-resource-type':
				if (i+1 < cnt) {
					const fields = process.argv[++i].split(',');
					for (let j=0, cnt=fields.length; j<cnt ; ++j) {
						skip_resource_type[ fields[j] ] = true;
					}
				}
				break;
			case '-url':
				if (i+1 < cnt) {
					url_init.push(process.argv[++i]);
				}
				break;

			case '-device':
				if (i+1 < cnt) {
					if (puppeteer.devices[ process.argv[i+1] ])
						device = puppeteer.devices[ process.argv[++i] ]; 
				}
				break;
		}
	}
}

if (url_init.length == 0) {
	const path = require('path');
	console.log('Usage> '+path.basename(process.argv[0])+' '+path.basename(process.argv[1])+' -device "iPhone 6" -url "https://tw.yahoo.com" -tag "a.href" -tag "script.src" -request "keyword1&&keyword2&&keyword3"');
	console.log('\t$ '+path.basename(process.argv[0])+' '+path.basename(process.argv[1])+' -url "https://www.google.com.tw" -request ".gif"');
	console.log('\t$ '+path.basename(process.argv[0])+' '+path.basename(process.argv[1])+' -url "https://www.google.com.tw" -tag "script.src"');
	console.log();
	process.exit(0);
}
console.log('[INFO] watch tags: ');
console.log(watch_tags);
console.log('[INFO] watch tags property: ');
console.log(watch_tags_property);
console.log('[INFO] watch request keywords: ');
console.log(watch_request_keywords);
console.log('[INFO] skip resource type: ');
console.log(skip_resource_type);
console.log('[INFO] URL: ');
console.log(url_init);

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function watchRequest(page_url, request_url) {
	if (watch_request_keywords.length > 0) {
		for (var i=0, cnt=watch_request_keywords.length; i<cnt ; ++i) {
			let found = false;
			if (watch_request_keywords[i].length > 0) {
				found = watch_request_keywords[i].length > 0;
				for (var j=0 ; j<watch_request_keywords[i].length ; ++j) {
					if (request_url.indexOf(watch_request_keywords[i][j]) == -1) {
						found = false;
						break;
					}
				}
			}
			if (found) {
				console.log('[WATCH][REQUEST] keywords: '+watch_request_keywords[i]);
				console.log('\n\tWeb URL: ['+page_url+']\n\t\tRequest: ['+request_url+']');
				const url_info = new URL(request_url);
				for (const [key, value] of url_info.searchParams) {
					console.log("\t\t\t["+key+'] = ['+value+']');
				}
			}
		}
	}
}

function watchTags(tags) {
	for (var i=0,cnt=tags.length ; i<cnt ; ++i) {

	}
}

(async () => {
	const browser = await puppeteer.launch({headless: false});
	//const page = await browser.newPage();
	const context = await browser.createIncognitoBrowserContext();
	const page = await context.newPage();
	await page.emulate(device);
	await page.setRequestInterception(true);

	page.on('request', request => {
		watchRequest(page.url(), request.url());
		if (skip_resource_type[ request.resourceType() ])
			request.abort();
		else
			request.continue();
	});

	while (true) {
		if (url_init.length > 0) {
			const target_url = url_init.shift();
			await page.goto(target_url, {
				waitUntil: 'networkidle0',
			});

			const static_html_content = await page.content();
			const dynamic_body_content = await page.$eval('body', (element) => { return element.innerHTML });

			let output_tags = [];
			for (var i=0, cnt=watch_tags.length ; i<cnt ; ++i) {
				const tag_name = watch_tags[i];
				const elementHandles = await page.$$( tag_name );
				if (watch_tags_property[tag_name]) {
					for (var j=0 ; j<watch_tags_property[tag_name].length ; ++j) {
						const property_name = watch_tags_property[tag_name][j];
						const propertyJsHandles = await Promise.all(
							elementHandles.map(handle => handle.getProperty(property_name))
						);
						const values = await Promise.all(
							propertyJsHandles.map(handle => handle.jsonValue())
						);
						if (!output_tags[tag_name]) {
							output_tags[tag_name] = [];
							for (var k=0; k<values.length ; ++k) {
								output_tags[tag_name].push({});
							}
						}
						for (var k=0; k<values.length ; ++k) {
							output_tags[tag_name][k][property_name] = values[k];
						}
					}
				}
				console.log('[WATCH][TAG] '+tag_name+': '+watch_tags_property[tag_name]);
				console.log('Web URL: ['+target_url+']');
				console.log(output_tags[tag_name]);
			}
			//console.log('[INFO] output_tags: ');
			//console.log(output_tags);
		}
		if (url_init.length > 0)
			await sleep(5000);
		else
			await sleep(50);
	}
	await browser.close();
})();
