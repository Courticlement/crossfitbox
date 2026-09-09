export const COACH_LEVELS = ["Level 1", "Level 2", "Level 3", "Level 4"] as const;
export type CoachLevel = (typeof COACH_LEVELS)[number];

export function isCoachLevel(value: string): value is CoachLevel {
  return (COACH_LEVELS as readonly string[]).includes(value);
}

// € paid per validated group class delivered, by CrossFit level.
const GROUP_CLASS_RATE_EUR: Record<CoachLevel, number> = {
  "Level 1": 20,
  "Level 2": 20,
  "Level 3": 30,
  "Level 4": 30,
};

export function groupClassRate(level: string | null): number {
  return level && isCoachLevel(level) ? GROUP_CLASS_RATE_EUR[level] : 0;
}

// € the coach owes the box per private class they deliver, flat regardless
// of level — unlike group classes, this isn't gated on the week being
// validated, since private lessons are logged ad hoc outside the weekly
// planning workflow.
export const PRIVATE_CLASS_COST_EUR = 20;
