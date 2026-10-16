const WEIGHTS = [8, 6, 4, 2, 3, 5, 9, 7];

// UPU S10 check digit: international postal tracking numbers are 2 letters, 8 digits, this digit and the country.
export function s10CheckDigit(serial: string): number {
  const sum = [...serial].reduce(
    (total, digit, index) => total + Number(digit) * WEIGHTS[index],
    0,
  );
  const check = 11 - (sum % 11);
  if (check === 10) return 0;
  if (check === 11) return 5;
  return check;
}

export function fakeTrackingNumber(random: () => number = Math.random) {
  const serial = Array.from({ length: 8 }, () =>
    Math.floor(random() * 10),
  ).join("");
  return `IK${serial}${s10CheckDigit(serial)}US`;
}
