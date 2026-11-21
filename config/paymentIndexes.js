
const createPaymentIndexes = async (db) => {
  await db.collection("payments").createIndex(
    { stripeSessionId: 1 },
    { unique: true }
  );

  await db.collection("payments").createIndex(
    { bookingId: 1 },
    { unique: true }
  );

  console.log("Payment unique indexes created successfully!");
};

export default createPaymentIndexes;
