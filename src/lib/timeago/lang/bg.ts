export default function (number: number, index: number): [string, string] {
  return [
    ['току що', 'съвсем скоро'],
    ['преди %s секунди', 'след %s секунди'],
    ['преди 1 минута', 'след 1 минута'],
    ['преди %s минути', 'след %s минути'],
    ['преди 1 час', 'след 1 час'],
    ['преди %s часа', 'след %s часа'],
    ['преди 1 ден', 'след 1 ден'],
    ['преди %s дни', 'след %s дни'],
    ['преди 1 седмица', 'след 1 седмица'],
    ['преди %s седмици', 'след %s седмици'],
    ['преди 1 месец', 'след 1 месец'],
    ['преди %s месеца', 'след %s месеца'],
    ['преди 1 година', 'след 1 година'],
    ['преди %s години', 'след %s години'],
  ][index] as [string, string]
}
