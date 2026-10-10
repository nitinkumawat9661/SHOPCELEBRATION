"use client"

export function OccasionRail({ value, occasions, onChange }: { value: string; occasions: string[]; onChange: (value: string) => void }) {
  return <section className="celebrationOccasions" id="occasions"><div className="wrap"><span className="celebrationEyebrow">CHOOSE THE OCCASION</span><h2>Birthday, anniversary<br /><em>or just because.</em></h2><p>Pick an occasion to start your hamper. You can add the delivery details next.</p><div className="celebrationOccasionRail">{occasions.map((occasion) => <button type="button" key={occasion} className={`chip ${value === occasion ? "active" : ""}`} aria-pressed={value === occasion} onClick={() => onChange(occasion)}>{occasion} <span aria-hidden="true">→</span></button>)}</div></div></section>
}
