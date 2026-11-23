
const API_BASE_URL = "http://localhost:4000/api";

function getToken() {
    return sessionStorage.getItem("token");
}

function apiRequest(endpoint, method = "GET", data = null) {
    const token = getToken();

    const headers = {};

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers
    };

    if (data instanceof FormData) {
        options.body = data;
    } else if (data !== null) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(data);
    }

    return $.ajax({
        url: `${API_BASE_URL}${endpoint}`,
        ...options
    }).catch(function (xhr) {
        if (xhr.status === 401) {
            sessionStorage.clear();
            window.location.href = "../login.html";
        }

        const message =
            xhr.responseJSON?.message ||
            "Something went wrong. Please try again.";

        console.error("API Error:", message);

        throw new Error(message);
    });
}
