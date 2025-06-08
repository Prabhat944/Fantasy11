const twilio = require('twilio');
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

exports.sendOTPViaSMS = async (mobile, otp) => {
  try {
    const message = await client.messages.create({
      body: `Your OTP is: ${otp}`,
      from: TWILIO_PHONE_NUMBER,
      to: `+91${mobile}` // Include country code
    });
    return message;
  } catch (err) {
    console.error('❌ Twilio SMS error:', err);
    throw new Error('Failed to send OTP via SMS');
  }
};
