const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.email,
    pass: process.env.password,
  },
});

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="26px" viewBox="0 -960 960 960" width="26px" fill="#ffffff"><path d="M155-195q-35-35-35-85H40v-440q0-33 23.5-56.5T120-800h560v160h120l120 160v200h-80q0 50-35 85t-85 35q-50 0-85-35t-35-85H360q0 50-35 85t-85 35q-50 0-85-35Zm113.5-56.5Q280-263 280-280t-11.5-28.5Q257-320 240-320t-28.5 11.5Q200-297 200-280t11.5 28.5Q223-240 240-240t28.5-11.5ZM120-360h32q17-18 39-29t49-11q27 0 49 11t39 29h272v-360H120v360Zm628.5 108.5Q760-263 760-280t-11.5-28.5Q737-320 720-320t-28.5 11.5Q680-297 680-280t11.5 28.5Q703-240 720-240t28.5-11.5ZM680-440h170l-90-120h-80v120ZM360-540Z"/></svg>`;

/**
 * Shared RideFlow email shell — cream background, white rounded card,
 * black type, green accent — matching the app's light UI.
 */
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
      : { bg: "#f0fdf4", border: "#bbf0cf", title: "#15803d" };

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
                      <div style="width:38px;height:38px;border-radius:10px;background-color:#111111;display:flex;align-items:center;justify-content:center;">
                        <table role="presentation" style="width:100%;height:100%;"><tr><td align="center" valign="middle">${logoSvg}</td></tr></table>
                      </div>
                    </td>
                    <td>
                      <span style="font-size:20px;font-weight:800;color:#111111;letter-spacing:-0.3px;">RideFlow</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color:#ffffff;border-radius:24px;border:1px solid #eeece3;overflow:hidden;">
                <table role="presentation" style="width:100%;border-collapse:collapse;">

                  <tr>
                    <td style="padding:40px 40px 0 40px;text-align:center;">
                      <span style="display:inline-block;padding:6px 14px;border-radius:20px;background-color:#eafcef;color:#16a34a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">
                        ${eyebrow}
                      </span>
                      <h1 style="margin:20px 0 10px 0;color:#111111;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
                        ${heading}
                      </h1>
                      <p style="margin:0 0 28px 0;color:#6b6b6b;font-size:15px;line-height:23px;">
                        ${intro}
                      </p>
                    </td>
                  </tr>

                  <!-- Account details -->
                  <tr>
                    <td style="padding:0 40px;">
                      <table role="presentation" style="width:100%;background-color:#faf8f2;border-radius:16px;border:1px solid #f0eee5;">
                        <tr>
                          <td style="padding:18px 22px;">
                            <p style="margin:0;color:#9a9890;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">
                              ${detailsLabel}
                            </p>
                            <p style="margin:8px 0 2px 0;color:#111111;font-size:17px;font-weight:700;">
                              ${username}
                            </p>
                            <p style="margin:0;color:#6b6b6b;font-size:14px;">
                              ${detailLine}
                            </p>
                            ${
                              badge
                                ? `<span style="display:inline-block;margin-top:12px;padding:4px 12px;background-color:#eafcef;border:1px solid #bbf0cf;border-radius:20px;color:#16a34a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${badge}</span>`
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
                              <span style="font-size:36px;font-weight:800;color:#ffffff;letter-spacing:10px;font-family:'Courier New',monospace;">
                                ${code}
                              </span>
                            </div>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:16px 0 0 0;color:#9a9890;font-size:13px;">
                        This code expires in <strong style="color:#16a34a;">10 minutes</strong>
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
                            <ul style="margin:0;padding-left:18px;color:#6b6b6b;font-size:13px;line-height:21px;">
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
