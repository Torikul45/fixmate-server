const createPaymentIndexes = async (db) => {
  await db.collection("payments").createIndex(
    { stripeSessionId: 1 },
    { unique: true }
  );

  await db.collection("payments").createIndex(
    { bookingId: 1 },
    { unique: true }
  );

  await db.collection("bookings").createIndex(
    { customerId: 1, serviceId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        status: { $in: ["requested", "accepted", "in-progress"] },
      },
      name: "unique_active_customer_service_booking",
    }
  );

  console.log("Payment and booking unique indexes created successfully!");
};

export default createPaymentIndexes;
