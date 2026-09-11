// "Assistant" is a staff role label, not a coaching-skill tier like the
// other four — for a coach whose whole job is assisting rather than
// teaching solo. It's orthogonal to actually being assigned as an
// assistant on a class (see ClassInstanceAssistant): any coach, any level,
// can assist, the same way any level can be a class's primary coach.
export const COACH_LEVELS = ["Level 1", "Level 2", "Level 3", "Level 4", "Assistant"] as const;
export type CoachLevel = (typeof COACH_LEVELS)[number];

export function isCoachLevel(value: string): value is CoachLevel {
  return (COACH_LEVELS as readonly string[]).includes(value);
}

// € paid per validated group class delivered, by CrossFit level — only
// relevant when this coach is the class's primary coach. "Assistant"
// defaults to 0 here too, same reasoning as ASSIST_CLASS_RATE_EUR below:
// it's the rare edge case of a level="Assistant" coach being made a
// class's primary coach, not the normal way an assistant gets paid.
const GROUP_CLASS_RATE_EUR: Record<CoachLevel, number> = {
  "Level 1": 20,
  "Level 2": 20,
  "Level 3": 30,
  "Level 4": 30,
  Assistant: 0,
};

export function groupClassRate(level: string | null): number {
  return level && isCoachLevel(level) ? GROUP_CLASS_RATE_EUR[level] : 0;
}

// € paid per class a coach assists on (see ClassInstanceAssistant) —
// flat, independent of the assisting coach's own level, unlike
// groupClassRate above. Confirmed default: 0. Not per-coach overridable
// yet (unlike Coach.rate for primary-coach pay) — add that the same way
// if a box ever actually wants to pay a specific assistant something.
export const ASSIST_CLASS_RATE_EUR = 0;

// A handful of named class types are paid at one flat rate, the same for
// every coach regardless of level — overrides both Coach.rate and
// groupClassRate for a class whose label matches (case/whitespace
// insensitive, since it's admin-typed free text, not a fixed enum).
const NAMED_CLASS_RATES_EUR: Record<string, number> = {
  "big wod": 45,
};

export function classPayRate(label: string, fallbackRate: number): number {
  const named = NAMED_CLASS_RATES_EUR[label.trim().toLowerCase()];
  return named ?? fallbackRate;
}

// € the coach owes the box per private class they deliver, flat regardless
// of level — unlike group classes, this isn't gated on the week being
// validated, since private lessons are logged ad hoc outside the weekly
// planning workflow. Which rate applies depends on whether the athlete is a
// subscribed box member (see ClassInstance.athleteIsMember) — a member
// costs less than an outside/drop-in athlete.
export const PRIVATE_CLASS_COST_MEMBER_EUR = 20;
export const PRIVATE_CLASS_COST_NON_MEMBER_EUR = 25;

// A private class logged before athleteIsMember existed (null) falls back
// to the member rate — the flat cost every private class was charged at
// before this distinction existed, so old history doesn't retroactively
// change.
export function privateClassCost(athleteIsMember: boolean | null): number {
  return athleteIsMember === false ? PRIVATE_CLASS_COST_NON_MEMBER_EUR : PRIVATE_CLASS_COST_MEMBER_EUR;
}
