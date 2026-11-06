import React from 'react';
import {registerRoot,Composition,AbsoluteFill,Sequence,Audio,staticFile,useCurrentFrame,interpolate} from 'remotion';
import AudioWorld from './AudioWorld';

const colors=['#55e9c5','#84b8ff','#b6a1ff','#70cfff','#ffcb78'];
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'};
function Cloud({x,y,s=1,opacity=1}) {return <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}><path d="M-100 45 C-165 40 -160 -35 -100 -40 C-100 -120 10 -130 40 -65 C110 -90 160 -20 120 35 C100 55 -70 55 -100 45" fill="#edf8ff"/></g>;}
function World({type,frame}) {
  const t=frame/30;
  return <svg viewBox="0 0 900 800" width="100%" height="100%">
    <defs><linearGradient id="water" x2="0" y2="1"><stop stopColor="#368fe1"/><stop offset="1" stopColor="#184f86"/></linearGradient><linearGradient id="hill"><stop stopColor="#54c8a9"/><stop offset="1" stopColor="#246f69"/></linearGradient></defs>
    <circle cx="450" cy="370" r="315" fill="#152b3e"/><circle cx="450" cy="370" r="315" fill="none" stroke="#294153" strokeDasharray="5 17"/>
    <g transform={`translate(160 160) rotate(${t*8})`}>
      {Array.from({length:12},(_,i)=><line key={i} x1="0" y1="-70" x2="0" y2="-93" stroke="#ffce78" strokeWidth="7" strokeLinecap="round" transform={`rotate(${i*30})`}/>)}
      <circle r="49" fill="#ffce78"/>
    </g>
    <path d="M85 585 Q210 480 380 565 Q600 640 815 535 L815 690 L85 690Z" fill="url(#water)"/>
    <path d="M490 575 L640 350 L820 570Z" fill="url(#hill)"/><path d="M593 420 L640 350 L695 420 L657 408 L635 427 L615 410Z" fill="#d6eee8"/>
    <path d="M640 450 Q560 520 623 550 Q660 590 570 615" fill="none" stroke="#71ceff" strokeWidth="18" strokeLinecap="round"/>
    {Array.from({length:4},(_,i)=><path key={i} d={`M100 ${613+i*20} Q250 ${600+i*20} 420 ${613+i*20}`} fill="none" stroke="#74cfff" strokeOpacity=".3" strokeWidth="4"/>)}
    <Cloud x={490} y={205} s={1.15}/><Cloud x={665} y={240} s={.55} opacity={.65}/>
    {['cycle','evaporation','condensation'].includes(type)&&Array.from({length:7},(_,i)=>{
      const progress=((t*.18+i/7)%1),x=225+i*23+Math.sin(t+i)*12,y=560-progress*280;
      return <g key={i} opacity={Math.sin(progress*Math.PI)*.8}><path d={`M${x} ${y+26} Q${x-18} ${y} ${x} ${y-30}`} fill="none" stroke="#55e9c5" strokeWidth="5"/><path d={`M${x-10} ${y-22} L${x} ${y-30} L${x+7} ${y-18}`} fill="none" stroke="#55e9c5" strokeWidth="5"/></g>;
    })}
    {['cycle','rain','collection'].includes(type)&&Array.from({length:15},(_,i)=>{const p=(t*.55+i*.117)%1;return <line key={i} x1={430+(i%6)*35} y1={280+p*240} x2={424+(i%6)*35} y2={300+p*240} stroke="#84b8ff" strokeWidth="5" strokeLinecap="round" opacity={Math.sin(p*Math.PI)}/>;})}
    {type==='condensation'&&Array.from({length:10},(_,i)=><circle key={i} cx={390+(i%5)*40} cy={180+Math.floor(i/5)*30} r={5+Math.sin(t*2+i)*2} fill="#84b8ff"/>)}
    <text x="165" y="745" fill="#8eacba" fontSize="22" letterSpacing="4">ENERGY IN</text><text x="590" y="745" fill="#8eacba" fontSize="22" letterSpacing="4">WATER CYCLES</text>
  </svg>;
}
function Generic({scene,frame,accent}) {
  return <svg viewBox="0 0 900 800" width="100%" height="100%">
    <circle cx="450" cy="370" r="295" fill="#152b3e" stroke="#294153"/>
    {scene.labels.map((label,i)=>{const y=180+i*170,p=interpolate(frame,[i*20,i*20+24],[0,1],clamp);return <g key={i} opacity={p} transform={`translate(${(1-p)*35} 0)`}>
      {i>0&&<path d={`M450 ${y-110} V${y-50}`} stroke={accent} strokeWidth="5" strokeDasharray="8 8"/>}
      <rect x="150" y={y-40} width="600" height="100" rx="24" fill="#203d51" stroke={accent} strokeOpacity=".4"/>
      <circle cx="205" cy={y+10} r="25" fill={accent}/><text x="205" y={y+19} textAnchor="middle" fill="#0b1825" fontSize="25" fontWeight="bold">{i+1}</text>
      <text x="490" y={y+19} textAnchor="middle" fill="#edf8ff" fontSize={label.length>25?22:30}>{label}</text>
    </g>;})}
  </svg>;
}
function Scene({scene,index,count,theme,showTabs=false}) {
  const frame=useCurrentFrame();const seconds=frame/30;
  const audioTheme=theme==='audio';
  const accent=audioTheme?(index%2?'#45ddff':'#b095ff'):colors[index%colors.length];
  const enter=interpolate(frame,[0,18],[0,1],clamp);
  const caption=scene.captions.find(c=>seconds>=c.start&&seconds<c.end);
  const special=['cycle','evaporation','condensation','rain','collection'].includes(scene.type);
  return <AbsoluteFill style={{background:audioTheme?'#100e20':'#0b1825',color:'#f0f7fb',fontFamily:'Arial, sans-serif'}}>
    <AbsoluteFill style={{background:audioTheme?'radial-gradient(ellipse at 80% 35%, #302249 0%, transparent 65%)':'radial-gradient(ellipse at 80% 35%, #16394b 0%, transparent 65%)'}}/>
    <div style={{position:'absolute',left:90,right:90,top:100,display:'flex',justifyContent:'space-between',fontSize:25,letterSpacing:4,color:'#a7becb'}}><b style={{color:accent}}>EXPLAINOVA</b><span>FIELD NOTES / {audioTheme?'002':'001'}</span></div>
    <div style={{position:'absolute',left:90,top:220,fontSize:24,color:accent,letterSpacing:5}}>{audioTheme?'THE SCIENCE OF QUIET':special?'THE WATER CYCLE':'A CONCEPT, EXPLAINED'}</div>
    <div style={{position:'absolute',left:90,right:90,top:280,fontSize:76,lineHeight:1.08,fontWeight:700,letterSpacing:-2,opacity:enter,transform:`translateY(${(1-enter)*20}px)`}}>{scene.title}</div>
    <div style={{position:'absolute',left:65,right:65,top:520,height:800}}>{audioTheme?<AudioWorld index={index} frame={frame}/>:special?<World type={scene.type} frame={frame}/>:<Generic scene={scene} frame={frame} accent={accent}/>}</div>
    {showTabs&&special&&<div style={{position:'absolute',top:1340,left:90,right:90,display:'flex',gap:15,flexWrap:'wrap'}}>{scene.labels.map(label=><span key={label} style={{border:'1px solid #355467',color:accent,borderRadius:30,padding:'14px 22px',fontSize:21,letterSpacing:2}}>{label}</span>)}</div>}
    <div style={{position:'absolute',left:85,right:85,top:1450,minHeight:180,display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',fontSize:43,lineHeight:1.25,fontWeight:600}}>{caption?.text}</div>
    {showTabs&&<div style={{position:'absolute',bottom:115,left:90,right:90,display:'flex',gap:12}}>{Array.from({length:count},(_,i)=><div key={i} style={{height:5,flex:1,background:i<=index?accent:'#294153',borderRadius:4}}/>)}</div>}
    <div style={{position:'absolute',bottom:55,left:90,right:90,display:'flex',justifyContent:'space-between',fontSize:20,color:'#7f9aa9',letterSpacing:2}}><span>SMALL LESSONS. CLEAR IDEAS.</span><span>{String(index+1).padStart(2,'0')} / {String(count).padStart(2,'0')}</span></div>
    <Audio src={staticFile(scene.audio)}/>
  </AbsoluteFill>;
}
function Video(props) {return <AbsoluteFill>{props.scenes.map((scene,i)=><Sequence key={i} from={scene.startFrame} durationInFrames={scene.durationInFrames}><Scene scene={scene} index={i} count={props.scenes.length} theme={props.theme} showTabs={props.showTabs===true}/></Sequence>)}</AbsoluteFill>;}
registerRoot(()=> <Composition id="Explainer" component={Video} width={1080} height={1920} fps={30} durationInFrames={1350} defaultProps={{scenes:[]}} calculateMetadata={({props})=>({durationInFrames:props.totalFrames})}/>);
