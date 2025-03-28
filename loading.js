function showLoading() {
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("loading");

    const loader = document.createElement("div");
    loader.classList.add("loader-circle");

    loadingDiv.appendChild(loader);
    document.body.appendChild(loadingDiv);
}

function hideLoading() {
    const loadingDiv = document.querySelector(".loading");
    if (loadingDiv) {
        loadingDiv.remove();
    }
}
