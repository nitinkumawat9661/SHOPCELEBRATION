"use client"

export function OccasionRail({ value, occasions, onChange }: { value: string; occasions: string[]; onChange: (value: string) => void }) {
  if (!occasions.length) return null

  return (
    <section className="celebrationOccasions celebrationOccasions--refined" id="occasions">
      <div className="wrap celebrationOccasionLayout">
        <div className="celebrationOccasionIntro">
          <span className="celebrationEyebrow">CHOOSE THE OCCASION</span>
          <h2>Birthday, anniversary<br /><em>or just because.</em></h2>
          <p>Pick an occasion to start your hamper. You can add the delivery details next.</p>
          <span className="celebrationOccasionIntroRule" aria-hidden="true" />
        </div>
        <div className="celebrationOccasionBrowse">
          <div className="celebrationOccasionBrowseMeta">
            <span>What are we celebrating?</span>
            <span className="celebrationOccasionSwipePrompt">Swipe to explore <span aria-hidden="true">→</span></span>
          </div>
          <div className="celebrationOccasionRail" role="group" aria-label="Select a real hamper occasion">
            {occasions.map((occasion) => (
              <button
                type="button"
                key={occasion}
                className={`chip ${value === occasion ? "active" : ""}`}
                aria-pressed={value === occasion}
                onClick={() => onChange(occasion)}
              >
                <span className="celebrationOccasionName">{occasion}</span>
                <span className="celebrationOccasionArrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
          <p className="celebrationOccasionFootnote">Choose an occasion to open your hamper builder.</p>
        </div>
      </div>
    </section>
  )
}
