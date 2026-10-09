#!/usr/bin/env python3
"""Bounded official probes; prints IDs/status only, never URLs or tokens."""
import concurrent.futures, json, re, urllib.request, urllib.parse
from pathlib import Path
CATALOG=json.loads((Path(__file__).resolve().parents[1]/'resources/stations.json').read_text())
HOSTS={'mbc':{'sminiplay.imbc.com','minisw.imbc.com','minimw.imbc.com','minicw.imbc.com'},'kbs':{'cfpwwwapi.kbs.co.kr',*[f'{s}.gscdn.kbs.co.kr' for s in ['1radio','2radio','3radio','1fm','2fm','hanminjokradio']]},'sbs':{'apis.sbs.co.kr','radiolive.sbs.co.kr'},'cpbc':{'apis.cpbc.co.kr','cdn-radio-seoul.cpbc.co.kr'},'ebs':{'www.ebs.co.kr','liveotu.ebs.co.kr'},'tbn':{'www.tbn.it.kr'},'wbs':{'wbsradio.kr'},'cbs':{'m-aac.cbs.co.kr'},'bbs':{'bbslive.clouducs.com'}}
def valid(url,p):
 u=urllib.parse.urlsplit(url)
 if u.scheme!='https' or u.hostname not in HOSTS[p] or u.username or u.password or u.port not in (None,443):raise ValueError('host-policy')
class Redirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  valid(newurl,self.provider)
  return super().redirect_request(req,fp,code,msg,headers,newurl)
def get(url,p,media=False):
 valid(url,p);handler=Redirect();handler.provider=p
 with urllib.request.build_opener(handler).open(url,timeout=10) as r:
  body=r.read(4096 if media else 262145)
  if not media and len(body)>262144:raise ValueError('response-too-large')
  return body

def check(s):
 p=s['providerId'];k=s['streamKey']
 if k=='unavailable':return s['id']+' UNVERIFIED'
 try:
  if p=='mbc':
   b=get(f'https://sminiplay.imbc.com/aacplay.ashx?channel={k}&protocol=M3U8&agent=webapp&callback=__aacplay',p).decode();m=re.fullmatch(r'__aacplay\((.*)\);?',b.strip(),re.S);u=json.loads(m.group(1))['AACLiveURL']
  elif p=='kbs':u=json.loads(get(f'https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/{k}',p))['channel_item'][0]['service_url']
  elif p=='sbs':u=get(f'https://apis.sbs.co.kr/play-api/1.0/livestream/{k}?protocol=hls&ssl=Y',p).decode().strip()
  elif p=='cpbc':u=json.loads(get('https://apis.cpbc.co.kr/play-api/2.0/onair/channel/radio?ssl=Y',p))['onair']['source']['mediasource']['mediaurl']
  elif p=='ebs':u=re.search(r'https://liveotu\.ebs\.co\.kr/fm/[^\s\x22\x27<>]+',get('https://www.ebs.co.kr/onair?channelCodeString=radio',p).decode()).group().replace('&amp;','&')
  elif p=='wbs':
   assert get('https://wbsradio.kr/wbs-seoul',p,True);return s['id']+' OK mp3-data'
  elif p=='bbs':u='https://bbslive.clouducs.com/bbsradio-mlive/radio.stream/playlist.m3u8'
  elif p=='cbs':u=f'https://m-aac.cbs.co.kr/mweb_{k}/_definst_/{k}.stream/playlist.m3u8'
  elif p=='tbn':u=f'https://www.tbn.it.kr/{k}/myStream/playlist.m3u8'
  else:return s['id']+' NO_IMPLEMENTATION'
  for depth in range(3):
   b=get(u,p);text=b.decode();assert text.startswith('#EXTM3U')
   lines=[v.strip() for v in text.splitlines() if v.strip() and not v.startswith('#')];assert lines
   child=urllib.parse.urljoin(u,lines[0]);valid(child,p)
   if '#EXTINF:' in text:
    assert get(child,p,True);return s['id']+' OK manifest+segment'
   u=child
  return s['id']+' FAIL depth'
 except Exception as e:return s['id']+' FAIL '+type(e).__name__
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
  results=list(ex.map(check,CATALOG['stations']))
 for row in results:print(row)
 raise SystemExit(any(' FAIL ' in x or ' NO_IMPLEMENTATION' in x for x in results))
