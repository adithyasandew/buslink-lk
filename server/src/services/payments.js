import crypto from 'node:crypto';
import Payment from '../models/Payment.js';
import { AppError } from '../middleware/errors.js';
import Booking from '../models/Booking.js';
import { confirmBooking } from './bookings.js';
import { notify } from './notifications.js';

async function notifyPayer(payment, type, message) {
  const booking = await Booking.findById(payment.bookingId, { passengerId: 1 });
  if (booking) await notify(booking.passengerId, type, message, payment.id);
}

/** A pending mock payment that is never settled is abandoned after this long, releasing the booking for a new attempt. */
export const PENDING_TTL_MS = 15 * 60 * 1000;

export const newTransactionId = () => `MOCK-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

export async function expireStalePending(bookingId, now = Date.now()) {
  await Payment.updateMany(
    { bookingId, status: 'pending', createdAt: { $lt: new Date(now - PENDING_TTL_MS) } },
    { status: 'failed', open: false },
  );
}

/**
 * Atomically move a pending payment to success or failed. Success confirms the booking and issues the ticket.
 * If the booking was cancelled in the meantime, the captured money is refunded instead.
 */
export async function settlePayment(paymentId, outcome) {
  const update = outcome === 'success' ? { status: 'success' } : { status: 'failed', open: false };
  const payment = await Payment.findOneAndUpdate({ _id: paymentId, status: 'pending' }, update, { returnDocument: 'after' });
  if (!payment) throw new AppError(409, 'PAYMENT_NOT_PENDING', 'Payment is no longer pending');
  if (outcome !== 'success') {
    await notifyPayer(payment, 'payment_failed', 'Your payment failed. Please try again.');
    return { payment };
  }
  try {
    await notifyPayer(payment, 'payment_success', `Payment of Rs. ${payment.amount} received (${payment.transactionId}).`);
    const { ticket } = await confirmBooking(payment.bookingId);
    return { payment, ticket };
  } catch (err) {
    if (err.code !== 'BOOKING_NOT_CONFIRMABLE') throw err;
    const refunded = await Payment.findByIdAndUpdate(payment.id, { status: 'refunded', open: false, refundedAt: new Date() }, { returnDocument: 'after' });
    await notifyPayer(refunded, 'payment_refunded', `Rs. ${refunded.amount} was refunded because the booking had been cancelled.`);
    return { payment: refunded };
  }
}

/** On cancellation: abandon any pending payment and refund a successful one (mock: full refund before travel). */
export async function refundForBooking(bookingId) {
  await Payment.updateMany({ bookingId, status: 'pending' }, { status: 'failed', open: false });
  const refund = await Payment.findOneAndUpdate(
    { bookingId, status: 'success' },
    { status: 'refunded', open: false, refundedAt: new Date() },
    { returnDocument: 'after' },
  );
  if (refund) await notifyPayer(refund, 'payment_refunded', `Rs. ${refund.amount} has been refunded (${refund.transactionId}).`);
  return refund;
}
