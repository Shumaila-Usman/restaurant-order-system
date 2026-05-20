/**
 * normalizeSourceOrder
 *
 * Converts a raw order document from a restaurant's source MongoDB database
 * into a clean, consistent shape that the mobile app and admin panel consume.
 *
 * Rules:
 *  - Only show orders where paymentStatus is paid (caller is responsible for
 *    pre-filtering, but we also re-check here for safety).
 *  - Do NOT filter by orderStatus – pending/new/processing/preparing/completed
 *    orders all show as long as payment is paid.
 *  - Always return restaurantTimezone from restaurant.timezone.
 *  - Mobile must use restaurantTimezone to display times; never device timezone.
 *  - Pickup mode is detected from many common field names across different
 *    restaurant website platforms.
 */

/**
 * Detect pickup mode and pickup time from a raw source order.
 * Returns { pickupMode: 'asap' | 'scheduled' | 'unknown', pickupTime: Date | null }
 */
function detectPickup(raw) {
  // ── Fields that indicate ASAP ──────────────────────────────────────────────
  const asapFields = ['isASAP', 'asap'];
  for (const f of asapFields) {
    if (raw[f] === true || raw[f] === 'true' || raw[f] === 1) {
      return { pickupMode: 'asap', pickupTime: null };
    }
  }

  // ── Fields that hold a scheduled time ─────────────────────────────────────
  const timeFields = [
    'pickupTime',
    'scheduledTime',
    'selectedTime',
    'requestedTime',
    'fulfillmentTime',
    'scheduledFor',
    'deliveryTime',
  ];

  let pickupTime = null;
  for (const f of timeFields) {
    if (raw[f]) {
      const d = new Date(raw[f]);
      if (!isNaN(d.getTime())) {
        pickupTime = d;
        break;
      }
    }
  }

  // ── Fields that describe type ──────────────────────────────────────────────
  const typeFields = ['pickupType', 'fulfillmentType', 'orderType'];
  for (const f of typeFields) {
    const val = (raw[f] || '').toString().toLowerCase();
    if (val.includes('asap')) return { pickupMode: 'asap', pickupTime: null };
    if (
      val.includes('scheduled') ||
      val.includes('later') ||
      val.includes('future')
    ) {
      return { pickupMode: 'scheduled', pickupTime };
    }
  }

  if (pickupTime) return { pickupMode: 'scheduled', pickupTime };

  return { pickupMode: 'unknown', pickupTime: null };
}

/**
 * Safely read a nested value from an object using a dot-notation path.
 * e.g. safeGet(obj, 'customer.name')
 */
function safeGet(obj, path, fallback = null) {
  if (!obj || !path) return fallback;
  return (
    path.split('.').reduce((acc, key) => (acc != null ? acc[key] : null), obj) ??
    fallback
  );
}

/**
 * Main normalization function.
 *
 * @param {object} sourceOrder  - Raw document from restaurant source DB
 * @param {object} restaurant   - Restaurant document from central DB
 * @param {object} override     - OrderOverride document (may be null)
 * @returns {object}            - Normalized order
 */
function normalizeSourceOrder(sourceOrder, restaurant, override = null) {
  const raw = sourceOrder;

  // ── IDs ───────────────────────────────────────────────────────────────────
  const sourceOrderId = (raw._id || raw.id || '').toString();

  // ── Order number ──────────────────────────────────────────────────────────
  const orderNumberField = restaurant.sourceOrderNumberField || 'orderNumber';
  const orderNumber =
    safeGet(raw, orderNumberField) ||
    raw.orderNumber ||
    raw.order_number ||
    raw.number ||
    sourceOrderId;

  // ── Timestamps ────────────────────────────────────────────────────────────
  const createdAt =
    raw.createdAt ||
    raw.created_at ||
    raw.orderDate ||
    raw.placedAt ||
    raw.date ||
    null;

  // ── Status fields ─────────────────────────────────────────────────────────
  const paymentStatusField = restaurant.sourcePaymentStatusField || 'paymentStatus';
  const paymentStatus =
    safeGet(raw, paymentStatusField) ||
    raw.paymentStatus ||
    raw.payment_status ||
    null;

  const orderStatus =
    raw.orderStatus ||
    raw.order_status ||
    raw.status ||
    null;

  // ── Customer info ─────────────────────────────────────────────────────────
  const customerName =
    raw.customerName ||
    raw.customer_name ||
    safeGet(raw, 'customer.name') ||
    safeGet(raw, 'billing.name') ||
    safeGet(raw, 'billingAddress.name') ||
    null;

  const customerPhone =
    raw.customerPhone ||
    raw.customer_phone ||
    safeGet(raw, 'customer.phone') ||
    safeGet(raw, 'billing.phone') ||
    null;

  const customerEmail =
    raw.customerEmail ||
    raw.customer_email ||
    safeGet(raw, 'customer.email') ||
    safeGet(raw, 'billing.email') ||
    null;

  // ── Items ─────────────────────────────────────────────────────────────────
  const itemsField = restaurant.sourceItemsField || 'items';
  const items = safeGet(raw, itemsField) || raw.items || raw.lineItems || [];

  // ── Financials ────────────────────────────────────────────────────────────
  const subtotal =
    raw.subtotal ?? raw.sub_total ?? raw.subTotal ?? null;
  const tax =
    raw.tax ?? raw.taxAmount ?? raw.tax_amount ?? null;
  const deliveryFee =
    raw.deliveryFee ?? raw.delivery_fee ?? raw.shippingFee ?? null;
  const tip =
    raw.tip ?? raw.tipAmount ?? raw.tip_amount ?? null;
  const total =
    raw.total ?? raw.totalAmount ?? raw.total_amount ?? raw.grandTotal ?? null;
  const currency =
    raw.currency ?? raw.currencyCode ?? 'USD';

  // ── Pickup ────────────────────────────────────────────────────────────────
  const { pickupMode, pickupTime } = detectPickup(raw);

  // ── Timezone (always from restaurant config, never device) ────────────────
  const restaurantTimezone = restaurant.timezone || 'America/New_York';
  if (!restaurant.timezone) {
    console.warn(
      `[Normalize] WARNING: restaurant "${restaurant.name}" has no timezone set. ` +
      `Defaulting to America/New_York`
    );
  }

  // ── Log detected pickup fields (useful for debugging new restaurant configs)
  const detectedPickupFields = [];
  const pickupCheckFields = [
    'isASAP', 'asap', 'pickupType', 'fulfillmentType', 'orderType',
    'pickupTime', 'scheduledTime', 'selectedTime', 'requestedTime',
    'fulfillmentTime', 'scheduledFor', 'deliveryTime',
  ];
  for (const f of pickupCheckFields) {
    if (raw[f] !== undefined) detectedPickupFields.push(`${f}=${JSON.stringify(raw[f])}`);
  }

  return {
    id: sourceOrderId,
    sourceOrderId,
    restaurantId: restaurant._id.toString(),
    restaurantKey: restaurant.restaurantKey,
    restaurantName: restaurant.name,
    restaurantTimezone: restaurantTimezone,

    orderNumber: orderNumber?.toString() || sourceOrderId,
    createdAt: createdAt ? new Date(createdAt).toISOString() : null,

    orderStatus: orderStatus?.toString() || null,
    paymentStatus: paymentStatus?.toString() || null,

    pickupMode,
    pickupTime: pickupTime ? pickupTime.toISOString() : null,

    customerName: customerName?.toString() || null,
    customerPhone: customerPhone?.toString() || null,
    customerEmail: customerEmail?.toString() || null,

    items: Array.isArray(items) ? items : [],

    subtotal: subtotal != null ? Number(subtotal) : null,
    tax: tax != null ? Number(tax) : null,
    deliveryFee: deliveryFee != null ? Number(deliveryFee) : null,
    tip: tip != null ? Number(tip) : null,
    total: total != null ? Number(total) : null,
    currency,

    notes: raw.notes || raw.specialInstructions || raw.special_instructions || null,

    // From OrderOverride (central DB)
    prepTimeMinutes: override?.prepTimeMinutes ?? null,
    customPrepTimeLabel: override?.customPrepTimeLabel ?? null,
    acknowledgedAt: override?.acknowledgedAt
      ? new Date(override.acknowledgedAt).toISOString()
      : null,

    // Internal metadata (not shown in mobile UI directly)
    _detectedPickupFields: detectedPickupFields,
  };
}

module.exports = { normalizeSourceOrder, detectPickup };
