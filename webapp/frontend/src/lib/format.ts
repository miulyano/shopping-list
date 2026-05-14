export const fmtDate = (d: Date): string => {
  const months = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ];
  return `${d.getDate()} ${months[d.getMonth()]}`;
};

export const pad2 = (n: number): string => String(n).padStart(2, '0');

export const fmtDateTime = (d: Date): string =>
  `${fmtDate(d)}, ${d.getHours()}:${pad2(d.getMinutes())}`;

export const fmtDateTimeCaps = (d: Date): string => fmtDateTime(d).toUpperCase();

export function pluralRu(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const a1 = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (a1 > 1 && a1 < 5) return forms[1];
  if (a1 === 1) return forms[0];
  return forms[2];
}
