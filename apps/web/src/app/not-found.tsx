import Link from 'next/link';
export default function NotFound() { return <section className="placeholder-panel"><p className="eyebrow">404 · PAGE NOT FOUND</p><h1>This idea needs another direction.</h1><p>The page you’re looking for isn’t here.</p><Link className="button primary" href="/projects">Back to projects</Link></section>; }
