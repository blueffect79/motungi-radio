import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
for (const [dir,direct] of [['dist',true],['dist-appstore',false]]) {
 const code = readdirSync(`${dir}/assets`).filter(n=>/^index-.*\.js$/.test(n)).map(n=>readFileSync(`${dir}/assets/${n}`,'utf8')).join('');
 assert.ok(code, `${dir}: 프런트 빌드가 없습니다.`);
 for (const command of ['prepare_update','install_update']) assert.equal(code.includes(command),direct,`${dir}: ${command} 배포 경계 위반`);
 console.log(`${dir}: 업데이트 명령 포함/제외 확인`);
}
