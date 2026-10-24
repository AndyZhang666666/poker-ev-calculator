const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';import fs from 'node:fs';
const url=process.env.TEST_URL||'http://127.0.0.1:8804/poker-ev-calculator/';
const out=process.env.EVIDENCE_DIR||'/tmp/poker-ev-evidence';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL||'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const range=async(label,value)=>{await page.getByRole('slider',{name:label,exact:true}).evaluate((input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);};
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true,animations:'disabled'});
try{
 await page.goto(url);await page.waitForLoadState('networkidle');await page.getByRole('button',{name:'恢复默认',exact:true}).click();
 await range('我的剩余筹码',10);await range('对手下注',1000);await range('对手剩余筹码',0);await range('手牌强度',20);
 await page.getByRole('group',{name:'对手类型',exact:true}).getByRole('button',{name:'紧',exact:true}).click();
 await page.getByRole('group',{name:'对手行动',exact:true}).getByRole('button',{name:'加注',exact:true}).click();
 assert.match(await page.locator('body').innerText(),/10 \/ \(100 \+ 10 \+ 10\)/);
 assert.match(await page.locator('body').innerText(),/跟注亏钱/);await shot('short-stack');
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'导出这次比较',exact:true}).click();const file=await downloading;await file.saveAs(`${out}/decision.json`);
 const d=JSON.parse(fs.readFileSync(`${out}/decision.json`,'utf8'));assert.equal(d.params.myStack,10);assert.ok(Math.abs(d.result.potOdds-10/120)<1e-12);assert.ok(d.result.call<0);assert.equal(d.counterfactual.from,10);assert.match(d.limits.join(' '),/不是置信区间/);
 await page.reload();await page.waitForLoadState('networkidle');assert.equal(await page.getByRole('slider',{name:'我的剩余筹码',exact:true}).inputValue(),'10');
 await range('我的剩余筹码',0);assert.ok(await page.getByRole('button',{name:'导出这次比较',exact:true}).isDisabled());assert.match(await page.locator('body').innerText(),/当前已无可投入筹码/);
 await page.getByRole('slider',{name:'我的剩余筹码',exact:true}).focus();await page.keyboard.press('End');assert.ok(await page.getByRole('button',{name:'导出这次比较',exact:true}).isEnabled());
 await page.getByRole('button',{name:'恢复默认',exact:true}).click();
 // Real keyboard removal of a public card, not a click-only span.
 await page.getByRole('button',{name:/加一张/}).click();const remove=page.getByRole('button',{name:/移除公共牌/});assert.equal(await remove.count(),1);await remove.focus();await page.keyboard.press('Enter');assert.equal(await remove.count(),0);
 await page.getByRole('button',{name:'案例库',exact:false}).first().click();
 const cases=page.getByRole('button').filter({has:page.locator('h3')});assert.equal(await cases.count(),8);
 for(let i=0;i<8;i++){await cases.nth(i).click();assert.ok(await page.getByRole('button',{name:'EV 计算器',exact:false}).first().getAttribute('aria-pressed')==='true');await page.getByRole('button',{name:'案例库',exact:false}).first().click();}
 for(const tab of ['EV 计算器','敏感性分析','案例库','关于']){
   await page.getByRole('button',{name:tab,exact:false}).first().click();await page.waitForTimeout(100);
   for(const width of [1440,768,390,360]){await page.setViewportSize({width,height:1000});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth,{},{timeout:2000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tab}: overflow ${width}`);}
 }
 await page.getByRole('button',{name:'EV 计算器',exact:false}).first().click();await shot('mobile');
 await page.setViewportSize({width:1440,height:1000});await shot('desktop');
 await page.evaluate(()=>localStorage.setItem('poker-ev:draft:v1','{broken'));await page.reload();await page.waitForLoadState('networkidle');assert.match(await page.locator('body').innerText(),/旧草稿无法恢复/);
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'敏感性分析',exact:false}).first().click();
 const blocked=await browser.newContext();await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked storage');}}));const p=await blocked.newPage();await p.goto(url);await p.waitForLoadState('networkidle');assert.match(await p.locator('body').innerText(),/本地存储不可用|草稿保存失败/);assert.equal(await p.getByRole('button',{name:'导出这次比较',exact:true}).isEnabled(),true);await blocked.close();
 assert.deepEqual(errors,[]);console.log('PASS browser: effective-pot consistency, JSON export, reload, zero-stack recovery, keyboard card removal, all 8 cases, 4 tabs × 4 widths, corrupt/blocked storage and reduced motion; no page errors.');
}finally{await browser.close();}
