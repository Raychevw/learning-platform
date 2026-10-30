/** Українське відмінювання після числівників (1 студент, 2 студенти, 5 студентів). */
export function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function studentsLabel(count) {
  return `${count} ${plural(count, 'студент', 'студенти', 'студентів')}`;
}

export function modulesLabel(count) {
  return `${count} ${plural(count, 'модуль', 'модулі', 'модулів')}`;
}
