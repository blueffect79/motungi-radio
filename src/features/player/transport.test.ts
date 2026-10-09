import { describe,it,expect,vi } from 'vitest';
import { HtmlAudioTransport } from './transport';
class FakeAudio extends EventTarget {
 preload='';volume=1;src='';error:null|{code:number}=null;
 play=vi.fn(async()=>{});pause=vi.fn();load=vi.fn();
 canPlayType=vi.fn(()=> 'maybe');
 removeAttribute(name:string){if(name==='src')this.src='';}
}
describe('single HTMLAudio transport',()=>{
 it('reuses one audio, native HLS path, muted playing event, clears old source',()=>{
 const audio=new FakeAudio();const transport=new HtmlAudioTransport(audio as unknown as HTMLAudioElement);
 const first={playing:vi.fn(),waiting:vi.fn(),error:vi.fn()};const second={playing:vi.fn(),waiting:vi.fn(),error:vi.fn()};
 const stream={stationId:'a',url:'https://example.org/live.m3u8',format:'hls' as const,resolvedAt:''};
 transport.start(stream,first);expect(first.playing).not.toHaveBeenCalled();transport.setVolume(0);audio.dispatchEvent(new Event('playing'));expect(first.playing).toHaveBeenCalledTimes(1);
 transport.start({...stream,stationId:'b'},second);audio.dispatchEvent(new Event('playing'));expect(first.playing).toHaveBeenCalledTimes(1);expect(second.playing).toHaveBeenCalledTimes(1);expect(audio.volume).toBe(0);
 transport.stop();expect(audio.src).toBe('');audio.dispatchEvent(new Event('playing'));expect(second.playing).toHaveBeenCalledTimes(1);
 });
 it('play rejection becomes explicit error',async()=>{const audio=new FakeAudio();audio.play.mockRejectedValueOnce(new Error('private url omitted'));const transport=new HtmlAudioTransport(audio as unknown as HTMLAudioElement);const events={playing:vi.fn(),waiting:vi.fn(),error:vi.fn()};transport.start({stationId:'a',url:'https://example.org/live',format:'mp3',resolvedAt:''},events);await Promise.resolve();expect(events.error).toHaveBeenCalledWith(expect.objectContaining({code:'network'}));expect(events.playing).not.toHaveBeenCalled();});
});
