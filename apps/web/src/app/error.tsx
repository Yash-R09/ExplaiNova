'use client';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <section className="placeholder-panel" role="alert"><h1>Something interrupted the studio.</h1><p>Please try loading this page again.</p><button className="button primary" onClick={reset}>Try again</button></section>; }
