export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function priceBreakdown({
  basePrice,
  discountAmount = 0,
  discountPercent = 0,
  taxPercent = 0,
  technicianCost = 0,
  otherCosts = 0,
}) {
  const subtotal = round2(basePrice);
  const percentOff = round2(subtotal * (Number(discountPercent) / 100));
  const discount = round2(Number(discountAmount) + percentOff);
  const taxable = round2(Math.max(subtotal - discount, 0));
  const tax = round2(taxable * (Number(taxPercent) / 100));
  const total = round2(taxable + tax);
  const adminMargin = round2(total - Number(technicianCost) - discount - Number(otherCosts));
  return {
    subtotal,
    discount,
    tax,
    total,
    technicianCost: round2(technicianCost),
    otherCosts: round2(otherCosts),
    adminMargin,
  };
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 160);
}
