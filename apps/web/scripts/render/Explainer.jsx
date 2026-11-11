import React from 'react';
import { AbsoluteFill, Audio, Composition, Sequence, interpolate, registerRoot, staticFile, useCurrentFrame } from 'remotion';

function Scene({ scene, hue }) {
  const frame = useCurrentFrame();
  const seconds = (scene.startFrame + frame) / 30;
  const caption = scene.captions.find(cue => cue.start <= seconds && seconds < cue.end);
  const accent = `hsl(${hue} 86% 74%)`;
  const labels = scene.labels.length ? scene.labels : scene.objects;
  const columns = scene.type === 'comparison' || labels.length > 3 ? 2 : 1;
  const rows = Math.max(1, Math.ceil(labels.length / columns));

  return <AbsoluteFill style={{
    background: `radial-gradient(ellipse at 72% 36%, hsl(${hue} 45% 23%), #0a1020 72%)`,
    color: '#f5f7ff', fontFamily: 'Arial, sans-serif', padding: '100px 100px',
  }}>
    <h1 style={{ fontSize: scene.title.length > 56 ? 52 : 74, lineHeight: 1.1, margin: 0, overflowWrap: 'anywhere' }}>{scene.title}</h1>
    <div style={{
      position: 'absolute', top: 590, left: 100, right: 100, bottom: 540,
      display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      alignItems: 'center', gap: 24,
    }}>
      {labels.map((label, index) => {
        const reveal = interpolate(frame, [index * 10, index * 10 + 12], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        return <div key={index} style={{
          opacity: reveal, transform: `translateY(${(1 - reveal) * 12}px)`,
          background: '#ffffff14', borderLeft: `6px solid ${accent}`, borderRadius: 18,
          padding: columns === 2 ? '16px 22px' : '22px 32px',
          fontSize: columns === 2 ? 28 : 40, lineHeight: 1.15, overflowWrap: 'anywhere',
        }}>{label}</div>;
      })}
    </div>
    {caption && <div style={{
      position: 'absolute', top: 1450, left: 100, right: 100, textAlign: 'center',
      fontSize: 48, fontWeight: 700, background: '#080b14', padding: '24px 32px', borderRadius: 22,
      overflowWrap: 'anywhere',
    }}>{caption.text}</div>}
    <Audio src={staticFile(scene.audioFile)} />
  </AbsoluteFill>;
}

function Explainer({ scenes, hue }) {
  return <AbsoluteFill>
    {scenes.map(scene => <Sequence key={scene.startFrame} from={scene.startFrame} durationInFrames={scene.durationFrames}>
      <Scene scene={scene} hue={hue} />
    </Sequence>)}
  </AbsoluteFill>;
}

registerRoot(() => <Composition id="StudioExplainer" component={Explainer} width={1080} height={1920}
  fps={30} durationInFrames={900} defaultProps={{ scenes: [], hue: 210, durationFrames: 900 }}
  calculateMetadata={({ props }) => ({ durationInFrames: props.durationFrames })} />);
