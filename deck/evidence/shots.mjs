import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
const OUT = 'D:/CC Project/deck/shots/';
mkdirSync(OUT, { recursive: true });
const SITE = 'http://disasterreliefstack-sitebucket397a1860-1yhnyt3o1jkm.s3-website.ap-south-1.amazonaws.com/';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
p.on('dialog', (d) => d.accept());
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n, opts = {}) => { await p.screenshot({ path: OUT + n + '.png', ...opts }); console.log('saved', n); };
const go = async (h) => { await p.evaluate((h) => { location.hash = '#/' + h; }, h); await w(2300); };

await p.goto(SITE, { waitUntil: 'networkidle2' }); await w(1500);
await shot('01-landing');
await shot('02-landing-full', { fullPage: true });

// sign in as the demo responder via the one-click demo button
await p.click('#l-start'); await p.waitForSelector('#app:not([hidden])', { timeout: 20000 }); await w(2500);
await shot('03-dashboard');
await go('map'); await shot('04-map');

// report an incident with a real flood photo, to exercise S3 + Rekognition
await p.click('#btn-report'); await w(300);
await p.type('#report-form [name=title]', 'Flooded street: homes surrounded by water');
await p.type('#report-form [name=place]', 'Guwahati, Assam');
await p.select('#report-form [name=severity]', '4');
await (await p.$('#photo')).uploadFile('D:/CC Project/deck/evidence/flood2.jpg'); await w(900);
await p.click('#pick'); await w(1800);
const m = await (await p.$('#bigmap')).boundingBox();
await p.mouse.click(m.x + m.width * 0.64, m.y + m.height * 0.33); await w(600);
await shot('05-report-form');
await p.click('#report-submit'); await w(6000);
console.log('toast:', await p.$eval('#toast', (e) => e.textContent));
await shot('06-report-toast');

await go('incidents'); await shot('07-incidents-ai');
// dispatch the top incident and capture the result
await p.click('[data-act=dispatch]'); await w(2500);
await shot('08-dispatched');
await go('shelters'); await shot('09-shelters');
await go('analytics'); await w(1200);
await shot('10-analytics', { fullPage: true });
await go('alerts'); await shot('11-alerts');
await go('architecture'); await shot('12-architecture', { fullPage: true });
await go('dashboard'); await shot('13-dashboard-after');
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true }); await w(1500);
await shot('14-mobile');
console.log('errors', JSON.stringify(errs));
await b.close();
