import type {GameEvent} from './pot';
export interface DemoStep { at:number; event:GameEvent; expireAfterMs?:number }
/** A deterministic exhibition: the final step expires a deliberately short-lived demo proposal. */
export function createDemoScript():DemoStep[] { return [
 {at:1000,event:{type:'chip',user:'demo_asha',displayName:'Asha',amount:25,demo:true}},
 {at:6500,event:{type:'chip',user:'demo_milo',displayName:'Milo',amount:20,demo:true}},
 {at:12000,event:{type:'chip',user:'demo_jo',displayName:'Jo',amount:20,demo:true}},
 {at:18000,event:{type:'propose',user:'demo_asha',displayName:'Asha',amount:200,what:'a very fancy new streamer setup',demo:true}},
 {at:26000,event:{type:'propose',user:'demo_milo',displayName:'Milo',amount:30,what:'Viewer-picked chai for the streamer',demo:true}},
 {at:33000,event:{type:'vote',user:'demo_asha',displayName:'Asha',id:2,vote:'yes',demo:true}},
 {at:37000,event:{type:'vote',user:'demo_jo',displayName:'Jo',id:2,vote:'yes',demo:true}},
 {at:41000,event:{type:'vote',user:'demo_milo',displayName:'Milo',id:2,vote:'yes',demo:true}},
 {at:45000,event:{type:'propose',user:'demo_jo',displayName:'Jo',amount:15,what:'a cozy chat badge',demo:true},expireAfterMs:12000},
 {at:59000,event:{type:'tick',demo:true}},
 ]; }
