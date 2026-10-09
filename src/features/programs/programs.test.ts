import { describe, it, expect, vi } from 'vitest';
import { currentProgram, ProgramPoller } from './index';
const state = { stationId:'a',status:'available' as const, sourceKind:'schedule' as const,title:'방송', startsAt:'2026-10-09T09:00:00+09:00',endsAt:'2026-10-09T10:00:00+09:00',fetchedAt:'2026-10-09T09:00:00+09:00',sourceUrl:'https://cbs.co.kr/' };
describe('programs',()=>{
 it('uses inclusive start/exclusive end and rejects malformed availability',()=>{
 expect(currentProgram(state,Date.parse(state.startsAt)).status).toBe('available');
 for(const now of [Date.parse(state.startsAt)-1,Date.parse(state.endsAt)]) expect(currentProgram(state,now).title).toBeNull();
 expect(currentProgram({...state,title:''},Date.parse(state.startsAt)).status).toBe('unavailable');
 });
 it('coalesces refresh and clears old values on failed refresh without touching audio',async()=>{
 let fail=false;const fetch=vi.fn(async()=>{if(fail)throw Error('network');return [state]});
 const publish=vi.fn();const poller=new ProgramPoller(['a'],fetch,publish,()=>Date.parse(state.startsAt));
 await Promise.all([poller.refresh(),poller.refresh()]); expect(fetch).toHaveBeenCalledTimes(1);
 fail=true; await poller.refresh(); expect(publish.mock.lastCall?.[0][0].title).toBeNull();poller.stop();
 });
});
it('expires at boundary while hidden before network refresh completes',async()=>{
 vi.useFakeTimers();let now=Date.parse(state.endsAt)-1;let resolve!: (v:typeof state[])=>void;
 const fetch=vi.fn().mockResolvedValueOnce([state]).mockImplementationOnce(()=>new Promise(r=>{resolve=r}));const publish=vi.fn();
 const poller=new ProgramPoller(['a'],fetch,publish,()=>now);await poller.refresh();now+=10;await vi.advanceTimersByTimeAsync(10);
 expect(publish.mock.lastCall?.[0][0].status).toBe('unavailable');resolve([]);await Promise.resolve();poller.stop();vi.useRealTimers();
});
