import React from 'react';
import {interpolate} from 'remotion';
const cyan='#45ddff',violet='#b095ff',white='#f4f1ff';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'};
function wave(y,t,amplitude=55,phase=0){return Array.from({length:161},(_,i)=>{const x=100+i*4.4;return `${i?'L':'M'}${x.toFixed(1)},${(y+Math.sin(i/160*Math.PI*6-t*2+phase)*amplitude).toFixed(1)}`;}).join(' ');}
function Headphones({scale=1,x=450,y=340,pulse=0}){return <g transform={`translate(${x} ${y}) scale(${scale})`}>
 <path d="M-150 50 V-40 C-150 -235 150 -235 150 -40 V50" fill="none" stroke="#34304f" strokeWidth="48" strokeLinecap="round"/>
 <path d="M-150 20 V-40 C-150 -235 150 -235 150 -40 V20" fill="none" stroke="#b095ff" strokeWidth="8"/>
 <rect x="-195" y="-8" width="94" height="170" rx="43" fill="#3a3358" stroke="#b095ff" strokeWidth="3"/>
 <rect x="101" y="-8" width="94" height="170" rx="43" fill="#3a3358" stroke="#b095ff" strokeWidth="3"/>
 <rect x="-120" y="10" width="25" height="130" rx="12" fill="#171428"/>
 <rect x="95" y="10" width="25" height="130" rx="12" fill="#171428"/>
 <circle cx="-149" cy="115" r="8" fill={cyan}/><circle cx="149" cy="115" r="8" fill={cyan}/>
 {[0,1,2].map(i=><path key={i} d={`M${-245-i*30} ${10-i*12} Q${-285-i*25-pulse*8} 75 ${-245-i*30} ${140+i*12}`} fill="none" stroke={cyan} strokeWidth="3" opacity={.7-i*.15}/>)}
 </g>;}
function Label({x=100,y,children,color=white,size=24}){return <text x={x} y={y} fontFamily="Arial, sans-serif" fontSize={size} fill={color} letterSpacing="3">{children}</text>;}
export default function AudioWorld({index,frame}){
 const t=frame/30;
 const reveal=interpolate(frame,[5,38],[0,1],clamp);
 const cancel=interpolate(frame,[30,130],[0,1],clamp);
 return <svg viewBox="0 0 900 820" width="100%" height="100%">
  <defs><radialGradient id="studioGlow"><stop stopColor="#35275e"/><stop offset="1" stopColor="#100e20"/></radialGradient></defs>
  <circle cx="450" cy="350" r="320" fill="url(#studioGlow)"/>
  {Array.from({length:15},(_,i)=><line key={i} x1={90+i*50} x2={90+i*50} y1="70" y2="710" stroke="#42335e" strokeOpacity=".23"/>)}
  {Array.from({length:12},(_,i)=><line key={i} x1="90" x2="810" y1={100+i*50} y2={100+i*50} stroke="#42335e" strokeOpacity=".23"/>)}
  {index===0&&<>
    <Headphones pulse={Math.sin(t*3)}/>
    <path d={wave(650,t,25)} stroke={cyan} fill="none" strokeWidth="4" opacity=".85"/>
    <Label x={270} y={760} color={violet}>QUIET, BY DESIGN</Label>
  </>}
  {index===1&&<>
    <Headphones scale={.8} x={570} y={330} pulse={Math.sin(t*3)}/>
    {[0,1,2,3].map(i=>{const p=(t*.5+i*.25)%1;return <path key={i} d={`M${130+p*230} 235 Q${180+p*230} 365 ${130+p*230} 495`} fill="none" stroke={cyan} strokeWidth="5" opacity={1-p}/>;})}
    <path d="M450 432 L345 575 H155" fill="none" stroke={cyan} strokeWidth="2"/><circle cx="450" cy="432" r={12+Math.sin(t*3)*3} fill={cyan}/>
    <Label x={150} y={620} color={cyan}>MICROPHONE</Label><Label x={150} y={660} color="#aba4c8" size={21}>MEASURES THE NOISE</Label>
  </>}
  {index===2&&<>
    <Label y={160} color={cyan}>INCOMING NOISE</Label>
    <path d={wave(270,t)} stroke={cyan} strokeWidth="6" fill="none"/>
    <path d="M450 360 V440 M433 422 L450 440 L467 422" stroke="#86769e" strokeWidth="3" fill="none"/>
    <Label y={520} color={violet}>OPPOSING SIGNAL</Label>
    <path d={wave(630,t,55*reveal,Math.PI)} stroke={violet} strokeWidth="6" fill="none"/>
    <Label x={210} y={780} color="#aba4c8" size={21}>PEAKS ALIGN WITH TROUGHS</Label>
  </>}
  {index===3&&<>
    <Label y={150} color={white}>AT YOUR EAR</Label>
    <path d={wave(300,t,60)} stroke={cyan} strokeWidth="5" fill="none" opacity=".85"/>
    <path d={wave(300,t,60,Math.PI)} stroke={violet} strokeWidth="5" fill="none" opacity={reveal}/>
    <Label x={430} y={450} color="#aa9dcb" size={45}>=</Label>
    <path d={wave(570,t,60*(1-cancel)+5)} stroke={white} strokeWidth="6" fill="none"/>
    <Label x={260} y={710} color={white}>LESS PRESSURE CHANGE</Label>
    <Label x={215} y={760} color="#aba4c8" size={18}>IDEALIZED WAVES · NOT TO SCALE</Label>
  </>}
  {index===4&&<>
    <Label y={150} color={cyan}>STEADY ENGINE HUM</Label>
    <path d={wave(270,t,12)} stroke={cyan} strokeWidth="6" fill="none"/>
    <Label x={100} y={365} color="#aba4c8" size={21}>EASIER TO REDUCE</Label>
    <Label y={520} color={violet}>SUDDEN, CHANGING SOUND</Label>
    <path d={Array.from({length:161},(_,i)=>{const x=100+i*4.4,spike=Math.exp(-Math.pow((i-80-Math.sin(t)*12)/9,2));return `${i?'L':'M'}${x},${630+Math.sin(i*.7-t*3)*60*spike}`;}).join(' ')} stroke={violet} strokeWidth="5" fill="none"/>
    <Label x={100} y={750} color="#aba4c8" size={21}>HARDER TO CANCEL COMPLETELY</Label>
  </>}
 </svg>;
}
