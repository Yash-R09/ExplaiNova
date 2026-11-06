import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {openBrowser} from '@remotion/renderer';
const manifest=JSON.parse(await fs.readFile('design/stitch-screens.json','utf8'));
const chosen=process.argv[2]?manifest.screens.filter(s=>s.id===process.argv[2]):manifest.screens;
const browser=await openBrowser('chrome',{browserExecutable:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',chromeMode:'chrome-for-testing'});
try{
 for(const screen of chosen){
  const page=await browser.newPage({context:()=>Promise.resolve(null),logLevel:'error',indent:false,pageIndex:0,onBrowserLog:null,onLog:()=>{}});
  await page.setViewport({width:Math.round(screen.width),height:900,deviceScaleFactor:2});
  await page.goto({url:pathToFileURL(path.resolve('design/stitch',screen.id+'.html')).href,timeout:60000,options:{waitUntil:'load'}});
  await page.evaluate(async()=>{await document.fonts.ready;});
  const size=await page.evaluate(()=>({width:window.innerWidth,height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight),overflow:document.documentElement.scrollWidth>window.innerWidth+2}));
  if(size.overflow)console.log(JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).map(e=>({tag:e.tagName,cls:e.className?.baseVal??e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,text:e.textContent?.slice(0,65)})).filter(e=>e.right>window.innerWidth+2&&e.width>0).slice(0,12))));
  const result=await page._client().send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:size.width,height:size.height,scale:1}});
  await fs.writeFile(path.join('design/stitch',screen.id+'.png'),Buffer.from(result.value.data,'base64'));
  console.log(JSON.stringify({title:screen.title,...size}));await page.close();
 }
}finally{await browser.close({silent:true});}
