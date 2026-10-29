import {describe,it,expect} from 'vitest';
import {parseIrcLine,formatLiveChatMessage,safeChatColor,escapeChatText} from '../src/irc';
import {createDemoScript} from '../src/demo';

describe('live chat display helpers',()=>{
 it('uses a valid Twitch color and falls back for invalid CSS input',()=>{expect(safeChatColor('#1a2B3c')).toBe('#1a2B3c');expect(safeChatColor('red; background:url(x)')).toBe('#72563f');expect(safeChatColor(undefined)).toBe('#72563f');});
 it('escapes markup and truncates text to 80 characters',()=>{expect(escapeChatText('<img src=x onerror="bad">')).toBe('&lt;img src=x onerror=&quot;bad&quot;&gt;');expect(escapeChatText('x'.repeat(81))).toHaveLength(80);});
 it('formats Twitch chat with escaped name and text',()=>{const m=parseIrcLine('@color=#9147FF;display-name=<Mia> :mia!u PRIVMSG #x :<script>alert(1)</script>');expect(formatLiveChatMessage(m)).toEqual({displayName:'&lt;Mia&gt;',color:'#9147FF',text:'&lt;script&gt;alert(1)&lt;/script&gt;'});});
});
describe('demo story',()=>{it('orders chips, over-cap rejection, valid proposal, enough yes votes, and expiry across ~60 seconds',()=>{const script=createDemoScript();expect(script.at(-1)!.at).toBe(59000);expect(script[0].event.type).toBe('chip');expect(script[3].event).toMatchObject({type:'propose',amount:200,demo:true});expect(script[4].event).toMatchObject({type:'propose',what:'Viewer-picked chai for the streamer',demo:true});expect(script[5].event).toMatchObject({type:'vote',vote:'yes',demo:true});expect(script[6].event).toMatchObject({type:'vote',vote:'yes',demo:true});expect(script[7].event).toMatchObject({type:'vote',vote:'yes',demo:true});expect(script[8].expireAfterMs).toBeGreaterThan(0);expect(script.every(s=>'demo' in s.event&&s.event.demo===true)).toBe(true);});});
