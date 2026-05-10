export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(centsToDollars(cents));
}
