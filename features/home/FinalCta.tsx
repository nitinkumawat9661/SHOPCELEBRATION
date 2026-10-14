"use client"

export function FinalCta({ onBuild }: { onBuild: () => void }) {
  return <section className="ctaSec"><div className="wrap"><div className="cta">
    <span className="cbEyebrow">FOR THEIR NEXT CELEBRATION</span>
    <h2>Still deciding what to send?</h2>
    <p>Choose a budget and tell us a little about them. We’ll curate the hamper for you.</p>
    <button className="secondary" type="button" onClick={onBuild}>Build a custom hamper</button>
  </div></div></section>
}
