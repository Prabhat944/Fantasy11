const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');
// const razorpayService = require('../services/razorpayService'); // Example

exports.initiatePayment = async (req, res) => {
    const { userId, amount, currency = 'INR', purpose, gateway = 'razorpay' } = req.body;
    const orderId = uuidv4(); // Generate a unique internal order ID

    try {
        // 1. Create a pending transaction record in your DB
        const transaction = new Transaction({
            userId, amount, currency, orderId, gateway, purpose, status: 'pending'
        });
        await transaction.save();

        // 2. Call the chosen payment gateway service to create an order with them
        let gatewayOrderData;
        if (gateway === 'razorpay') {
            // gatewayOrderData = await razorpayService.createOrder(amount, currency, orderId);
            // Example response from gateway: { id: 'order_abc', amount: amount, currency: 'INR' }
        } // else if (gateway === 'stripe') { ... }
        else {
            return res.status(400).json({ message: 'Unsupported payment gateway.' });
        }
        
        // For Razorpay, you'd send key_id and order_id to the client to open the checkout
        // res.json({
        //     message: 'Order created. Proceed to payment.',
        //     keyId: process.env.RAZORPAY_KEY_ID,
        //     orderId: gatewayOrderData.id, // Gateway's order ID
        //     amount: gatewayOrderData.amount,
        //     currency: gatewayOrderData.currency,
        //     name: 'Your App Name',
        //     description: purpose,
        //     prefill: { /* user details if available */ },
        //     internalOrderId: orderId // Your internal ID for tracking
        // });

        // This is a simplified placeholder response
        res.json({ message: "Payment initiated (placeholder)", orderId: transaction.orderId, gatewayOrderId: "gw_order_placeholder" });

    } catch (error) {
        console.error("Error initiating payment:", error);
        res.status(500).json({ message: "Failed to initiate payment." });
    }
};

exports.handlePaymentCallback = async (req, res) => {
    const { gateway } = req.params; // e.g., 'razorpay'
    const callbackData = req.body; // Data from gateway (e.g., razorpay_payment_id, razorpay_order_id, razorpay_signature)

    try {
        let isValidSignature = false;
        let internalOrderId, gatewayPaymentId, gatewayOrderId;

        if (gateway === 'razorpay') {
            // internalOrderId = callbackData.notes.internal_order_id; // Assuming you passed it in notes
            // isValidSignature = razorpayService.verifySignature(
            //     callbackData.razorpay_order_id,
            //     callbackData.razorpay_payment_id,
            //     callbackData.razorpay_signature
            // );
            // gatewayPaymentId = callbackData.razorpay_payment_id;
            // gatewayOrderId = callbackData.razorpay_order_id;
        } // else if (gateway === 'stripe') { /* ... handle stripe webhook ... */ }

        // Placeholder logic
        isValidSignature = true; 
        internalOrderId = req.query.orderId || "some_internal_order_id"; // Get from query or body
        gatewayPaymentId = "gw_pay_placeholder";
        gatewayOrderId = "gw_order_placeholder";


        if (isValidSignature) {
            const transaction = await Transaction.findOne({ orderId: internalOrderId, status: 'pending' });
            if (transaction) {
                transaction.status = 'success';
                transaction.gatewayPaymentId = gatewayPaymentId;
                transaction.gatewayOrderId = gatewayOrderId;
                // transaction.gatewaySignature = callbackData.razorpay_signature; // If needed
                await transaction.save();

                // IMPORTANT: Now, notify the Wallet Service to credit the user's wallet
                // await axios.post(`${process.env.WALLET_SERVICE_URL}/credit`, {
                //     userId: transaction.userId,
                //     amount: transaction.amount,
                //     transactionId: transaction._id, // Your internal DB transaction ID
                //     description: `Wallet top-up via ${gateway}`
                // });

                console.log(`Payment successful for order ${internalOrderId}. Wallet credit initiated.`);
                // Redirect user to a success page (if applicable for your flow)
                // return res.redirect(`${process.env.APP_BASE_URL}/payment-success?transaction_id=${transaction._id}`);
                return res.json({ status: 'success', message: 'Payment successful', transactionId: transaction._id });
            } else {
                return res.status(404).json({ message: 'Transaction not found or already processed.' });
            }
        } else {
            // Optionally update transaction status to 'failed'
            return res.status(400).json({ message: 'Payment verification failed.' });
        }
    } catch (error) {
        console.error("Error handling payment callback:", error);
        // Optionally redirect to a failure page
        res.status(500).json({ message: "Error processing payment." });
    }
};
// Add getPaymentStatus endpoint