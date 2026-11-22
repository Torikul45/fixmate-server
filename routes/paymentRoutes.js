import express from "express";
import Stripe from "stripe";
import { ObjectId } from "mongodb";
import { getDB, getClient } from "../config/db.js";
import verifyToken from "../middlewares/verifyToken.js";
import verifyCustomer from "../middlewares/verifyCustomer.js";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Process Successful Payment (Transaction + Idempotency)
const processSuccessfulPayment = async (session) => {
  const { bookingId, customerId } = session.metadata || {};

  if (!ObjectId.isValid(bookingId) || !customerId) {
    throw new Error("Invalid session metadata");
  }

  const db = getDB();
  const client = getClient();
  const mongoSession = client.startSession();

  try {
    let payment;
    let alreadyPaid = false;

    await mongoSession.withTransaction(async () => {
      const booking = await db.collection("bookings").findOne(
        {
          _id: new ObjectId(bookingId),
          customerId,
          stripeSessionId: session.id,
          status: "completed",
        },
        { session: mongoSession },
      );

      if (!booking) {
        throw new Error("Booking not found or session mismatch");
      }

      const amount = Number(booking.finalAmount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        session.currency !== "usd" ||
        session.amount_total !== Math.round(amount * 100)
      ) {
        throw new Error("Payment amount verification failed");
      }

      const paymentsCollection = db.collection("payments");
      const bookingsCollection = db.collection("bookings");

      const existingPayment = await paymentsCollection.findOne(
        { stripeSessionId: session.id },
        { session: mongoSession },
      );

      if (existingPayment) {
        if (
          existingPayment.bookingId.toString() !== booking._id.toString() ||
          existingPayment.customerId !== customerId
        ) {
          throw new Error("Payment session ownership mismatch");
        }

        if (booking.paymentStatus !== "paid") {
          await bookingsCollection.updateOne(
            { _id: booking._id },
            {
              $set: {
                paymentStatus: "paid",
                updatedAt: new Date(),
              },
            },
            { session: mongoSession },
          );
        }

        payment = existingPayment;
        alreadyPaid = true;
        return;
      }

      if (booking.paymentStatus === "paid") {
        throw new Error("Booking is paid but payment record is missing");
      }

      const result = await bookingsCollection.updateOne(
        {
          _id: booking._id,
          customerId,
          status: "completed",
          paymentStatus: { $ne: "paid" },
          stripeSessionId: session.id,
        },
        {
          $set: {
            paymentStatus: "paid",
            updatedAt: new Date(),
          },
        },
        { session: mongoSession },
      );

      if (result.modifiedCount !== 1) {
        throw new Error("Booking payment update failed");
      }

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null;

      payment = {
        bookingId: booking._id,
        serviceTitle: booking.serviceTitle || "",

        customerId,
        customerName: booking.customerName || "",
        customerEmail: booking.customerEmail || "",

        technicianId: booking.technicianId || "",
        technicianName: booking.technicianName || "",
        technicianEmail: booking.technicianEmail || "",

        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        transactionId: paymentIntentId || session.id,

        amount,
        currency: "usd",
        paymentStatus: "paid",

        paidAt: new Date(),
        createdAt: new Date(),
      };

      await paymentsCollection.insertOne(payment, {
        session: mongoSession,
      });
    });

    return { payment, alreadyPaid };
  } finally {
    await mongoSession.endSession();
  }
};

// Stripe Webhook
router.post("/webhook", async (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      if (session.payment_status !== "paid") {
        return res.status(200).json({ received: true });
      }

      await processSuccessfulPayment(session);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error.message);

    return res.status(500).json({
      message: "Webhook processing failed",
    });
  }
});

// Create Stripe Checkout Session
router.post(
  "/create-checkout-session",
  verifyToken,
  verifyCustomer,
  async (req, res) => {
    try {
      const { bookingId } = req.body || {};

      if (typeof bookingId !== "string" || !ObjectId.isValid(bookingId)) {
        return res.status(400).json({
          message: "Invalid booking ID",
        });
      }

      const db = getDB();

      const booking = await db.collection("bookings").findOne({
        _id: new ObjectId(bookingId),
        customerId: req.user.id,
      });

      if (!booking) {
        return res.status(404).json({
          message: "Booking not found",
        });
      }

      if (booking.status !== "completed") {
        return res.status(400).json({
          message: "Only completed bookings can be paid",
        });
      }

      if (booking.paymentStatus === "paid") {
        return res.status(400).json({
          message: "This booking has already been paid",
        });
      }

      const amount = Number(booking.finalAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          message: "Invalid payment amount",
        });
      }

      if (booking.stripeSessionId) {
        try {
          const existingSession = await stripe.checkout.sessions.retrieve(
            booking.stripeSessionId,
          );

          if (
            existingSession.status === "open" &&
            existingSession.payment_status !== "paid"
          ) {
            return res.status(200).json({
              message: "Existing checkout session found",
              url: existingSession.url,
            });
          }

          if (existingSession.payment_status === "paid") {
            return res.status(409).json({
              message: "Payment is being processed. Please refresh shortly.",
            });
          }
        } catch (error) {
          console.error("Existing Stripe session lookup:", error.message);
        }
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: booking.serviceTitle || "FixMate Repair Service",
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          bookingId: booking._id.toString(),
          customerId: req.user.id,
        },
        success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/payment/cancel?bookingId=${bookingId}`,
      });

      const updateResult = await db.collection("bookings").updateOne(
        {
          _id: booking._id,
          customerId: req.user.id,
          status: "completed",
          paymentStatus: { $ne: "paid" },
          stripeSessionId: booking.stripeSessionId ?? null,
        },
        {
          $set: {
            stripeSessionId: session.id,
            updatedAt: new Date(),
          },
        },
      );

      if (updateResult.modifiedCount !== 1) {
        await stripe.checkout.sessions.expire(session.id);

        return res.status(409).json({
          message:
            "A checkout session already exists. Please refresh and try again.",
        });
      }

      return res.status(200).json({
        message: "Checkout session created",
        url: session.url,
      });
    } catch (error) {
      console.error("Stripe checkout error:", error.message);

      return res.status(500).json({
        message: "Failed to create checkout session",
      });
    }
  },
);

// Verify Stripe Payment
router.post(
  "/verify-payment",
  verifyToken,
  verifyCustomer,
  async (req, res) => {
    try {
      const { sessionId } = req.body || {};

      if (typeof sessionId !== "string" || !sessionId.trim()) {
        return res.status(400).json({
          message: "Session ID is required",
        });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid") {
        return res.status(400).json({
          message: "Payment is not completed",
        });
      }

      const { customerId } = session.metadata || {};

      if (!customerId || customerId !== req.user.id) {
        return res.status(403).json({
          message: "Invalid payment session",
        });
      }

      const result = await processSuccessfulPayment(session);

      return res.status(200).json({
        message: result.alreadyPaid
          ? "Payment already verified"
          : "Payment verified successfully",
        alreadyPaid: result.alreadyPaid,
        payment: result.payment,
      });
    } catch (error) {
      console.error("Payment verification error:", error.message);

      return res.status(500).json({
        message: "Payment verification failed",
      });
    }
  },
);

// Get Customer Payment History
router.get("/my-payments", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const db = getDB();

    const payments = await db
      .collection("payments")
      .aggregate([
        {
          $match: {
            customerId: req.user.id,
          },
        },
        {
          $lookup: {
            from: "bookings",
            localField: "bookingId",
            foreignField: "_id",
            as: "booking",
          },
        },
        {
          $unwind: {
            path: "$booking",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
      ])
      .toArray();

    return res.status(200).json({
      message: "Payment history fetched successfully",
      payments: payments.map((payment) => ({
        ...payment,
        paymentStatus: payment.paymentStatus || payment.status || "paid",
      })),
    });
  } catch (error) {
    console.error("Payment history error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch payment history",
    });
  }
});

export default router;
