
function requireLogin() {
    if (!isLoggedIn()) {
        window.location.href = "../login.html";
        return false;
    }

    return true;
}

function requireAdmin() {
    const user = getCurrentUser();

    if (!user || user.role !== "admin") {
        alert("Access denied. Admin permission required.");
        window.location.href = "../pages/dashboard.html";
        return false;
    }

    return true;
}

function showAdminControls() {
    const user = getCurrentUser();

    if (user && user.role === "admin") {
        $(".admin-only").removeClass("hidden");
    } else {
        $(".admin-only").addClass("hidden");
    }
}
