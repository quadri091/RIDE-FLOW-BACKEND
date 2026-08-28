const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.email,
    pass: process.env.password,
  },
});

/**
 * Shared RideFlow email shell — cream background, white rounded card,
 * black type, green accent — matching the app's light UI.
 */
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#1EA850"><path d="M195-195q-35-35-35-85H60l18-80h113q17-19 40-29.5t49-10.5q26 0 49 10.5t40 29.5h167l84-360H182l4-17q6-28 27.5-45.5T264-800h456l-37 160h117l120 160-40 200h-80q0 50-35 85t-85 35q-50 0-85-35t-35-85H400q0 50-35 85t-85 35q-50 0-85-35Zm442-245h193l4-21-74-99h-95l-28 120Zm-19-273 2-7-84 360 2-7 34-146 46-200ZM20-427l20-80h220l-20 80H20Zm80-146 20-80h260l-20 80H100Zm180 333q17 0 28.5-11.5T320-280q0-17-11.5-28.5T280-320q-17 0-28.5 11.5T240-280q0 17 11.5 28.5T280-240Zm400 0q17 0 28.5-11.5T720-280q0-17-11.5-28.5T680-320q-17 0-28.5 11.5T640-280q0 17 11.5 28.5T680-240Z"/></svg>`;

const buildTemplate = ({
  eyebrow,
  heading,
  intro,
  detailsLabel,
  username,
  detailLine,
  badge,
  code,
  noteTitle,
  noteItems,
  noteTone = "default",
}) => {
  const noteColors =
    noteTone === "danger"
      ? { bg: "#fdf2f2", border: "#f3caca", title: "#b42318" }
      : { bg: "#ecf7ee", border: "#00b749ae", title: "#00b74a" };

  const noteListHtml = noteItems
    .map((item) => `<li style="margin:0 0 6px 0;">${item}</li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RideFlow - ${heading}</title>
  </head>
  <body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background-color:#faf8f2;">
    <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#faf8f2;">
      <tr>
        <td align="center" style="padding:48px 20px;">
          <table role="presentation" style="max-width:520px;width:100%;border-collapse:collapse;">

            <!-- Logo / brand -->
            <tr>
              <td style="padding-bottom:28px;text-align:center;">
                <table role="presentation" style="margin:0 auto;">
                  <tr>
                    <td style="padding-right:10px;">
                      <div style="width:38px;height:38px;border-radius:50%;background-color:#000000;display:flex;align-items:center;justify-content:center;">
                        <table role="presentation" style="width:100%;height:100%;"><tr><td align="center" valign="middle">${logoSvg}</td></tr></table>
                      </div>
                    </td>
                    <td>
                      <span style="font-size:20px;font-weight:700;color:#111111;letter-spacing:-0.2px;">RIDE-FLOW</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color:#ffffff;border-radius:20px;border:1px solid #ebebea;overflow:hidden;">
                <table role="presentation" style="width:100%;border-collapse:collapse;">

                  <tr>
                    <td style="padding:40px 40px 0 40px;text-align:center;">
                      <span style="display:inline-block;padding:6px 14px;border-radius:15px;background-color:#e5f0e6;border:0.8px solid #00b749ae;color:#00b74a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">
                        ${eyebrow}
                      </span>
                      <h1 style="margin:20px 0 10px 0;color:#111111;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
                        ${heading}
                      </h1>
                      <p style="margin:0 0 28px 0;color:#838380;font-size:15px;line-height:23px;">
                        ${intro}
                      </p>
                    </td>
                  </tr>

                  <!-- Account details -->
                  <tr>
                    <td style="padding:0 40px;">
                      <table role="presentation" style="width:100%;background-color:#f9f9f9;border-radius:16px;border:1px solid #d6d6d6;">
                        <tr>
                          <td style="padding:18px 22px;">
                            <p style="margin:0;color:#626262;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">
                              ${detailsLabel}
                            </p>
                            <p style="margin:8px 0 2px 0;color:#111111;font-size:17px;font-weight:700;">
                              ${username}
                            </p>
                            <p style="margin:0;color:#626262;font-size:14px;">
                              ${detailLine}
                            </p>
                            ${
                              badge
                                ? `<span style="display:inline-block;margin-top:12px;padding:4px 12px;background-color:#e5f0e6;border:0.8px solid #00b749ae;border-radius:15px;color:#00b74a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${badge}</span>`
                                : ""
                            }
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Code -->
                  <tr>
                    <td style="padding:28px 40px 0 40px;text-align:center;">
                      <table role="presentation" style="width:100%;">
                        <tr>
                          <td align="center">
                            <div style="display:inline-block;padding:22px 44px;background-color:#111111;border-radius:16px;">
                              <span style="font-size:36px;font-weight:700;color:#ffffff;letter-spacing:10px;font-family:'Courier New',monospace;">
                                ${code}
                              </span>
                            </div>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:16px 0 0 0;color:#9a9890;font-size:13px;">
                        This code expires in <strong style="color:#00b74a;">10 minutes</strong>
                      </p>
                    </td>
                  </tr>

                  <!-- Note -->
                  <tr>
                    <td style="padding:28px 40px 40px 40px;">
                      <table role="presentation" style="width:100%;background-color:${noteColors.bg};border:1px solid ${noteColors.border};border-radius:16px;">
                        <tr>
                          <td style="padding:20px 22px;">
                            <p style="margin:0 0 10px 0;color:${noteColors.title};font-size:14px;font-weight:700;">
                              ${noteTitle}
                            </p>
                            <ul style="margin:0;padding-left:18px;color:#626262;font-size:13px;line-height:21px;">
                              ${noteListHtml}
                            </ul>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:28px 20px 0 20px;text-align:center;">
                <p style="margin:0 0 10px 0;color:#9a9890;font-size:12px;line-height:18px;">
                  This email was sent from RideFlow. If you have any questions, contact our support team.
                </p>
                <p style="margin:0 0 14px 0;color:#c2c0b8;font-size:12px;">
                  © 2026 RideFlow. All rights reserved.
                </p>
                <span style="color:#9a9890;font-size:11px;">Help Center</span>
                <span style="color:#dedcd2;font-size:11px;"> &nbsp;|&nbsp; </span>
                <span style="color:#9a9890;font-size:11px;">Privacy Policy</span>
                <span style="color:#dedcd2;font-size:11px;"> &nbsp;|&nbsp; </span>
                <span style="color:#9a9890;font-size:11px;">Terms</span>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const sendEmail = async (email, code, username) => {
  const messageTemplate = buildTemplate({
    eyebrow: "Account Verification",
    heading: "Verify Your Account",
    intro: "Use the verification code below to complete your sign-in.",
    detailsLabel: "Account Details",
    username,
    detailLine: email,
    code,
    noteTitle: "🔒 Security Tips",
    noteItems: [
      "Never share this code with anyone",
      "RideFlow staff will never ask for this code",
      "If you didn't request this code, please ignore this email",
    ],
  });

  const mailOptions = {
    from: process.env.email,
    to: email,
    subject: "Your OTP Code",
    html: messageTemplate,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, text: "Mail sent" }; // Simplified return object
  } catch (error) {
    console.error("Nodemailer error: ", error);
    return { success: false, text: "Failed to send mail" };
  }
};

const sendForgotPasswordEmail = async (email, code, username) => {
  const messageTemplate = buildTemplate({
    eyebrow: "Password Reset Request",
    heading: "Reset Your Password",
    intro:
      "We received a request to reset your password. Use the code below to create a new one.",
    detailsLabel: "Account Details",
    username,
    detailLine: email,
    code,
    noteTitle: "⚠️ Didn't request this?",
    noteItems: [
      "Never share this code with anyone",
      "RideFlow will never ask for your password",
      "If you didn't request this, you can safely ignore this email",
    ],
    noteTone: "danger",
  });

  const mailOptions = {
    from: process.env.email,
    to: email,
    subject: "Your OTP Code",
    html: messageTemplate,
  };

  try {
    const sentEmail = await transporter.sendMail(mailOptions);
    if (sentEmail) {
      return { text: "Mail sent", status: "success" };
    }
  } catch (error) {
    console.log(error);
    return { text: "Failed to send mail", status: "fail" };
  }
};

const sendAdminEmail = async (email, code, username, role) => {
  const messageTemplate = buildTemplate({
    eyebrow: "Staff Portal",
    heading: "Verify Your Staff Account",
    intro: `A staff account request was submitted for the role of <strong style="color:#111111;">${role}</strong>. Use the code below to confirm this account.`,
    detailsLabel: "Staff Account Details",
    username,
    detailLine: email,
    badge: `Requested as ${role}`,
    code,
    noteTitle: "🔒 Security Tips",
    noteItems: [
      "Never share this code with anyone",
      "RideFlow staff will never ask for this code",
      "Staff-level access grants administrative privileges — confirm this request came from you",
      "If you didn't request this code, please ignore this email",
    ],
  });

  const mailOptions = {
    from: process.env.email,
    to: email,
    subject: "Your OTP Code",
    html: messageTemplate,
  };

  try {
    const sentEmail = await transporter.sendMail(mailOptions);
    if (sentEmail) {
      return { text: "Mail sent", status: "success" };
    }
  } catch (error) {
    console.log(error);
    return { text: "Failed to send mail", status: "fail" };
  }
};

const changeEmail = async (email, code, username) => {
  const messageTemplate = buildTemplate({
    eyebrow: "Account Details",
    heading: "Confirm Your New Email",
    intro:
      "We received a request to change the email address on your account. Enter the code below to confirm this change.",
    detailsLabel: "Account Details",
    username,
    detailLine: `New email: ${email}`,
    code,
    noteTitle: "⚠️ Didn't request this?",
    noteItems: [
      "Never share this code with anyone",
      "RideFlow staff will never ask for this code",
      "If you didn't request an email change, secure your account and contact support immediately",
    ],
    noteTone: "danger",
  });

  const mailOptions = {
    from: process.env.email,
    to: email,
    subject: "Your OTP Code",
    html: messageTemplate,
  };

  try {
    const sentEmail = await transporter.sendMail(mailOptions);
    if (sentEmail) {
      return { text: "Mail sent", status: "success" };
    }
  } catch (error) {
    console.log(error);
    return { text: "Failed to send mail", status: "fail" };
  }
};

const changePassword = async (email, code, username) => {
  const messageTemplate = buildTemplate({
    eyebrow: "Account Details",
    heading: "Confirm Password Change",
    intro:
      "We received a request to change the password on your account. Enter the code below to confirm this change.",
    detailsLabel: "Account Details",
    username,
    detailLine: email,
    code,
    noteTitle: "⚠️ Didn't request this?",
    noteItems: [
      "Never share this code with anyone",
      "RideFlow staff will never ask for this code",
      "If you didn't request a password change, secure your account and contact support immediately",
    ],
    noteTone: "danger",
  });

  const mailOptions = {
    from: process.env.email,
    to: email,
    subject: "Your OTP Code",
    html: messageTemplate,
  };

  try {
    const sentEmail = await transporter.sendMail(mailOptions);
    if (sentEmail) {
      return { text: "Mail sent", status: "success" };
    }
  } catch (error) {
    console.log(error);
    return { text: "Failed to send mail", status: "fail" };
  }
};

/**
 * sendNumberCode
 * Notifies the account holder that someone is attempting to change
 * their phone number, and gives them the confirmation code.
 */
const sendNumberCode = async (email, number, username, code) => {
  const messageTemplate = buildTemplate({
    eyebrow: "Account Details",
    heading: "Confirm Phone Number Change",
    intro:
      "Someone is trying to change the phone number linked to your account. Enter the code below to confirm this change.",
    detailsLabel: "Account Details",
    username,
    detailLine: `New number: ${number}`,
    code,
    noteTitle: "⚠️ Didn't request this?",
    noteItems: [
      "Never share this code with anyone",
      "RideFlow staff will never ask for this code",
      "If you didn't request a phone number change, secure your account and contact support immediately",
    ],
    noteTone: "danger",
  });

  const mailOptions = {
    from: process.env.email,
    to: email,
    subject: "Your OTP Code",
    html: messageTemplate,
  };

  try {
    const sentEmail = await transporter.sendMail(mailOptions);
    if (sentEmail) {
      return { text: "Mail sent", status: "success" };
    }
  } catch (error) {
    console.log(error);
    return { text: "Failed to send mail", status: "fail" };
  }
};

module.exports = {
  sendEmail,
  changePassword,
  changeEmail,
  sendAdminEmail,
  sendForgotPasswordEmail,
  sendNumberCode,
};
