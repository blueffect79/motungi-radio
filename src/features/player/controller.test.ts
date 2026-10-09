import { describe, it, expect, vi } from 'vitest';
import { PlayerController, type Transport, type TransportEvents } from './controller';
import type { ResolvedStream, Result } from '../../shared/contracts';
const stream = (stationId: string): Result<ResolvedStream> => ({ok:true,data:{stationId,url:'https://example.org/live',format:'mp3',resolvedAt:''}});
function setup() {
 let events: TransportEvents | undefined;
 const transport: Transport = { stop: vi.fn(), setVolume: vi.fn(), start: vi.fn((_s,e) => {events=e;}) };
 const resolve = vi.fn(async (id: string, _signal: AbortSignal) => stream(id));
 const player = new PlayerController({transport,resolve});
 return {player,transport,resolve,events:()=>events!};
}
describe('player intent and event state',()=>{
 it('restores selection without autoplay; starts at volume 50',()=>{const s=setup();s.player.restore('a');expect(s.player.state.status).toBe('stopped');expect(s.resolve).not.toHaveBeenCalled();expect(s.transport.setVolume).toHaveBeenCalledWith(50);});
 it('only actual playing event means playing, even muted',async()=>{const s=setup();s.player.setVolume(0);await s.player.select('a');expect(s.player.state.status).toBe('loading');s.events().playing();expect(s.player.state.status).toBe('playing');});
 it('last selection wins and stale playing cannot revive old channel',async()=>{const s=setup();let finish!:(r:Result<ResolvedStream>)=>void;s.resolve.mockImplementationOnce(()=>new Promise(r=>finish=r));const a=s.player.select('a');await s.player.select('b');const b=s.events();finish(stream('a'));await a;expect(s.transport.start).toHaveBeenCalledTimes(1);expect(s.player.state.stationId).toBe('b');s.player.stop();b.playing();expect(s.player.state.status).toBe('stopped');});
 it('stop aborts pending resolution and clears media',async()=>{const s=setup();let signal!:AbortSignal;s.resolve.mockImplementationOnce((_id,x)=>{signal=x;return new Promise(()=>{});});void s.player.select('a');s.player.stop();expect(signal.aborted).toBe(true);expect(s.transport.stop).toHaveBeenCalled();expect(s.player.state.status).toBe('stopped');});
 it('network error is explicit and manual retry resolves fresh',async()=>{const s=setup();await s.player.select('a');s.events().error({code:'network',message:'실패',retryable:true});expect(s.player.state.status).toBe('error');s.events().playing();expect(s.player.state.status).toBe('error');await s.player.retry();expect(s.resolve).toHaveBeenCalledTimes(2);expect(s.player.state.stationId).toBe('a');});
 it('resume reconnects only with playing intent; stopped stays stopped',async()=>{const s=setup();await s.player.select('a');await s.player.resume();expect(s.resolve).toHaveBeenCalledTimes(2);s.player.stop();await s.player.resume();expect(s.resolve).toHaveBeenCalledTimes(2);});
 it('clamps volume and persists selection/volume only',async()=>{const persist=vi.fn();const s=setup();const p=new PlayerController({transport:s.transport,resolve:s.resolve,persist});p.setVolume(200);await p.select('a');expect(s.transport.setVolume).toHaveBeenLastCalledWith(100);expect(persist).toHaveBeenCalledWith({lastStationId:'a'});});
});
