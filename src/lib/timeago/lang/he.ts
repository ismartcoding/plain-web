export default function (number: number, index: number): [string, string] {
  return [
    ['זה עתה', 'עכשיו'],
    ['לפני %s שניות', 'בעוד %s שניות'],
    ['לפני דקה', 'בעוד דקה'],
    ['לפני %s דקות', 'בעוד %s דקות'],
    ['לפני שעה', 'בעוד שעה'],
    number === 2 ? ['לפני שעתיים', 'בעוד שעתיים'] : ['לפני %s שעות', 'בעוד %s שעות'],
    ['אתמול', 'מחר'],
    number === 2 ? ['לפני יומיים', 'בעוד יומיים'] : ['לפני %s ימים', 'בעוד %s ימים'],
    ['לפני שבוע', 'בעוד שבוע'],
    number === 2 ? ['לפני שבועיים', 'בעוד שבועיים'] : ['לפני %s שבועות', 'בעוד %s שבועות'],
    ['לפני חודש', 'בעוד חודש'],
    number === 2 ? ['לפני חודשיים', 'בעוד חודשיים'] : ['לפני %s חודשים', 'בעוד %s חודשים'],
    ['לפני שנה', 'בעוד שנה'],
    number === 2 ? ['לפני שנתיים', 'בעוד שנתיים'] : ['לפני %s שנים', 'בעוד %s שנים'],
  ][index] as [string, string]
}
