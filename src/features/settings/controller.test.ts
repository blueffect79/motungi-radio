import { describe, it, expect } from 'vitest';
import { SettingsController, defaults, rememberedStations } from './controller';
describe('settings controller', () => {
 it('queues updates against latest committed state and preserves removed IDs', async () => {
 const saved: unknown[]=[];
 const c=new SettingsController({load:async()=>({ok:true,data:defaults()}),save:async(s)=>{saved.push(s);return {ok:true,data:s}}});
 await c.load();
 await Promise.all([c.update(s=>({...s,volume:0})),c.update(s=>({...s,favoriteIds:['deleted']}))]);
 expect(c.settings.volume).toBe(0); expect(c.settings.favoriteIds).toEqual(['deleted']); expect(saved).toHaveLength(2);
 expect(rememberedStations(c.settings,[])).toEqual([{id:'deleted',name:'deleted',available:false}]);
 });
 it('surfaces save failure without committing and continues queue',async()=>{
 let fail=true; const c=new SettingsController({load:async()=>({ok:true,data:defaults()}),save:async(s)=>fail?{ok:false,error:{code:'storage',message:'저장 실패',retryable:true}}:{ok:true,data:s}});
 await c.update(s=>({...s,volume:100})); expect(c.settings.volume).toBe(50); expect(c.error?.code).toBe('storage');
 fail=false; await c.update(s=>({...s,volume:0}));expect(c.settings.volume).toBe(0);expect(c.error).toBeNull();
 });
});
import { AutostartController } from './controller';
it('uses OS query as authority and never accepts failed registration',async()=>{
 let os=false;const c=new AutostartController({get:async()=>({ok:true,data:{enabled:os}}),set:async()=>({ok:false,error:{code:'os_registration',message:'실패',retryable:true}})});
 await c.set(true);expect(c.enabled).toBe(false);expect(c.error?.code).toBe('os_registration');os=true;await c.refresh();expect(c.enabled).toBe(true);expect(c.error).toBeNull();
});
