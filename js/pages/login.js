import { loginAs, resendVerification } from "../auth.js";

const params = new URLSearchParams(location.search);
const alertBox = document.getElementById("loginAlert");
const form = document.getElementById("loginForm");
const emailLabel = document.getElementById("emailLabel");
let role = "student";

function showAlert(type, message) {
    alertBox.className = `alert alert-${type} rounded-0`;
    alertBox.textContent = message;
    alertBox.classList.remove("d-none");
}

if (params.get("verify") === "1") {
    const contact = sessionStorage.getItem("olistarVerifyEmail") || "your contact email";
    showAlert("info", `Check ${contact} for a verification link, then sign in again. Need another link? Click "Resend verification link" below.`);
}
if (params.get("reset") === "1") {
    showAlert("success", "If that account exists, a reset link was sent to the contact email on file.");
}

document.getElementById("roleTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-role]");
    if (!btn) return;
    role = btn.dataset.role;
    document.querySelectorAll("#roleTabs .nav-link").forEach((el) => el.classList.toggle("active", el === btn));
    emailLabel.textContent = role === "admin" ? "Admin email" : "Institutional login ID";
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.textContent = "Signing in...";
    alertBox.classList.add("d-none");
    try {
        await loginAs(role, document.getElementById("loginEmail").value, document.getElementById("loginPassword").value);
        window.location.replace("dashboard.html");
    } catch (err) {
        if (err.message === "pending-verification") {
            const dest = err.contactEmail ? `to ${err.contactEmail}` : "to your registered contact email";
            showAlert("warning", `Your email is not verified yet. A verification link was sent ${dest}. Please verify before signing in, or use "Resend verification link" below.`);
        } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
            showAlert("danger", "Invalid login ID or password. Please verify your details.");
        } else {
            showAlert("danger", err.message || "Login failed.");
        }
    } finally {
        btn.disabled = false;
        btn.textContent = "Sign in";
    }
});

// --- Resend Verification Link Modal Handling ---
const resendModalEl = document.getElementById("resendModal");
const openResendBtn = document.getElementById("openResendBtn");
const resendForm = document.getElementById("resendForm");
const resendAlert = document.getElementById("resendAlert");
const resendEmail = document.getElementById("resendEmail");
const resendPassword = document.getElementById("resendPassword");
const resendSubmitBtn = document.getElementById("resendSubmitBtn");

function showResendAlert(type, message) {
    if (!resendAlert) return;
    resendAlert.className = `alert alert-${type} rounded-0`;
    resendAlert.textContent = message;
    resendAlert.classList.remove("d-none");
}

if (openResendBtn && resendModalEl) {
    openResendBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (resendAlert) resendAlert.classList.add("d-none");
        if (resendPassword) resendPassword.value = "";
        const loginVal = document.getElementById("loginEmail")?.value?.trim();
        if (loginVal && resendEmail) {
            resendEmail.value = loginVal;
        }
        if (window.bootstrap?.Modal) {
            window.bootstrap.Modal.getOrCreateInstance(resendModalEl).show();
        }
    });
}

if (resendForm) {
    resendForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        resendSubmitBtn.disabled = true;
        resendSubmitBtn.textContent = "Sending...";
        resendAlert.classList.add("d-none");

        try {
            const result = await resendVerification(resendEmail.value, resendPassword.value);
            if (result.alreadyVerified) {
                showResendAlert("info", `Account associated with ${result.contactEmail} is already verified. You can proceed to sign in directly.`);
            } else {
                showResendAlert("success", `A fresh verification link has been sent to ${result.contactEmail}. Please check your inbox and spam folder.`);
                showAlert("success", `Verification email sent to ${result.contactEmail}. Check your inbox and sign in after confirming.`);
            }
        } catch (err) {
            if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
                showResendAlert("danger", "Incorrect password for this account. Please try again.");
            } else if (err.code === "auth/too-many-requests") {
                showResendAlert("warning", "Too many attempts. Please wait a few moments before trying again.");
            } else {
                showResendAlert("danger", err.message || "Failed to resend verification link.");
            }
        } finally {
            resendSubmitBtn.disabled = false;
            resendSubmitBtn.textContent = "Send Verification Link";
        }
    });
}

// --- Toggle Password Visibility ---
document.querySelectorAll(".toggle-password-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        const input = document.getElementById(targetId);
        if (!input) return;
        const icon = btn.querySelector("i");
        if (input.type === "password") {
            input.type = "text";
            if (icon) {
                icon.classList.remove("bi-eye");
                icon.classList.add("bi-eye-slash");
            }
            btn.setAttribute("title", "Hide Password");
        } else {
            input.type = "password";
            if (icon) {
                icon.classList.remove("bi-eye-slash");
                icon.classList.add("bi-eye");
            }
            btn.setAttribute("title", "Show Password");
        }
    });
});

