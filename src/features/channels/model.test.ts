import {describe,it,expect,vi} from 'vitest';
import {channelRows, changeRegion} from './model';
import {PlayerController} from '../player/controller';
import {defaults} from '../settings/controller';
import type {Station,Playback} from '../../shared/contracts';
const stations:Station[]=Array.from({length:13},(_,i)=>({id:`tbn-${i}`,name:`TBN ${i}`,region:`지역 ${i}`,groupId:'tbn',providerId:'tbn',streamKey:'x',officialPageUrl:'https://example.com'}));
const playback=(status:Playback['status'],stationId:string|null):Playback=>({status,stationId,requestId:0,error:null});
describe('channel presentation and intent',()=>{
 it('collapses all 13 regions into one row, keeps exact favorites',()=>{const rows=channelRows(stations,{...defaults(),tbnStationId:'tbn-2',favoriteIds:['tbn-1','tbn-2']});expect(rows.all).toHaveLength(1);expect(rows.all[0].id).toBe('tbn-2');expect(rows.favorites.map(s=>s.id)).toEqual(['tbn-1','tbn-2']);});
 it('retains removed IDs without substituting a channel',()=>{const rows=channelRows(stations,{...defaults(),favoriteIds:['gone'],lastStationId:'old'});expect(rows.favorites[0]).toMatchObject({id:'gone',available:false});expect(rows.removed).toEqual(['old']);});
 it.each(['playing','loading'] as const)('switches audio only while TBN is %s',status=>{expect(changeRegion(stations,playback(status,'tbn-1'),'tbn-2')).toBe(true)});
 it.each(['idle','stopped','error'] as const)('does not start stopped TBN (%s)',status=>{expect(changeRegion(stations,playback(status,'tbn-1'),'tbn-2')).toBe(false)});
 it('does not disturb another broadcaster or restart same region',()=>{expect(changeRegion(stations,playback('playing','kbs'),'tbn-2')).toBe(false);expect(changeRegion(stations,playback('playing','tbn-2'),'tbn-2')).toBe(false)});
 it('restores last channel silently, and first launch has none',()=>{const resolve=vi.fn();const transport={start:vi.fn(),stop:vi.fn(),setVolume:vi.fn()};const p=new PlayerController({resolve,transport});p.restore('tbn-2',30);expect(p.state).toMatchObject({stationId:'tbn-2',status:'stopped'});expect(resolve).not.toHaveBeenCalled();expect(transport.start).not.toHaveBeenCalled();p.restore(null);expect(p.state.stationId).toBeNull();});
});
