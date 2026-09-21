import { sendResetToContactEmail } from "../provision-auth.js";

const form = document.getElementById("resetForm");
const alertBox = document.getElementById("resetAlert");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const identifier = document.getElementById("resetEmail").value.trim().toLowerCase();
    try {
        const response = await fetch("api/resolve-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier })
        });
        const profile = await response.json();
        if (!response.ok || !profile.authEmail) throw new Error("No student or staff account found for that login ID.");
        if (profile.role === "admin") throw new Error("Administrators reset passwords from the Firebase console.");
        await sendResetToContactEmail(profile.authEmail);
        window.location.replace("login.html?reset=1");
    } catch (err) {
        alertBox.className = "alert alert-danger rounded-0";
        alertBox.textContent = err.message;
        alertBox.classList.remove("d-none");
    }
});
