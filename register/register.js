firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    window.location.href = "/dashboard/index.html";
  }
});

function onChangeNome() {
  const nome = form.nome().value;
  form.nomeRequiredError().style.display = !nome ? "block" : "none";

  toggleRegisterButtonDisable();
}

function onChangeEmail() {
  const email = form.email().value;
  form.emailRequiredError().style.display = !email ? "block" : "none";
  form.emailInvalidError().style.display = email && !validateEmail(email) ? "block" : "none";

  toggleRegisterButtonDisable();
}

function onChangePassword() {
  const password = form.password().value;
  form.passwordRequiredError().style.display = !password ? "block" : "none";
  form.passwordMinLengthError().style.display =
    password.length >= 6 ? "none" : "block";

  validatePasswordMatch();
  toggleRegisterButtonDisable();
}

function onChangeConfirmPassword() {
  validatePasswordMatch();
  toggleRegisterButtonDisable();
}

function register() {
  showLoading();

  const nome = form.nome().value;
  const email = form.email().value;
  const password = form.password().value;

  firebase
  .auth()
  .createUserWithEmailAndPassword(email, password)
  .then((userCredential) => {
    const user = userCredential.user;

    return user.updateProfile({
      displayName: nome,
    }).then(() => {
      console.log("Nome salvo no perfil.");
      return firebase.auth().currentUser; // Garantir que o perfil esteja atualizado
    });
  })
  .then((updatedUser) => {
    console.log("Nome atualizado:", updatedUser.displayName);
    hideLoading();
    window.location.href = "/dashboard/index.html";
  })
  .catch((error) => {
    hideLoading();
    console.error("Erro ao registrar usuário:", error);
    showAlert('Erro ao registrar usuário: ' + error.message, 'error');
  });

}


function getErrorMessage(error) {
  if (error.code == "auth/email-already-in-use") {
    return "Email já cadastrado";
  }
  return error.message;
}

function validatePasswordMatch() {
  const password = form.password().value;
  const confirmPassword = form.confirmPassword().value;

  form.passwordDowsntMatchError().style.display =
    password == confirmPassword ? "none" : "block";
}

function toggleRegisterButtonDisable() {
  form.registerButton().disabled = !isFormValid();
}

function login() {
  window.location.href = "/index.html";
}

function isFormValid() {
  const nome = form.nome().value;
  if (!nome) {
    return false;
  }
  const email = form.email().value;
  if (!email || !validateEmail(email)) {
    return false;
  }
  const password = form.password().value;
  if (!password || password.length < 6) {
    return false;
  }
  const confirmPassword = form.confirmPassword().value;
  if (password != confirmPassword) {
    return false;
  }

  return true;
}

function showAlert(message, type = 'success') {
  const alertContainer = document.getElementById('alert-container');
  const alert = document.createElement('div');

  // Classes base
  let baseClasses =
    'flex items-center px-4 py-3 rounded shadow-md transition-opacity duration-300';
    
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
  alert.querySelector('button').addEventListener('click', () => {
    alert.remove();
  });

  setTimeout(() => {
    alert.remove();
  }, 3000);

  alertContainer.appendChild(alert);
}

const form = {
  nome: () => document.getElementById("nome"),
  nomeRequiredError: () => document.getElementById("nome-required-error"),
  email: () => document.getElementById("email"),
  emailInvalidError: () => document.getElementById("email-invalid-error"),
  emailRequiredError: () => document.getElementById("email-required-error"),
  confirmPassword: () => document.getElementById("confirmPassword"),
  passwordDowsntMatchError: () => document.getElementById("password-dowsnt-match-error"),
  password: () => document.getElementById("password"),
  passwordRequiredError: () => document.getElementById("password-required-error"),
  passwordMinLengthError: () => document.getElementById("password-min-length-error"),
  registerButton: () => document.getElementById("register-button"),
};
 