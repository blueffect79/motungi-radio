import Hls from 'hls.js';
import type { ResolvedStream } from '../../shared/contracts';
import type { Transport, TransportEvents } from './controller';
/** A single audio element is reused. URLs only live in this transport / browser media memory. */
export class HtmlAudioTransport implements Transport {
 private hls?: Hls;
 private cleanup?: ()=>void;
 private generation=0;
 constructor(private readonly audio: HTMLAudioElement = new Audio()) {audio.preload='none';}
 setVolume(volume:number) {this.audio.volume=Math.max(0,Math.min(100,volume))/100;}
 stop() {this.generation++;this.cleanup?.();this.cleanup=undefined;this.hls?.destroy();this.hls=undefined;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();}
 start(stream:ResolvedStream,events:TransportEvents) {
  this.stop();const generation=this.generation;let failed=false;
  const active=()=>this.generation===generation&&!failed;
  const error=(unsupported=false)=>{if(!active())return;failed=true;events.error({code:unsupported?'unsupported_format':'network',message:unsupported?'이 환경에서 방송 형식을 재생할 수 없습니다.':'방송 연결이 끊겼습니다. 다시 재생해 주세요.',retryable:!unsupported});};
  const playing=()=>{if(active())events.playing();};const waiting=()=>{if(active())events.waiting();};const mediaError=()=>error(this.audio.error?.code===4);const ended=()=>error();
  this.audio.addEventListener('playing',playing);this.audio.addEventListener('waiting',waiting);this.audio.addEventListener('error',mediaError);this.audio.addEventListener('ended',ended);
  this.cleanup=()=>{this.audio.removeEventListener('playing',playing);this.audio.removeEventListener('waiting',waiting);this.audio.removeEventListener('error',mediaError);this.audio.removeEventListener('ended',ended);};
  const play=()=>{if(active())void this.audio.play().catch(()=>error());};
  if(stream.format==='hls'&&!this.audio.canPlayType('application/vnd.apple.mpegurl')) {
   if(!Hls.isSupported()){error(true);return;}
   // Bundled hls.js only. Worker off avoids runtime script/worker loading and CSP relaxation.
   const hls=new Hls({enableWorker:false,manifestLoadingMaxRetry:1,levelLoadingMaxRetry:1,fragLoadingMaxRetry:1});this.hls=hls;
   hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)error();});
   hls.on(Hls.Events.MANIFEST_PARSED,play);hls.loadSource(stream.url);hls.attachMedia(this.audio);
  } else {this.audio.src=stream.url;play();}
 }
}
