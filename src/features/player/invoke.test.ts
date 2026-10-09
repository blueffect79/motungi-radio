import {it,expect,vi} from 'vitest';
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn(()=>new Promise(()=>{}))}));
import {invoke} from '@tauri-apps/api/core';
import {resolveStream} from './invoke';
it('uses monotonically increasing request ids and cancels only the exact old request',()=>{
 const first=new AbortController();const second=new AbortController();
 void resolveStream('a',first.signal);void resolveStream('b',second.signal);first.abort();
 const calls=vi.mocked(invoke).mock.calls;
 const old=calls[0][1] as {requestId:number};const next=calls[1][1] as {requestId:number};
 expect(old.requestId).toBeTypeOf('number');expect(next.requestId).toBeGreaterThan(old.requestId);
 expect(calls[2]).toEqual(['cancel_resolve_stream',{requestId:old.requestId}]);
});
