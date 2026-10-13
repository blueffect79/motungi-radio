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
