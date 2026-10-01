"use client"

export function OccasionRail({ value, occasions, onChange }: { value: string; occasions: string[]; onChange: (value: string) => void }) {
  return <section className="celebrationOccasions" id="occasions"><div className="wrap"><span className="celebrationEyebrow">For the moments that matter</span><h2>Every occasion deserves<br /><em>a Celebration.</em></h2><p>The big milestones. The little thank-yous. And everything in between.</p><div className="celebrationOccasionRail">{occasions.map((occasion) => <button type="button" key={occasion} className={`chip ${value === occasion ? "active" : ""}`} aria-pressed={value === occasion} onClick={() => onChange(occasion)}>{occasion} <span aria-hidden="true">→</span></button>)}</div></div></section>
}
