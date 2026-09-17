import { findUsersByInstitutionalEmail, findUserByContactEmail } from "../store.js";
import { sendResetToContactEmail } from "../provision-auth.js";

const form = document.getElementById("resetForm");
const alertBox = document.getElementById("resetAlert");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const identifier = document.getElementById("resetEmail").value.trim().toLowerCase();
    try {
        let matches = await findUsersByInstitutionalEmail(identifier);
        if (!matches.length) matches = await findUserByContactEmail(identifier);
        if (!matches.length) throw new Error("No student or staff account found for that login ID.");
        const profile = matches[0];
        if (profile.role === "admin") throw new Error("Administrators reset passwords from the Firebase console.");
        await sendResetToContactEmail(profile.contactEmail);
        window.location.replace("login.html?reset=1");
    } catch (err) {
        alertBox.className = "alert alert-danger rounded-0";
        alertBox.textContent = err.message;
        alertBox.classList.remove("d-none");
    }
});
