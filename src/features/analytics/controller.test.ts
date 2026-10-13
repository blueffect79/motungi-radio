// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("./config.json", () => ({default:{projectKey:"phc_test",region:"US"}}));
import { Analytics } from "./controller";
beforeEach(() => {localStorage.clear(); vi.useFakeTimers(); vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true}));});
afterEach(() => {vi.useRealTimers();vi.unstubAllGlobals();});
it("does not collect before consent; disabling stops transmission", () => {
 const a=new Analytics();a.capture("app_opened");expect(fetch).not.toHaveBeenCalled();
 a.setEnabled(true);expect(fetch).toHaveBeenCalledTimes(1);
 a.setEnabled(false);a.capture("feature_used",{feature:"pin"});expect(fetch).toHaveBeenCalledTimes(1);a.dispose();
});
it("deduplicates playback callbacks and excludes channel and error data", () => {
 const a=new Analytics();a.setEnabled(true);
 const state={status:"playing" as const,stationId:"private-station",requestId:1,error:null};
 a.playback(state);a.playback(state);expect(fetch).toHaveBeenCalledTimes(2);
 const bodies=vi.mocked(fetch).mock.calls.map(c=>String(c[1]?.body)).join();
 expect(bodies).not.toContain("private-station");expect(bodies).toContain('"$geoip_disable":true');a.dispose();
});
it("caps traffic across instances and survives storage failure", () => {
 const a=new Analytics();a.setEnabled(true);
 for(let i=0;i<150;i++)a.capture("feature_used",{feature:"pin"});
 expect(fetch).toHaveBeenCalledTimes(100);a.dispose();
 const b=new Analytics();b.setEnabled(true);expect(fetch).toHaveBeenCalledTimes(100);b.dispose();
 const spy=vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw Error();});
 const c=new Analytics();expect(()=>c.setEnabled(true)).not.toThrow();c.dispose();spy.mockRestore();
});
