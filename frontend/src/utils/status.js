const MAP = {
  pending: ['Pending', 'bg-slate-100 text-slate-700'],
  confirmed: ['Confirmed', 'bg-blue-50 text-blue-700'],
  assigned: ['Assigned', 'bg-indigo-50 text-indigo-700'],
  accepted: ['Accepted', 'bg-cyan-50 text-cyan-800'],
  rejected: ['Rejected', 'bg-rose-50 text-rose-700'],
  on_the_way: ['On The Way', 'bg-amber-50 text-amber-800'],
  arrived: ['Arrived', 'bg-orange-50 text-orange-800'],
  service_started: ['Service Started', 'bg-violet-50 text-violet-800'],
  service_completed: ['Completed', 'bg-emerald-50 text-emerald-800'],
  payment_completed: ['Paid', 'bg-emerald-50 text-emerald-800'],
  cancelled: ['Cancelled', 'bg-rose-50 text-rose-700'],
  refunded: ['Refunded', 'bg-rose-50 text-rose-700'],
  unpaid: ['Unpaid', 'bg-amber-50 text-amber-800'],
  paid: ['Paid', 'bg-emerald-50 text-emerald-800'],
  failed: ['Failed', 'bg-rose-50 text-rose-700'],
  pending_approval: ['Pending Approval', 'bg-amber-50 text-amber-800'],
  approved: ['Approved', 'bg-emerald-50 text-emerald-800'],
  suspended: ['Suspended', 'bg-rose-50 text-rose-700'],
  available: ['Available', 'bg-emerald-50 text-emerald-800'],
  busy: ['Busy', 'bg-amber-50 text-amber-800'],
  on_leave: ['On Leave', 'bg-slate-100 text-slate-700'],
  offline: ['Offline', 'bg-slate-100 text-slate-600'],
  online: ['Online', 'bg-emerald-50 text-emerald-800'],
  active: ['Active', 'bg-emerald-50 text-emerald-800'],
  inactive: ['Inactive', 'bg-slate-100 text-slate-600'],
  published: ['Published', 'bg-emerald-50 text-emerald-800'],
  hidden: ['Hidden', 'bg-slate-100 text-slate-600'],
};

export function statusMeta(status) {
  return MAP[status] || [String(status || 'Unknown').replaceAll('_', ' '), 'bg-slate-100 text-slate-700'];
}

export const TIMELINE = [
  ['pending', 'Booking Created'],
  ['confirmed', 'Order Confirmed'],
  ['assigned', 'Technician Assigned'],
  ['accepted', 'Technician Accepted'],
  ['on_the_way', 'Technician On The Way'],
  ['arrived', 'Technician Arrived'],
  ['service_started', 'Service Started'],
  ['service_completed', 'Service Completed'],
  ['payment_completed', 'Payment Completed'],
];
