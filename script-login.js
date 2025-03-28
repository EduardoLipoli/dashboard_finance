firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    window.location.href = "/dashboard/index.html";
  } else {
    // Se o usuário não estiver logado, verificar se ele deixou o checkbox de "lembrar-me" marcado
    const rememberMe = localStorage.getItem("rememberMe") === "true";
    document.querySelector(".checkbox-login").checked = rememberMe;
  }
});

function onChangeEmail() {
  toggleButtonDisable();
  toggleEmailErrors();
}

function onChangePassword() {
  toggleButtonDisable();
  togglePasswordErrors();
}

function login() {
  showLoading();

  const rememberMe = document.querySelector(".checkbox-login").checked;
  // Armazenar a preferência de "lembrar-me" no localStorage
  localStorage.setItem("rememberMe", rememberMe);

  const persistence = rememberMe
    ? firebase.auth.Auth.Persistence.LOCAL
    : firebase.auth.Auth.Persistence.SESSION;

  firebase
    .auth()
    .setPersistence(persistence)
    .then(() => {
      return firebase
        .auth()
        .signInWithEmailAndPassword(form.email().value, form.password().value);
    })
    .then((response) => {
      hideLoading();
      window.location.href = "/dashboard/index.html";
    })
    .catch((error) => {
      hideLoading();
      showAlert('Usuário não encontrado!', 'error');
    });
}

function getErrorMessage(error) {
  if (error.code == "auth/invalid-login-credentials") {
    return showAlert('Usuário não encontrado!', 'error');
  }
  if (error.code == "auth/wrong-password") {
    return showAlert('Senha Inválida ', 'error');
  }
  return error.message;
}

function register() {
  window.location.href = "/register/register.html";
}

function recoverPassword() {
  showLoading();
  firebase
    .auth()
    .sendPasswordResetEmail(form.email().value)
    .then(() => {
      hideLoading();
      showAlert('Email enviado com sucesso!', 'success');
    })
    .catch((error) => {
      hideLoading();
      showAlert('Erro: ' + error.message, 'error');
    });
}

function isEmailValid() {
  const email = form.email().value;
  if (!email) {
    return false;
  }
  return validateEmail(email);
}

function toggleEmailErrors() {
  const email = form.email().value;
  form.emailRequiredError().style.display = !email ? "block" : "none";
  form.emailInvalidError().style.display =
    email && !validateEmail(email) ? "block" : "none";
}

function togglePasswordErrors() {
  const password = form.password().value;
  form.passwordRequiredError().style.display = password ? "none" : "block";
}

function toggleButtonDisable() {
  const emailValid = isEmailValid();
  form.recoverPasswordButton().disabled = !emailValid;

  const passwordValid = isPasswordValid();
  form.loginButton().disabled = !emailValid || !passwordValid;
}

function isPasswordValid() {
  const password = form.password().value;
  if (!password) {
    return false;
  }
  return true;
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    const loginButton = document.getElementById("login-button");
    if (!loginButton.disabled) {
      login();
    }
  }
});

function showAlert(message, type = "success") {
  const alertContainer = document.getElementById("alert-container");
  const alert = document.createElement("div");

  // Classes base
  let baseClasses =
    "flex items-center px-4 py-3 rounded shadow-md transition-opacity duration-300";

  // Classes por tipo
  let typeClasses = "";
  if (type === "success") {
    typeClasses = "bg-green-500 text-white hover:bg-green-600 transition-colors cursor-default select-none";
  } else if (type === "error") {
    typeClasses = "bg-red-500 text-white hover:bg-red-600 transition-colors cursor-default select-none";
  } else if (type === "info") {
    typeClasses = "bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-default select-none";
  } else if (type === "warning") {
    typeClasses = "bg-yellow-500 text-black hover:bg-yellow-600 transition-colors cursor-default select-none";
  }

  alert.className = `${baseClasses} ${typeClasses}`;
  alert.innerHTML = `
      <span class="flex-grow">${message}</span>
      <button class="ml-4 text-lg font-bold focus:outline-none">&times;</button>
    `;

  // Remover alerta ao clicar no botão ou após 5 segundos
  alert.querySelector("button").addEventListener("click", () => {
    alert.remove();
  });

  setTimeout(() => {
    alert.remove();
  }, 3000);

  alertContainer.appendChild(alert);
}

const form = {
  email: () => document.getElementById("email"),
  emailInvalidError: () => document.getElementById("email-invalid-error"),
  emailRequiredError: () => document.getElementById("email-required-error"),
  loginButton: () => document.getElementById("login-button"),
  password: () => document.getElementById("password"),
  passwordRequiredError: () =>
    document.getElementById("password-required-error"),
  recoverPasswordButton: () => document.getElementById("recover-button"),
};
