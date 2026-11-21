# FixMate – Backend Server

FixMate is a Smart Device & Home Appliance Repair Service Platform backend. It provides APIs for managing users, repair services, bookings, technicians, and payments.

## Technologies Used

- Node.js
- Express.js
- MongoDB
- Better Auth
- JSON Web Token (JWT)
- Stripe Payment Gateway

## Key Features

- Secure authentication and token verification
- Role-based authorization for Admin, Technician, and Customer
- Repair service management
- Booking creation and management
- Technician booking assignment and status updates
- Stripe checkout and payment verification
- Payment history management
- Payment webhook idempotency protection
- MongoDB database integration

## Environment Variables

Create a `.env` file in the server root directory and configure:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
DB_NAME=your_database_name
BETTER_AUTH_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

Never commit your actual `.env` file or secret keys to GitHub.

## Installation & Setup

1. Clone the repository:

```bash
git clone https://github.com/Torikul45/fixmate-server.git
```

2. Go to the project directory:

```bash
cd fixmate-server
```

3. Install dependencies:

```bash
npm install
```

4. Create and configure the `.env` file using the environment variables above.

5. Start the development server:

```bash
npm run dev
```

The backend server will run at:

```text
http://localhost:5000
```

## Client Application

Frontend repository: https://github.com/Torikul45/fixmate-client

## API Overview

The backend provides APIs for:

- Authentication and user management
- Repair services
- Booking management
- Admin operations
- Payment processing and verification

## Payment Integration

Stripe is used to process payments securely. The backend handles checkout sessions, payment verification, and webhook events with idempotency protection.

## Live Server

Production API URL: https://fixmate-server-rust.vercel.app

Backend is deployed on Vercel.

## Test Credentials

| Role         | Email               | Password             |
|--------------|---------------------|----------------------|
| Admin        | habibi98@gmail.com  | Provided to examiner |
| Technician 1 | orbin56@gmail.com   | Provided to examiner |
| Technician 2 | mubid1234@gmail.com | Provided to examiner |
| Customer     | nazib23@gmail.com   | Provided to examiner |

## Author

FixMate Project
Developed by: Torikul islam