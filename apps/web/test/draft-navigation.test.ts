import test from 'node:test';
import assert from 'node:assert/strict';
import { guardDraftLinkClick } from '../src/lib/draft-navigation.ts';

function click(overrides = {}) {
  return {button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,defaultPrevented:false,stopped:false,
    preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...overrides};
}

test('modified and non-primary link gestures never consume the unsaved-edit warning', () => {
  for(const gesture of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{button:2},{defaultPrevented:true}]){
    let warnings=0;
    const event=click(gesture);
    guardDraftLinkClick(event,()=>{warnings++;return true;});
    assert.equal(warnings,0);
    assert.equal(event.stopped,false);
    assert.equal(event.defaultPrevented,!!gesture.defaultPrevented);
  }
});

test('accepting a link warning leaves protection active until the editor actually unmounts', () => {
  const draft={dirty:true,warnings:0};
  const confirmLeave=()=>{if(draft.dirty)draft.warnings++;return true;};
  const first=click();guardDraftLinkClick(first,confirmLeave);
  // Another handler may prevent the route transition after our capture handler.
  first.preventDefault();
  guardDraftLinkClick(click(),confirmLeave);
  assert.equal(draft.dirty,true);
  assert.equal(draft.warnings,2);
});

test('declining an ordinary navigation cancels the link and its router handler', () => {
  const event=click();guardDraftLinkClick(event,()=>false);
  assert.equal(event.defaultPrevented,true);
  assert.equal(event.stopped,true);
});
