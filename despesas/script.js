const form = document.getElementById("dataForm");
const tableBody = document.getElementById("tableBody");
let transactions = [];
let categoryMap = {};
const auth = firebase.auth();

document.addEventListener("DOMContentLoaded", function () {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        await user.reload();

        const userPhoto = document.getElementById("user-photo");
        const photoURL = user.photoURL;
        const userEmail = document.getElementById("user-email");

        const email = user.email || "E-mail não disponível";

        userEmail.textContent = email;

        if (photoURL && userPhoto) {
          userPhoto.src = photoURL;
          userPhoto.classList.remove("hidden");
        } else if (userPhoto) {
          userPhoto.classList.add("hidden");
        }

        loadUserName(user);
        loadTransactionsFromFirestore();
        
      } catch (error) {
        console.error("Erro ao atualizar dados do usuário:", error);
      }
    } else {
      console.error("Usuário não autenticado.");
      window.location.href = "/index.html";
    }
  });
});


// Função para salvar uma transação no Firestore
function saveTransactionToFirestore(transaction) {
  showLoading();
  const user = firebase.auth().currentUser;

  if (user) {
    const db = firebase.firestore();
    const userRef = db.collection("users").doc(user.uid);
    const transactionRef = userRef
      .collection("transactions")
      .doc(transaction.id);

    transactionRef
      .set(transaction)
      .then(() => {
        hideLoading();
      })
      .catch((error) => {
        hideLoading();
        console.error("Erro ao salvar a transação no Firestore:", error);
      });
  } else {
    console.error(
      "Usuário não autenticado. Não é possível salvar no Firestore."
    );
  }
}

function loadCategoriesForTransaction() {
  const user = firebase.auth().currentUser;

  if (!user) {
    console.error("Usuário não autenticado.");
    return;
  }

  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid).collection("categories");

  userRef
    .get()
    .then((querySnapshot) => {
      const categorySelect = document.getElementById("categorySelect");
      categorySelect.innerHTML = "";

      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Selecione a categoria";
      categorySelect.appendChild(defaultOption);

      categoryMap = {}; // Limpa o objeto antes de carregar novamente

      querySnapshot.forEach((doc) => {
        const categoryId = doc.id;
        const categoryName = doc.data().name;

        categoryMap[categoryId] = categoryName; // Armazena no objeto

        const option = document.createElement("option");
        option.value = categoryId;
        option.textContent = categoryName;
        categorySelect.appendChild(option);
      });

      // Após carregar as categorias, atualizar a exibição das transações
      displayTransactionsForCurrentMonth();
    })
    .catch((error) => {
      console.error("Erro ao carregar categorias para transação:", error);
    });
}

function loadTransactionsFromFirestore() {
  showLoading();
  const user = firebase.auth().currentUser;

  if (!user) {
    hideLoading();
    console.error("Usuário não autenticado!");
    return;
  }

  const userId = user.uid;
  const transactionsRef = firebase
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("transactions");

  transactionsRef
    .get()
    .then((querySnapshot) => {
      hideLoading();
      transactions = [];
      querySnapshot.forEach((doc) => {
        const transaction = doc.data();
        transaction.dueDate = transaction.dueDate.toDate();
        transaction.addedOn = transaction.addedOn.toDate();
        transactions.push(transaction);
      });
      displayTransactionsForCurrentMonth();
    })
    .catch((error) => {
      hideLoading();
      console.error("Erro ao carregar transações do Firestore:", error);
    });
}

form.addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const amount = parseFloat(
    document.getElementById("amount").value.replace(",", ".")
  );
  const type = document.getElementById("type").value;
  const category = document.getElementById("categorySelect").value;
  const datepay = document.getElementById("datepay").value;
  const dueDateInput = document.getElementById("dueDate").value;
  const [year, month, day] = dueDateInput.split("-").map(Number);
  const dueDate = new Date(year, month - 1, day);
  const isFixed = document.getElementById("fixed").checked;
  const installments = isFixed
    ? 0
    : parseInt(document.getElementById("installments").value);

  const transaction = {
    id:
      currentEditIndex !== null
        ? transactions[currentEditIndex].id
        : Date.now().toString(),
    name,
    amount,
    type,
    category,
    dueDate,
    datepay,
    isFixed,
    installments,
    addedOn: new Date(),
    isPaid:
      currentEditIndex !== null ? transactions[currentEditIndex].isPaid : false,
  };

  if (currentEditIndex !== null) {
    transactions[currentEditIndex] = transaction;
    currentEditIndex = null;
  } else {
    transactions.push(transaction);

    if (isFixed) {
      replicateFixedTransaction(transaction);
    } else if (installments >= 1) {
      replicateInstallments(transaction);
    }
  }

  saveTransactionToFirestore(transaction);

  displayTransactionsForCurrentMonth();
  form.reset();
  closeFormSidebar();
});

// Função para replicar transações fixas
function replicateFixedTransaction(transaction) {
  showLoading();
  const user = firebase.auth().currentUser;
  if (!user) {
    console.error(
      "Usuário não autenticado. Não é possível replicar transações fixas no Firestore."
    );
    return;
  }

  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid);
  const batch = db.batch();

  const currentMonth = transaction.dueDate.getMonth();
  const currentYear = transaction.dueDate.getFullYear();
  const monthsRemaining = 11 - currentMonth;

  for (let i = 1; i <= monthsRemaining; i++) {
    const replicatedTransaction = { ...transaction };
    replicatedTransaction.id = `${transaction.id}-${i}`;
    replicatedTransaction.dueDate = new Date(transaction.dueDate);
    replicatedTransaction.dueDate.setMonth(
      replicatedTransaction.dueDate.getMonth() + i
    );

    if (replicatedTransaction.dueDate.getFullYear() > currentYear) {
      break;
    }

    const docRef = userRef
      .collection("transactions")
      .doc(replicatedTransaction.id);
    batch.set(docRef, replicatedTransaction);
    transactions.push(replicatedTransaction);
  }

  batch
    .commit()
    .then(() => {
      hideLoading();
      displayTransactionsForCurrentMonth();
    })
    .catch((error) => {
      hideLoading();
      console.error("Erro ao replicar transações fixas no Firestore:", error);
    });
}

// Função para replicar transações parceladas
function replicateInstallments(transaction) {
  const user = firebase.auth().currentUser;
  if (!user) {
    console.error(
      "Usuário não autenticado. Não é possível replicar transações parceladas no Firestore."
    );
    return;
  }

  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid);
  const batch = db.batch();

  for (let i = 1; i < transaction.installments; i++) {
    const replicatedTransaction = { ...transaction };
    replicatedTransaction.id = `${transaction.id}-${i}`;
    replicatedTransaction.dueDate = new Date(transaction.dueDate);
    replicatedTransaction.dueDate.setMonth(transaction.dueDate.getMonth() + i);

    const docRef = userRef
      .collection("transactions")
      .doc(replicatedTransaction.id);
    batch.set(docRef, replicatedTransaction);
    transactions.push(replicatedTransaction);
  }

  batch
    .commit()
    .then(() => {
      console.log("Transações parceladas replicadas com sucesso no Firestore.");
      displayTransactionsForCurrentMonth();
    })
    .catch((error) => {
      console.error(
        "Erro ao replicar transações parceladas no Firestore:",
        error
      );
    });
}

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
const monthNavigator = document.querySelector("span.text-lg.font-semibold");

function updateMonthDisplay() {
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  monthNavigator.textContent = `${months[currentMonth]} ${currentYear}`;
}

document.querySelector(".fa-chevron-left").addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  updateMonthDisplay();
  displayTransactionsForCurrentMonth();
});

document.querySelector(".fa-chevron-right").addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  updateMonthDisplay();
  displayTransactionsForCurrentMonth();
});

updateMonthDisplay();

// Filtrar apenas "Gasto" ao buscar transações vencidas
function getOverdueTransactions() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueTransactions = transactions.filter((transaction) => {
    const dueDate = new Date(transaction.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return (
      transaction.type === "Gasto" && dueDate < today && !transaction.isPaid
    );
  });
  return overdueTransactions;
}

function showOverduePopup() {
  const overdueTransactions = getOverdueTransactions();

  if (overdueTransactions.length === 0) return;

  // Cria o container do pop-up
  const popup = document.createElement("div");
  popup.className =
    "fixed bottom-4 right-4 bg-zinc-800 text-white p-6 rounded-2xl shadow-lg w-[25%] max-w-md animate-slide-up flex flex-col space-y-4";

  popup.innerHTML = `
    <div class="flex justify-between items-center w-full">
      <p class="font-bold text-lg">Você está com dívidas atrasadas!</p>
      <button class="text-white bg-transparent hover:text-red-500 focus:outline-none text-2xl" onclick="closePopup(this)">&times;</button>
    </div>
    <ul id="overdueList" class="mt-2 space-y-2 text-left"></ul>
    <div class="flex justify-center">
      <button class="mt-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm shadow-md" onclick="closePopup(this)">Entendi</button>
    </div>
  `;

  // Adiciona animação de subida
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideUp {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }

    .animate-slide-up {
      animation: slideUp 0.5s ease-out;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(popup);

  // Lista de dívidas
  const overdueList = document.getElementById("overdueList");

  overdueTransactions.forEach((transaction) => {
    const listItem = document.createElement("li");
    listItem.className =
      "bg-zinc-700 p-3 rounded-lg shadow-md cursor-pointer hover:bg-zinc-600 transition duration-200";

    listItem.innerHTML = `
      <div class="flex justify-between items-center">
        <div>
          <p class="font-semibold text-white text-sm">${transaction.name}</p>
          <p class="text-xs text-gray-300">Vencimento: ${new Date(
            transaction.dueDate
          ).toLocaleDateString("pt-BR")}</p>
        </div>
        <p class="font-bold text-red-500">${new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(transaction.amount)}</p>
      </div>
    `;

    listItem.addEventListener("click", () => {
      navigateToTransactionMonth(transaction);
    });

    overdueList.appendChild(listItem);
  });
}

// Função para fechar o popup
function closePopup(button) {
  button.closest("div").parentElement.remove();
}

function navigateToTransactionMonth(transaction) {
  const dueDate = new Date(transaction.dueDate);
  currentMonth = dueDate.getMonth();
  currentYear = dueDate.getFullYear();
  updateMonthDisplay();
  displayTransactionsForCurrentMonth();
}

function capitalizeName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function displayTransactionsForCurrentMonth() {
  const filterDatepay = document.getElementById("filterDatepay").value;
  tableBody.innerHTML = "";

  transactions.forEach((transaction, index) => {
    const transactionMonth = transaction.dueDate.getMonth();
    const transactionYear = transaction.dueDate.getFullYear();

    if (transaction.type === "Gasto") {
      if (
        transactionMonth === currentMonth &&
        transactionYear === currentYear &&
        (filterDatepay === "" || transaction.datepay === filterDatepay)
      ) {
        const formattedName = capitalizeName(transaction.name);
        const formattedAmount = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
          minimumFractionDigits: 2,
        }).format(transaction.amount);

        const categoryName = categoryMap[transaction.category] || "Categoria desconhecida";

        const row = document.createElement("tr");
        row.classList.add("border-b", "border-zinc-700");
        row.classList.toggle("is-Paid", transaction.isPaid);

        row.innerHTML = `
                <td class="py-3 px-6">${formattedName}</td>
                <td class="py-3 px-6">
                    <span class="px-2 py-1 rounded-full text-sm ${
                      transaction.type === "Ganho"
                        ? `bg-green-800 bg-opacity-25 text-green-500 ${
                            transaction.isPaid ? "text-opacity-50" : ""
                          }`
                        : `bg-red-900 bg-opacity-25 text-red-500 ${
                            transaction.isPaid ? "text-opacity-50" : ""
                          }`
                    }">${transaction.type}</span>
                </td>
                <td class="py-3 px-6">${categoryName}</td>
                <td class="py-3 px-6">${transaction.dueDate.toLocaleDateString(
                  "pt-BR",
                  { day: "2-digit", month: "2-digit", year: "numeric" }
                )}</td>
                <td class="py-3 px-6">Dia ${transaction.datepay}</td>
                <td class="py-3 px-6">${formattedAmount}</td>
                <td class="py-3 px-6">${
                  transaction.isFixed ? "Fixa" : `${transaction.installments}x`
                }</td>
                <td class="py-3 px-6">
                    <button class="text-zinc-500 hover:text-zinc-700" onclick="editTransaction(${index})">
                        <i class="fa-regular fa-pen-to-square"></i>
                    </button>
                    <button class="text-red-500 hover:text-red-700 ml-2 remove-btn" onclick="openDeleteModal(${index})">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </td>
            `;

        row.addEventListener("click", (event) => {
          toggleTransactionPaid(index, event);
        });

        tableBody.appendChild(row);
      }
    }
  });

  if (tableBody.innerHTML === "") {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="8" class="text-center py-4">Nenhuma transação encontrada para este mês.</td>`;
    tableBody.appendChild(emptyRow);
  }

  const valorDia01Element = document.getElementById("valor-dia-01");
  const valorDia15Element = document.getElementById("valor-dia-15");
  const qtdDia01Element = document.getElementById("quantidade-dia-01");
  const qtdDia15Element = document.getElementById("quantidade-dia-15");
  
  if (valorDia01Element && valorDia15Element) {
    let totalDia01 = 0;
    let totalDia15 = 0;
    let countDia01 = 0;
    let countDia15 = 0;
  
    transactions.forEach(transaction => {
      const transactionMonth = transaction.dueDate.getMonth();
      const transactionYear = transaction.dueDate.getFullYear();
  
      if (
        transaction.type === "Gasto" &&
        transactionMonth === currentMonth &&
        transactionYear === currentYear &&
        !transaction.isPaid
      ) {
        if (transaction.datepay === "01") {
          totalDia01 += transaction.amount;
          countDia01++;
        } else if (transaction.datepay === "15") {
          totalDia15 += transaction.amount;
          countDia15++;
        }
      }
    });
  
    // Animação de contagem dos valores dos cards
    const valorAtual01 = parseFloat(valorDia01Element.textContent.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
    const valorAtual15 = parseFloat(valorDia15Element.textContent.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;

    animateValue(valorDia01Element, valorAtual01, totalDia01, 800);
    animateValue(valorDia15Element, valorAtual15, totalDia15, 800);

  
    qtdDia01Element.textContent = `${countDia01} despesa${countDia01 === 1 ? "" : "s"}`;
    qtdDia15Element.textContent = `${countDia15} despesa${countDia15 === 1 ? "" : "s"}`;
  }  

  function animateValue(element, start, end, duration) {
    const range = end - start;
    let startTimestamp = null;
  
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const value = start + range * progress;
  
      element.textContent = value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
  
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
  
    window.requestAnimationFrame(step);
  }
  

}

let ordenacaoAtual = { campo: null, asc: true };

function ordenarTabela(campo) {
  if (ordenacaoAtual.campo === campo) {
    ordenacaoAtual.asc = !ordenacaoAtual.asc;
  } else {
    ordenacaoAtual = { campo, asc: true };
  }

  transactions.sort((a, b) => {
    let valA = a[campo];
    let valB = b[campo];

    // Se for nome ou categoria, compara como texto
    if (campo === "name" || campo === "category") {
      valA = (valA || "").toString().toLowerCase();
      valB = (valB || "").toString().toLowerCase();
    }

    // Se for amount ou datepay, compara como número
    if (campo === "amount" || campo === "datepay") {
      valA = Number(valA);
      valB = Number(valB);
    }

    // Se for dueDate (objeto Date), transforma em timestamp
    if (campo === "dueDate") {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    }

    if (valA < valB) return ordenacaoAtual.asc ? -1 : 1;
    if (valA > valB) return ordenacaoAtual.asc ? 1 : -1;
    return 0;
  });

  displayTransactionsForCurrentMonth();
}


function toggleTransactionPaid(index, event) {
  const transaction = transactions[index];

  if (!transaction || !transaction.id) {
    console.error("Transação não encontrada ou ID ausente.");
    return;
  }

  if (event.target.closest("button")) {
    return;
  }

  transaction.isPaid = !transaction.isPaid;
  saveTransactionToFirestore(transaction);
  displayTransactionsForCurrentMonth();
}

document.getElementById("filterDatepay").addEventListener("change", () => {
  displayTransactionsForCurrentMonth();
});

const singleRadio = document.getElementById("single");
const fixedRadio = document.getElementById("fixed");
const parcelRadio = document.getElementById("parcel");
const installmentsContainer = document.getElementById("installmentsContainer");

function toggleInstallmentsInput() {
  if (parcelRadio.checked) {
    installmentsContainer.classList.remove("hidden");
  } else {
    installmentsContainer.classList.add("hidden");
  }
}

singleRadio.addEventListener("change", toggleInstallmentsInput);
fixedRadio.addEventListener("change", toggleInstallmentsInput);
parcelRadio.addEventListener("change", toggleInstallmentsInput);

toggleInstallmentsInput();

function openDeleteModal(index) {
  const modal = document.getElementById("deleteModal");
  const closeModalButton = document.getElementById("closeModalButton");
  modal.classList.remove("hidden");

  const deleteCurrentMonth = document.getElementById("deleteCurrentMonth");
  deleteCurrentMonth.onclick = () => {
    deleteTransactionForCurrentMonth(index);
    closeModal();
  };

  const deleteAllMonths = document.getElementById("deleteAllMonths");
  deleteAllMonths.onclick = () => {
    deleteTransactionForAllMonths(index);
    closeModal();
  };

  closeModalButton.onclick = () => {
    closeModal();
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      closeModal();
    }
  };
}

function closeModal() {
  const modal = document.getElementById("deleteModal");
  modal.classList.add("hidden");
}

function deleteTransactionForCurrentMonth(index) {
  showLoading();
  const transactionToRemove = transactions[index];
  const user = firebase.auth().currentUser;

  if (!user) {
    console.error(
      "Usuário não autenticado. Não é possível excluir transações."
    );
    return;
  }

  const db = firebase.firestore();
  const transactionRef = db
    .collection("users")
    .doc(user.uid)
    .collection("transactions")
    .doc(transactionToRemove.id);

  transactionRef
    .delete()
    .then(() => {
      hideLoading();
      transactions.splice(index, 1);
      displayTransactionsForCurrentMonth();
    })
    .catch((error) => {
      hideLoading();
      console.error("Erro ao excluir transação do Firestore:", error);
    });
}

function deleteTransactionForAllMonths(index) {
  showLoading();
  const transactionToRemove = transactions[index];
  const transactionSignature = `${transactionToRemove.name}_${transactionToRemove.amount}_${transactionToRemove.type}_${transactionToRemove.category}`;
  const user = firebase.auth().currentUser;

  if (!user) {
    console.error(
      "Usuário não autenticado. Não é possível excluir transações."
    );
    return;
  }

  const db = firebase.firestore();
  const transactionsRef = db
    .collection("users")
    .doc(user.uid)
    .collection("transactions");

  // Procurar e excluir todas as transações com a mesma assinatura
  transactionsRef
    .where("name", "==", transactionToRemove.name)
    .where("amount", "==", transactionToRemove.amount)
    .where("type", "==", transactionToRemove.type)
    .where("category", "==", transactionToRemove.category)
    .get()
    .then((querySnapshot) => {
      const batch = db.batch();
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      return batch.commit();
    })
    .then(() => {
      hideLoading();
      transactions = transactions.filter(
        (transaction) =>
          `${transaction.name}_${transaction.amount}_${transaction.type}_${transaction.category}` !==
          transactionSignature
      );
      displayTransactionsForCurrentMonth();
    })
    .catch((error) => {
      hideLoading();
      console.error("Erro ao excluir transações do Firestore:", error);
    });
}

function openFormSidebar() {
  const formSidebar = document.getElementById("formSidebar");
  const overlay = document.getElementById("overlay");

  formSidebar.classList.remove("form-closed");
  formSidebar.classList.add("form-open");

  overlay.classList.remove("hidden");
}

function closeFormSidebar() {
  const formSidebar = document.getElementById("formSidebar");
  const overlay = document.getElementById("overlay");

  formSidebar.classList.remove("form-open");
  formSidebar.classList.add("form-closed");

  overlay.classList.add("hidden");
  document.getElementById("save-button").disabled = true;
}

let currentEditIndex = null; // Índice da transação que está sendo editada

function editTransaction(index) {
  const transaction = transactions[index];
  currentEditIndex = index;

  document.getElementById("name").value = transaction.name;
  document.getElementById("amount").value = transaction.amount
    .toString()
    .replace(".", ",");
  document.getElementById("type").value = transaction.type;
  document.getElementById("categorySelect").value = transaction.category;
  document.getElementById("datepay").value = transaction.datepay;
  document.getElementById("dueDate").value = transaction.dueDate
    .toISOString()
    .split("T")[0];
  document.getElementById("fixed").checked = transaction.isFixed;
  document.getElementById("parcel").checked = !transaction.isFixed;
  document.getElementById("save-button").disabled = false;


  if (!transaction.isFixed) {
    document.getElementById("installments").value = transaction.installments;
  }

  toggleInstallmentsInput();
  openFormSidebar();
}

cancelBtn.addEventListener("click", () => {
  form.reset();
  closeFormSidebar();
});

// Função para exibir o nome do usuário logado
function loadUserName() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      document.getElementById("user-name").textContent =
        user.displayName || user.email || "Carregando...";
    } else {
      window.location.href = "/index.html";
    }
  });
}

function logout() {
  showLoading();
  firebase
    .auth()
    .signOut()
    .then(() => {
      hideLoading();
      window.location.href = "/index.html";
    })
    .catch(() => {
      hideLoading();
      showAlert("Erro ao deslogar: " + error.message, "error");
    });
}

const dropdownButton = document.getElementById("dropdownButton");
const dropdownMenu = document.getElementById("dropdownMenu");

dropdownButton.addEventListener("click", () => {
  dropdownMenu.classList.toggle("hidden");
});

// Fechar dropdown ao clicar fora
document.addEventListener("click", (event) => {
  if (!dropdownButton.contains(event.target)) {
    dropdownMenu.classList.add("hidden");
  }
});

// Verifica os parâmetros da URL
function checkURLParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get("action");

  if (action === "openForm") {
    // Abre o formulário
    openFormSidebar();
  }
}

function showAlert(message, type = "success") {
  const alertContainer = document.getElementById("alert-container");
  const alert = document.createElement("div");

  // Classes base
  let baseClasses =
    "flex items-center px-4 py-3 rounded shadow-md transition-opacity duration-300";

  // Classes por tipo
  let typeClasses = "";
  if (type === "success") {
    typeClasses =
      "bg-green-500 text-white hover:bg-green-600 transition-colors cursor-default select-none";
  } else if (type === "error") {
    typeClasses =
      "bg-red-500 text-white hover:bg-red-600 transition-colors cursor-default select-none";
  } else if (type === "info") {
    typeClasses =
      "bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-default select-none";
  } else if (type === "warning") {
    typeClasses =
      "bg-yellow-500 text-black hover:bg-yellow-600 transition-colors cursor-default select-none";
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

const months = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

monthNavigator.addEventListener("click", (event) => {
  const existingDropdown = document.getElementById("dropdownContainer");

  // Remove dropdown se já estiver aberto
  if (existingDropdown) {
    existingDropdown.remove();
    return;
  }

  const dropdownContainer = document.createElement("div");
  dropdownContainer.id = "dropdownContainer";
  dropdownContainer.className =
    "absolute bg-zinc-800 text-white rounded-xl shadow-2xl p-4 mt-2 z-10";

  const navigatorRect = monthNavigator.getBoundingClientRect();

  // Define posição alinhada ao botão
  dropdownContainer.style.position = "absolute";

  // Calcula largura e altura do dropdown
  const dropdownWidth = 240; // Defina a largura ideal
  dropdownContainer.style.width = `${dropdownWidth}px`;

  // Centraliza horizontalmente em relação ao botão
  dropdownContainer.style.left = `${
    navigatorRect.left +
    navigatorRect.width / 2 -
    dropdownWidth / 2 +
    window.scrollX
  }px`;

  // Posiciona logo abaixo do botão
  dropdownContainer.style.top = `${
    navigatorRect.bottom + 6 + window.scrollY
  }px`;

  let selectedYear = currentYear;

  function updateDropdownContent() {
    dropdownContainer.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <button id="prevYear" class="bg-green-500 p-2 rounded-lg px-4 py-1"><i class="fas fa-chevron-left"></i></button>
        <span class="text-lg">${selectedYear}</span>
        <button id="nextYear" class="bg-green-500 p-2 rounded-lg px-4 py-1"><i class="fas fa-chevron-right"></i></button>
      </div>
      <div class="grid grid-cols-4 gap-2">
        ${months
          .map(
            (month, index) => `
          <button 
            class="bg-zinc-700 p-2 rounded-lg hover:bg-zinc-600 ${
              index === currentMonth && selectedYear === currentYear
                ? "ring-2 ring-green-500"
                : ""
            }"
            data-month="${index}">
            ${month.slice(0, 3)}
          </button>
        `
          )
          .join("")}
      </div>
    `;

    dropdownContainer
      .querySelector("#prevYear")
      .addEventListener("click", (e) => {
        e.stopPropagation(); // Impede o evento de fechar
        selectedYear--;
        updateDropdownContent();
      });

    dropdownContainer
      .querySelector("#nextYear")
      .addEventListener("click", (e) => {
        e.stopPropagation(); // Impede o evento de fechar
        selectedYear++;
        updateDropdownContent();
      });

    dropdownContainer.querySelectorAll("[data-month]").forEach((button) => {
      button.addEventListener("click", (e) => {
        currentYear = selectedYear;
        currentMonth = parseInt(e.target.dataset.month);
        updateMonthDisplay();
        displayTransactionsForCurrentMonth();
        dropdownContainer.remove();
      });
    });
  }

  updateDropdownContent();

  document.body.appendChild(dropdownContainer);

  // Fecha o dropdown ao clicar fora
  document.addEventListener("click", function closeDropdown(e) {
    if (!dropdownContainer.contains(e.target) && e.target !== monthNavigator) {
      dropdownContainer.remove();
      document.removeEventListener("click", closeDropdown);
    }
  });

  // Impede que o clique dentro do dropdown feche o menu
  dropdownContainer.addEventListener("click", (e) => e.stopPropagation());
});

// Chama a função ao carregar a página
document.addEventListener("DOMContentLoaded", checkURLParameters);

// Carregar nome do usuário ao iniciar a página
document.addEventListener("DOMContentLoaded", loadUserName);

// Referência ao Firestore
const db = firebase.firestore();

// Variável para armazenar sugestões
let previousNames = [];

// Buscar nomes das dívidas anteriores
async function fetchPreviousDebtNames() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      console.error("Usuário não autenticado.");
      return;
    }

    // Pega o tipo selecionado no filtro
    const selectedType = document.getElementById("type").value;

    const snapshot = await db
      .collection("users")
      .doc(user.uid)
      .collection("transactions") // Pegando as transações do usuário autenticado
      .where("type", "==", selectedType) // Filtra pelo tipo (Gasto ou Ganho)
      .get();

    const namesSet = new Set();

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.name) {
        namesSet.add(data.name.toLowerCase());
      }
    });

    previousNames = [...namesSet]; // Evita nomes duplicados
  } catch (error) {
    console.error("Erro ao buscar nomes:", error);
  }
}

// Buscar os nomes sempre que o usuário muda a opção de filtro
document.getElementById("type").addEventListener("change", fetchPreviousDebtNames);

// Buscar os nomes assim que o usuário estiver autenticado
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    fetchPreviousDebtNames();
  }
});


function filterSuggestions() {
  const input = document.getElementById("name");
  const suggestionsDiv = document.getElementById("suggestions");
  const searchTerm = input.value.toLowerCase();

  // Limpa sugestões anteriores
  suggestionsDiv.innerHTML = "";
  suggestionsDiv.classList.add("hidden");

  if (!searchTerm) return;

  // Filtrar sugestões com base no termo digitado
  const filtered = previousNames.filter(name => name.includes(searchTerm));

  if (filtered.length === 0) return;

  // Criar elementos de sugestão
  filtered.forEach(name => {
    const suggestionItem = document.createElement("div");
    suggestionItem.textContent = name;
    suggestionItem.classList.add("p-2", "cursor-pointer", "hover:bg-zinc-700");
    
    // Preencher o input ao clicar na sugestão
    suggestionItem.onclick = () => {
      input.value = name;
      suggestionsDiv.classList.add("hidden");
    };

    suggestionsDiv.appendChild(suggestionItem);
  });

  suggestionsDiv.classList.remove("hidden");
}


