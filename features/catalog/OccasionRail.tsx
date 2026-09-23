"use client"

export function OccasionRail({ value, occasions, onChange }: { value: string; occasions: string[]; onChange: (value: string) => void }) {
  return <div className="occasionBar"><div className="wrap occasionFlex">{occasions.map((occasion) => <button key={occasion} className={`chip ${value === occasion ? "active" : ""}`} onClick={() => onChange(occasion)}>{occasion}</button>)}</div></div>
}
