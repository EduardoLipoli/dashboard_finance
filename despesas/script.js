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
        loadCategoriesForTransaction();
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

  // [NOVO] Pega a referência do dropdown de FILTRO
  const filterCategorySelect = document.getElementById("filterCategory");
  
  // Limpa o dropdown de FILTRO (mantendo a opção "Todas")
  if (filterCategorySelect) {
      filterCategorySelect.innerHTML = '<option value="">Todas</option>';
  }

  const selectedType = document.getElementById("type").value; // Gasto ou Ganho
  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid).collection("categories");

  userRef
    .where("tipo", "==", selectedType)
    .get()
    .then((querySnapshot) => {
      const categorySelect = document.getElementById("categorySelect");
      categorySelect.innerHTML = ""; // Limpa o dropdown do FORMULÁRIO

      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Selecione a categoria";
      categorySelect.appendChild(defaultOption);

      categoryMap = {}; // Limpa o objeto antes de carregar novamente

      querySnapshot.forEach((doc) => {
        const categoryId = doc.id;
        const categoryName = doc.data().name;

        categoryMap[categoryId] = categoryName;

        // Popula o <select> DO FORMULÁRIO
        const option = document.createElement("option");
        option.value = categoryId;
        option.textContent = categoryName;
        categorySelect.appendChild(option);

        // [NOVO] Popula o <select> DO FILTRO
        if (filterCategorySelect) {
            const filterOption = document.createElement("option");
            filterOption.value = categoryId;
            filterOption.textContent = categoryName;
            filterCategorySelect.appendChild(filterOption);
        }
      });

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
        transaction.dueDate = convertToDate(transaction.dueDate);
        transaction.addedOn = convertToDate(transaction.addedOn);        
        transactions.push(transaction);
      });
      displayTransactionsForCurrentMonth();
      showOverduePopup();
    })
    .catch((error) => {
      hideLoading();
      console.error("Erro ao carregar transações do Firestore:", error);
    });
}

// Função auxiliar para garantir a conversão correta para Date
function convertToDate(value) {
    if (value instanceof firebase.firestore.Timestamp) {
        return value.toDate();
    } else if (value && typeof value.toDate === 'function') {
        // Trata o caso em que o objeto é um Timestamp, mas não uma instância direta
        return value.toDate();
    } else if (typeof value === "string" || typeof value === "number") {
        return new Date(value);
    } else if (value && typeof value === 'object' && value.hasOwnProperty('seconds') && value.hasOwnProperty('nanoseconds')) {
        // Adiciona tratamento para o formato de objeto do Timestamp do Firestore
        // Note que o JSON exportado usa "seconds" e "nanoseconds"
        return new firebase.firestore.Timestamp(value.seconds, value.nanoseconds).toDate();
    } else if (value instanceof Date) {
        return value;
    }
    // Se não for nenhum dos tipos esperados, retorna uma data inválida para evitar erros
    return new Date(NaN);
}

form.addEventListener("submit", function (e) {
  e.preventDefault();

  // — Coleta os campos do form —
  const name         = document.getElementById("name").value;
  const amount       = parseFloat(
                         document.getElementById("amount")
                                 .value.replace(",", ".")
                       );
  const type         = document.getElementById("type").value;
  const category     = document.getElementById("categorySelect").value;
  const datepay      = document.getElementById("datepay").value;
  const dueDateInput = document.getElementById("dueDate").value;
  const [y, m, d]    = dueDateInput.split("-").map(Number);
  const dueDate      = new Date(y, m - 1, d);
  const isFixed      = document.getElementById("fixed").checked;
  let installments;
  if (isFixed) {
    installments = 0;
  } else if (parcelRadio.checked) {
    installments = parseInt(document.getElementById("installments").value) || 1;
  } else {
    // Caso seja uma transação única
    installments = 1;
  }

  // Monta objeto transaction
  const transaction = {
    id:       currentEditIndex !== null
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
    addedOn:  new Date(),
    isPaid:   currentEditIndex !== null
                ? transactions[currentEditIndex].isPaid
                : false,
  };

  if (currentEditIndex !== null) {
    // — EDIÇÃO: atualiza original e sincroniza réplicas —
    transactions[currentEditIndex] = transaction;
    saveTransactionToFirestore(transaction);
    syncReplicatedTransactions(transaction);
    currentEditIndex = null;

  } else {
    // — CRIAÇÃO: empurra e gera réplicas —
    transactions.push(transaction);
    saveTransactionToFirestore(transaction);

    if (isFixed) {
      replicateFixedTransaction(transaction);
    } else if (installments >= 1) {
      replicateInstallments(transaction);
    }
  }

  // exibe, reseta e fecha
  displayTransactionsForCurrentMonth();
  form.reset();
  closeFormSidebar();
});

// Função para replicar transações fixas
function replicateFixedTransaction(transaction) {
  showLoading();
  const user = firebase.auth().currentUser;
  if (!user) {
    hideLoading();
    console.error(
      "Usuário não autenticado. Não é possível replicar transações fixas no Firestore."
    );
    return;
  }

  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid);
  const batch = db.batch();

  const REPLICATION_YEARS = 30; // Replicar por 30 anos
  const totalMonthsToReplicate = REPLICATION_YEARS * 12;
  const originalDay = transaction.dueDate.getDate(); // Salva o dia original

  for (let i = 1; i <= totalMonthsToReplicate; i++) {
    const replicatedTransaction = { ...transaction };
    replicatedTransaction.id = `${transaction.id}-${i}`; // ID único para a réplica
    replicatedTransaction.dueDate = new Date(transaction.dueDate);
    replicatedTransaction.dueDate.setMonth(
      transaction.dueDate.getMonth() + i
    );

    // [IMPORTANTE] Lógica para corrigir "pulos" de mês
    // ex: 31 de Jan + 1 mês = 31 de Fev -> 2 ou 3 de Março.
    // Esta lógica força a data para o último dia do mês correto (ex: 28/29 de Fev).
    if (replicatedTransaction.dueDate.getDate() !== originalDay) {
        replicatedTransaction.dueDate.setDate(0); // Vai para o último dia do mês anterior (o mês que queremos)
    }

    replicatedTransaction.isPaid = false; // Novas réplicas futuras nunca estão pagas

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
      console.error("Erro ao replicar transações fixas (longo prazo):", error);
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
      hideLoading();
      displayTransactionsForCurrentMonth();
    })
    .catch((error) => {
      hideLoading();
      console.error(
        "Erro ao replicar transações parceladas no Firestore:",
        error
      );
    });
}

function updateReplicatedTransactions(transaction) {
  showLoading();
  const user = firebase.auth().currentUser;
  if (!user) {
    console.error("Usuário não autenticado.");
    hideLoading();
    return;
  }

  const db = firebase.firestore();
  const txRef = db
    .collection("users")
    .doc(user.uid)
    .collection("transactions");

  // Extrai o "baseId" (tudo antes do primeiro "-")
  const baseId = transaction.id.split("-")[0];

  txRef.get().then((snapshot) => {
    const batch = db.batch();

    snapshot.forEach((doc) => {
      const docId = doc.id;
      // pula o original, pega só os que começam com baseId-
      if (docId !== transaction.id && docId.startsWith(baseId + "-")) {
        const docRef = txRef.doc(docId);
        // Campos que queremos propagar
        batch.update(docRef, {
          name:        transaction.name,
          amount:      transaction.amount,
          type:        transaction.type,
          category:    transaction.category,
          datepay:     transaction.datepay,
          isFixed:     transaction.isFixed,
          installments:transaction.installments,
        });
        // também atualiza no array local
        const idx = transactions.findIndex((t) => t.id === docId);
        if (idx >= 0) {
          Object.assign(transactions[idx], {
            name:        transaction.name,
            amount:      transaction.amount,
            type:        transaction.type,
            category:    transaction.category,
            datepay:     transaction.datepay,
            isFixed:     transaction.isFixed,
            installments:transaction.installments,
          });
        }
      }
    });

    return batch.commit();
  })
  .then(() => {
    hideLoading();
    displayTransactionsForCurrentMonth();
  })
  .catch((err) => {
    hideLoading();
    console.error("Erro ao propagar edição nas réplicas:", err);
  });
}

function syncReplicatedTransactions(newTx) {
  showLoading();
  const user = firebase.auth().currentUser;
  if (!user) {
    console.error("Não autenticado.");
    hideLoading();
    return;
  }

  // 1. Identifica o grupo de transações (ex: "1712345678")
  const baseId = newTx.id.split("-")[0];

  // 2. [A MUDANÇA] Define o ponto de corte com base no mês
  //    da transação que você está EDITANDO.
  const clickedDueDate = convertToDate(newTx.dueDate);
  const startOfClickedMonth = new Date(
    clickedDueDate.getFullYear(),
    clickedDueDate.getMonth(),
    1, // Dia 01
    0, 0, 0, 0 // Início do dia
  );

  const db = firebase.firestore();
  const txRef = db
    .collection("users")
    .doc(user.uid)
    .collection("transactions");

  txRef
    .get()
    .then((snap) => {
      const batch = db.batch();

      // 3. Apaga todas as réplicas futuras, EXCETO a principal
      snap.forEach((doc) => {
        const id = doc.id;
        const [docBaseId] = id.split("-");

        // 4. Verifica se é do mesmo grupo
        if (docBaseId === baseId) {
          const docData = doc.data();
          const docDueDate = convertToDate(docData.dueDate);

          // 5. [A MUDANÇA] SÓ apaga se for do mês editado
          //    em diante E não for a própria transação que
          //    estamos salvando (newTx.id).
          if (id !== newTx.id && docDueDate >= startOfClickedMonth) {
            batch.delete(doc.ref);
          }
          // Se (docDueDate < startOfClickedMonth), ela é do
          // passado e será IGNORADA (preservada).
        }
      });

      return batch.commit();
    })
    .then(() => {
      // 6. [A MUDANÇA] Atualiza a lista local com a MESMA lógica:
      //    Mantém tudo que não é do grupo,
      //    OU é do grupo, mas é de um mês passado,
      //    OU é a própria transação que acabamos de editar.
      transactions = transactions.filter((t) => {
        const [bid] = t.id.split("-");
        if (bid !== baseId) return true; // Não é do grupo

        const txDueDate = convertToDate(t.dueDate);
        if (txDueDate < startOfClickedMonth) return true; // É do passado
        
        if (t.id === newTx.id) return true; // É a que acabamos de salvar

        return false; // É uma réplica futura que foi apagada
      });

      // 7. Agora, recria as transações (fixas ou parceladas)
      //    APENAS para o futuro, com base nos novos dados.
      if (newTx.isFixed) {
        replicateFixedTransaction(newTx);
        hideLoading();
      } else if (newTx.installments > 1) {
        replicateInstallments(newTx);
      } else {
        // Caso seja transação única
        newTx.installments = 1;

        // Atualiza a transação principal no Firestore
        return txRef.doc(newTx.id).update({ installments: 1 }).then(() => {
          hideLoading();
          displayTransactionsForCurrentMonth();
        });
      }
    })
    .catch((err) => {
      console.error("Erro ao sincronizar réplicas:", err);
      hideLoading();
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

// Listener para o botão "Mês Atual"
document.getElementById("todayButton").addEventListener("click", () => {
  const today = new Date();
  currentMonth = today.getMonth();
  currentYear = today.getFullYear();
  
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

const filterBtn       = document.getElementById("filterBtn");
const filterMenu      = document.getElementById("filterMenu");
const filterChevron   = document.getElementById("filterChevron");
const selectStatus    = document.getElementById("filterStatus");
const selectDatepay   = document.getElementById("filterDatepay");
const selectCategory  = document.getElementById("filterCategory");

filterBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  filterMenu.classList.toggle("hidden");
  filterChevron.classList.toggle("rotate-180");
});
document.addEventListener("click", (e) => {
  if (!filterMenu.contains(e.target) && !filterBtn.contains(e.target)) {
    filterMenu.classList.add("hidden");
    filterChevron.classList.remove("rotate-180");
  }
});

const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", displayTransactionsForCurrentMonth);


selectStatus.addEventListener("change", displayTransactionsForCurrentMonth);
selectDatepay.addEventListener("change", displayTransactionsForCurrentMonth);
selectCategory.addEventListener("change", displayTransactionsForCurrentMonth);

function displayTransactionsForCurrentMonth() {
  const statusFilter = selectStatus.value;
  const datepayFilter = selectDatepay.value;
  const categoryFilter = selectCategory.value;
  const searchTerm = searchInput.value.trim().toLowerCase();

  // Seleciona os elementos do footer
  const tfoot = document.getElementById("tableFooter");
  const footerAmountEl = document.getElementById("footerTotalAmount");
  const footerCountEl = document.getElementById("footerTransactionCount");

  // Variáveis para calcular os totais visíveis
  let visibleTransactionCount = 0;
  let visibleTransactionTotal = 0.0;

  tableBody.innerHTML = "";

  transactions.forEach((transaction, index) => {
    // Adiciona uma verificação para garantir que dueDate é um objeto Date
    if (!(transaction.dueDate instanceof Date)) {
      console.error("Data de vencimento inválida para a transação:", transaction);
      return;
    }

    const transactionMonth = transaction.dueDate.getMonth();
    const transactionYear = transaction.dueDate.getFullYear();

    if (
      transaction.type !== "Gasto" ||
      transactionMonth !== currentMonth ||
      transactionYear !== currentYear
    ) return;

    if (
      (statusFilter === "paid" && !transaction.isPaid) ||
      (statusFilter === "unpaid" && transaction.isPaid)
    ) return;

    if (
      datepayFilter !== "" &&
      transaction.datepay !== datepayFilter
    ) return;

    if (
      categoryFilter !== "" &&
      transaction.category !== categoryFilter
    ) return;

    if (searchTerm && !transaction.name.toLowerCase().includes(searchTerm)) return;

    visibleTransactionCount++;
    visibleTransactionTotal += transaction.amount;

    const formattedName = capitalizeName(transaction.name);
    const formattedAmount = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2
    }).format(transaction.amount);
    const categoryName = categoryMap[transaction.category] || "Categoria desconhecida";

    const nameCell = `
      <div class="relative group inline-block">
        <span class="font-medium cursor-pointer">${formattedName}</span>
        <div class="absolute left-1/2 top-full mt-2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                            bg-black text-white text-xs font-medium px-4 py-2 rounded z-20 whitespace-nowrap
                            after:content-[''] after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2
                            after:border-8 after:border-transparent after:border-b-black">
          Marcar como pago
        </div>
      </div>
  `;

    const nameCellSel = `
  <div class="relative group inline-block">
    <span class="font-medium cursor-pointer">${formattedName}</span>
    <div class="absolute left-1/2 top-full mt-2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                            bg-black text-white text-xs font-medium px-4 py-2 rounded z-20 whitespace-nowrap
                            after:content-[''] after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2
                            after:border-8 after:border-transparent after:border-b-black">
      Desmarcar como pago
    </div>
  </div>
`;

    const row = document.createElement("tr");
    row.classList.add("border-b", "border-zinc-700");
    row.classList.toggle("is-Paid", transaction.isPaid);
    row.innerHTML = `
      <td class="py-3 px-6 font-medium flex items-center gap-2">
        ${!transaction.isPaid ? nameCell : nameCellSel}
      </td>
      <td class="py-3 px-6">
        <span class="px-2 py-1 rounded-full text-sm ${
          transaction.type === "Ganho"
            ? `bg-green-800 bg-opacity-25 text-green-500 ${transaction.isPaid ? "text-opacity-50" : ""}`
            : `bg-red-900 bg-opacity-25 text-red-500 ${transaction.isPaid ? "text-opacity-50" : ""}`
        }">${transaction.type}</span>
      </td>
      <td class="py-3 px-6">${categoryName}</td>
      <td class="py-3 px-6">${transaction.dueDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      })}</td>
      <td class="py-3 px-6">Dia ${transaction.datepay}</td>
      <td class="py-3 px-6 font-medium">${formattedAmount}</td>
      <td class="py-3 px-6">${
        transaction.isFixed ? "Fixa" : `${transaction.installments}x`
      }</td>
      <td class="py-3 px-6">${getTransactionStatus(transaction)}</td>
      <td class="py-3 px-6">
        <button class="text-zinc-500 hover:text-zinc-700" onclick="editTransaction(${index})">
          <i class="fa-regular fa-pen-to-square"></i>
        </button>
        <button class="text-red-500 hover:text-red-700 ml-2" onclick="openDeleteModal(${index})">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </td>
    `;
    row.addEventListener("click", event => toggleTransactionPaid(index, event));
    tableBody.appendChild(row);
  });

  // Atualiza o footer ou esconde se estiver vazio
  if (visibleTransactionCount === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="9" class="text-center py-4">Nenhuma transação encontrada para este mês.</td>`;
    tableBody.appendChild(emptyRow);
    
    // Esconde o footer
    tfoot.style.display = 'none';
  } else {
    // Mostra o footer e atualiza os valores
    tfoot.style.display = 'table-footer-group'; // 'table-footer-group' é o display padrão para tfoot
    
    footerAmountEl.textContent = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(visibleTransactionTotal);
    
    footerCountEl.textContent = `${visibleTransactionCount} ${visibleTransactionCount === 1 ? 'transação' : 'transações'}`;
  }

  if (tableBody.innerHTML === "") {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="9" class="text-center py-4">Nenhuma transação encontrada para este mês.</td>`;
    tableBody.appendChild(emptyRow);
  }

  const valorDia01Element = document.getElementById("valor-dia-01");
  const valorDia15Element = document.getElementById("valor-dia-15");
  const qtdDia01Element = document.getElementById("quantidade-dia-01");
  const qtdDia15Element = document.getElementById("quantidade-dia-15");

  if (valorDia01Element && valorDia15Element) {
    let totalDia01 = 0,
      totalDia15 = 0;
    let countDia01 = 0,
      countDia15 = 0;

    transactions.forEach(tx => {
        // Adiciona a mesma verificação aqui
        if (!(tx.dueDate instanceof Date)) return;

        const m = tx.dueDate.getMonth(),
            y = tx.dueDate.getFullYear();
        if (tx.type === "Gasto" && m === currentMonth && y === currentYear && !tx.isPaid) {
            if (tx.datepay === "01") {
                totalDia01 += tx.amount;
                countDia01++;
            }
            if (tx.datepay === "15") {
                totalDia15 += tx.amount;
                countDia15++;
            }
        }
    });

    const valorAtual01 = parseFloat(valorDia01Element.textContent.replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
    const valorAtual15 = parseFloat(valorDia15Element.textContent.replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
    animateValue(valorDia01Element, valorAtual01, totalDia01, 800);
    animateValue(valorDia15Element, valorAtual15, totalDia15, 800);
    qtdDia01Element.textContent = `${countDia01} despesa${countDia01 !== 1 ? 's' : ''}`;
    qtdDia15Element.textContent = `${countDia15} despesa${countDia15 !== 1 ? 's' : ''}`;
  }
}

function showTooltip(event) {
  const tooltip = document.getElementById('tooltipContainer');
  const rect = event.target.getBoundingClientRect();

  // Ajuste na posição para ficar abaixo do item
  tooltip.style.left = `${rect.left + rect.width / 2}px`; // Centraliza o tooltip
  tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`; // Fica logo abaixo do cabeçalho
  tooltip.classList.remove('hidden');
}

function hideTooltip() {
  const tooltip = document.getElementById('tooltipContainer');
  tooltip.classList.add('hidden');
}


function getTransactionStatus(transaction) {
  if (transaction.isPaid) return `<span class="min-w-[80px] text-center inline-block px-2 py-1 rounded-full text-sm bg-green-800 bg-opacity-25 text-green-500">Pago</span>`;
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(transaction.dueDate); due.setHours(0,0,0,0);
  return due < today
    ? `<span class="min-w-[80px] text-center inline-block px-2 py-1 rounded-full text-sm bg-red-800 bg-opacity-25 text-red-500">Atrasado</span>`
    : `<span class="min-w-[80px] text-center inline-block px-2 py-1 rounded-full text-sm bg-white bg-opacity-25 text-white">Pendente</span>`;
}

function animateValue(element, start, end, duration) {
  const range = end - start;
  let startTimestamp = null;

  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const value    = start + range * progress;

    element.textContent = value.toLocaleString("pt-BR", {
      style:     "currency",
      currency:  "BRL"
    });

    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
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

  // 1. Identifica o grupo de transações (ex: "1712345678")
  const baseId = transactionToRemove.id.split("-")[0];
  const user = firebase.auth().currentUser;

  if (!user) {
    hideLoading();
    console.error(
      "Usuário não autenticado. Não é possível excluir transações."
    );
    return;
  }

  // 2. [A CORREÇÃO] Define o ponto de corte com base no mês
  //    da transação que você CLICOU para apagar.
  const clickedDueDate = convertToDate(transactionToRemove.dueDate);
  const startOfClickedMonth = new Date(
    clickedDueDate.getFullYear(),
    clickedDueDate.getMonth(),
    1, // Dia 01
    0, 0, 0, 0 // Início do dia
  );

  const db = firebase.firestore();
  const transactionsRef = db
    .collection("users")
    .doc(user.uid)
    .collection("transactions");

  transactionsRef
    .get()
    .then((querySnapshot) => {
      const batch = db.batch();

      querySnapshot.forEach((doc) => {
        const docId = doc.id;
        const [docBaseId] = docId.split("-");

        // 3. Encontra todas as transações do mesmo grupo
        if (docBaseId === baseId) {
          const transactionData = doc.data();
          const dueDate = convertToDate(transactionData.dueDate);

          // 4. Se a transação for DO MÊS CLICADO EM DIANTE,
          //    ela é marcada para exclusão.
          if (dueDate >= startOfClickedMonth) {
            batch.delete(doc.ref);
          }
          // Se for anterior (dueDate < startOfClickedMonth),
          // ela é ignorada e mantida no histórico.
        }
      });

      return batch.commit();
    })
    .then(() => {
      hideLoading();

      // 5. Atualiza o array 'transactions' local com a MESMA lógica
      transactions = transactions.filter((transaction) => {
        const [txBaseId] = transaction.id.split("-");

        // Se não for do mesmo grupo, mantém
        if (txBaseId !== baseId) {
          return true;
        }

        // Se for do mesmo grupo, mas de um mês passado, mantém
        const txDueDate = convertToDate(transaction.dueDate);
        if (txDueDate < startOfClickedMonth) {
          return true;
        }

        // Se for do mesmo grupo E do mês clicado/futuro, remove
        return false;
      });

      displayTransactionsForCurrentMonth();
    })
    .catch((error) => {
      hideLoading();
      console.error("Erro ao excluir transações futuras do Firestore:", error);
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



