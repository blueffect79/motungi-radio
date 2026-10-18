import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from './distribution-build.mjs';
test('distribution artifacts are isolated and store defaults are disabled',()=>{
 const direct=buildPlan('direct',[],'darwin'), store=buildPlan('appstore',[],'darwin');
 assert.notEqual(direct.target,store.target);
 assert.deepEqual(store.args.slice(-2), ['--', '--no-default-features']);
 assert.ok(store.args.includes('app-store'));
 assert.deepEqual(direct.args,['build']);
});
test('invalid platforms and boundary overrides fail closed',()=>{
 for(const option of ['--features=direct','--config','-c','--no-default-features','--target-dir','-fapp-store','--','--config=x']) assert.throws(()=>buildPlan('appstore',[option],'darwin'));
 assert.throws(()=>buildPlan('appstore',[],'linux'));
 assert.throws(()=>buildPlan('unknown',[],'darwin'));
});

test('valid target arguments stay before Cargo arguments',()=>{
 const plan=buildPlan('appstore',['--target','aarch64-apple-darwin','--debug','--bundles','app'],'darwin');
 assert.deepEqual(plan.args.slice(-2),['--','--no-default-features']);
 assert.throws(()=>buildPlan('appstore',['--target','x86_64-pc-windows-msvc'],'darwin'));
 assert.throws(()=>buildPlan('appstore',['--bundles','dmg'],'darwin'));
});

test('Microsoft Store uses isolated artifacts without updater or Cargo defaults',()=>{
 const store=buildPlan('microsoft-store',['--target','x86_64-pc-windows-msvc','--no-bundle'],'win32');
 assert.equal(store.target,'src-tauri/target-microsoft-store');
 assert.ok(store.args.includes('microsoft-store'));
 assert.deepEqual(store.args.slice(-2),['--','--no-default-features']);
 assert.throws(()=>buildPlan('microsoft-store',[],'darwin'));
 assert.throws(()=>buildPlan('microsoft-store',['--target','aarch64-apple-darwin'],'win32'));
 assert.throws(()=>buildPlan('microsoft-store',['--bundles','nsis'],'win32'));
 for(const option of ['--features=direct','--config','--','--target-dir']) assert.throws(()=>buildPlan('microsoft-store',[option],'win32'));
});
