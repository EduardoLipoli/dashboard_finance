let transactions = [];
let filteredTransactions = [];
const auth = firebase.auth();

// Listener para garantir que a autenticação está concluída
auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      await user.reload();
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

// Função para carregar transações do Firestore
async function loadTransactionsFromFirestore() {
  const user = auth.currentUser;
  if (!user) {
    console.error("Usuário não autenticado.");
    return;
  }

  showLoading();
  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid);

  try {
    const categoriesSnapshot = await userRef.collection("categories").get();
    const categoriesMap = {};
    categoriesSnapshot.forEach((doc) => {
      categoriesMap[doc.id] = doc.data().name;
    });

    const transactionsSnapshot = await userRef.collection("transactions").get();
    hideLoading();
    transactions.length = 0;

    transactionsSnapshot.forEach((doc) => {
      const transaction = doc.data();
      transaction.id = doc.id;
      transaction.dueDate = new Date(transaction.dueDate.seconds * 1000);
      transaction.addedOn = new Date(transaction.addedOn.seconds * 1000);

      if (transaction.category in categoriesMap) {
        transaction.category = categoriesMap[transaction.category];
      }

      transactions.push(transaction);
    });

    filteredTransactions = [...transactions];
    calculateTotals();
    updateCharts();
    setDefaultMonth();
    checkTransactions();
  } catch (error) {
    hideLoading();
    console.error("Erro ao carregar transações ou categorias:", error);
  }
}

// Função para exibir o nome do usuário logado
function loadUserName(user) {
  const displayName = user.displayName || user.email || "Carregando...";
  document.getElementById("user-name").textContent = displayName;
}

// Função para calcular os totais de receitas, despesas e transações dos dias 01 e 15
function calculateTotals() {
  let totalReceitas = 0;
  let totalDespesas = 0;
  let totalGanhoDia01 = 0;
  let totalGastoDia01 = 0;
  let totalGanhoDia15 = 0;
  let totalGastoDia15 = 0;

  filteredTransactions.forEach((transaction) => {
    if (transaction.type === "Ganho") {
      totalReceitas += transaction.amount;

      if (transaction.datepay === "01") {
        totalGanhoDia01 += transaction.amount;
      } else if (transaction.datepay === "15") {
        totalGanhoDia15 += transaction.amount;
      }
    } else if (transaction.type === "Gasto") {
      totalDespesas += transaction.amount;

      if (transaction.datepay === "01") {
        totalGastoDia01 += transaction.amount;
      } else if (transaction.datepay === "15") {
        totalGastoDia15 += transaction.amount;
      }
    }
  });

  // Calcular sobra (totalReceitas - totalDespesas)
  const totalSobra = totalReceitas - totalDespesas;
  const sobraDia01 = totalGanhoDia01 - totalGastoDia01;
  const sobraDia15 = totalGanhoDia15 - totalGastoDia15;

  // Exibir os totais no dashboard
  document.getElementById("totalReceitas").textContent = `${totalReceitas.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}`;
  document.getElementById("totalDespesas").textContent = `${totalDespesas.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}`;
  document.getElementById("totalSobra").textContent = `${totalSobra.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}`;

  document.getElementById("totalGanhoDia01").textContent = `${totalGanhoDia01.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}`;
  document.getElementById("totalGastoDia01").textContent = `${totalGastoDia01.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}`;
  document.getElementById("sobraDia01").textContent = `${sobraDia01.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}`;

  document.getElementById("totalGanhoDia15").textContent = `${totalGanhoDia15.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}`;
  document.getElementById("totalGastoDia15").textContent = `${totalGastoDia15.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}`;
  document.getElementById("sobraDia15").textContent = `${sobraDia15.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}`;
}


// Função para atualizar os gráficos após o filtro
function updateCharts() {
  debtsByDayChart.data.datasets[0].data = [
    filteredTransactions
      .filter((t) => t.type === "Gasto" && t.datepay === "01")
      .reduce((sum, t) => sum + t.amount, 0),
    filteredTransactions
      .filter((t) => t.type === "Gasto" && t.datepay === "15")
      .reduce((sum, t) => sum + t.amount, 0),
  ];
  debtsByDayChart.update();

  const categoriesData = filteredTransactions
    .filter((t) => t.type === "Gasto")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  // Atualiza o gráfico de categorias com as transações de "Gasto"
  categoriesChart.data.labels = Object.keys(categoriesData);
  categoriesChart.data.datasets[0].data = Object.values(categoriesData);
  categoriesChart.update();

  // Atualizar gráfico de Pagas vs Pendentes para transações do tipo "Gasto"
  const paidTransactions = filteredTransactions.filter(
    (t) => t.type === "Gasto" && t.isPaid
  ).length;

  const pendingTransactions = filteredTransactions.filter(
    (t) => t.type === "Gasto" && !t.isPaid
  ).length;

  paidVsPendingChart.data.datasets[0].data = [
    paidTransactions,
    pendingTransactions,
  ];
  paidVsPendingChart.update();

  // Atualizar gráfico de Receitas por Mês
  const monthlyIncomeData = Array.from({ length: 12 }, (_, i) => {
    return filteredTransactions
      .filter((t) => t.type === "Ganho" && t.dueDate.getMonth() === i)
      .reduce((sum, t) => sum + t.amount, 0);
  });

  const monthlyExpensesData = Array.from({ length: 12 }, (_, i) => {
    return filteredTransactions
      .filter((t) => t.type === "Gasto" && t.dueDate.getMonth() === i)
      .reduce((sum, t) => sum + t.amount, 0);
  });

  monthlyIncomeChart.data.datasets[0].data = monthlyIncomeData;
  monthlyExpensesChart.data.datasets[0].data = monthlyExpensesData;
  monthlyIncomeChart.update();
  monthlyExpensesChart.update();
}

// Função para definir o mês atual no filtro
function setDefaultMonth() {
  const currentMonth = new Date().getMonth();
  document.getElementById("monthFilter").value = currentMonth;
  filterByMonth();
}

window.onload = setDefaultMonth;

// Função para filtrar as transações por mês
function filterByMonth() {
  const selectedMonth = document.getElementById("monthFilter").value;

  if (selectedMonth === "all") {
    filteredTransactions = [...transactions];
  } else {
    filteredTransactions = transactions.filter((transaction) => {
      return transaction.dueDate.getMonth() === parseInt(selectedMonth);
    });
  }

  calculateTotals();
  updateCharts();
}

function logout() {
  firebase
    .auth()
    .signOut()
    .then(() => {
      window.location.href = "/index.html";
    })
    .catch(() => {
      showAlert('Erro ao deslogar: ' + error.message, 'error');
    });
}

const dropdownButton = document.getElementById("dropdownButton");
const dropdownMenu = document.getElementById("dropdownMenu");

dropdownButton.addEventListener("click", () => {
  dropdownMenu.classList.toggle("hidden");
});

document.addEventListener("click", (event) => {
  if (!dropdownButton.contains(event.target)) {
    dropdownMenu.classList.add("hidden");
  }
});

function checkTransactions() {
  if (transactions.length === 0) {
    const popup = document.getElementById("no-transactions-popup");
    const overlay = document.getElementById("overlay");

    popup.classList.remove("hidden");
    overlay.classList.remove("hidden");

    document.getElementById("add-income-btn").addEventListener("click", () => {
      window.location.href = "/receitas/transaction.html?action=openForm";
      closeModal();
    });

    document.getElementById("add-expense-btn").addEventListener("click", () => {
      window.location.href = "/despesas/transaction.html?action=openForm";
      closeModal();
    });

    const closeButton = document.getElementById("close-modal-btn");
    closeButton.addEventListener("click", () => closeModal());

    popup.addEventListener("click", (e) => {
      if (e.target === popup) {
        closeModal();
      }
    });
  }
}

function closeModal() {
  const modal = document.getElementById("no-transactions-popup");
  const overlay = document.getElementById("overlay");

  modal.classList.add("hidden");
  overlay.classList.add("hidden");
}

function showAlert(message, type = 'success') {
  const alertContainer = document.getElementById('alert-container');
  const alert = document.createElement('div');

  let baseClasses =
    'flex items-center px-4 py-3 rounded shadow-md transition-opacity duration-300';
    
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

// Carregar nome do usuário ao iniciar a página
document.addEventListener("DOMContentLoaded", loadUserName);

function loadUserName(user) {
  const displayName = user.displayName || user.email.split("@")[0] || "Usuário";
  document.getElementById("user-name").textContent = displayName; // Mantém no botão do dropdown
  document.getElementById("user-greeting").textContent = `Bem-vindo de volta, ${displayName}!👋`; // Adiciona a saudação no header
}

function animarContador(id, valorFinal, duracao = 1000) {
  const elemento = document.getElementById(id);
  if (!elemento) return;

  let inicio = 0;
  const incremento = valorFinal / (duracao / 10); // incremento proporcional
  const intervalo = setInterval(() => {
    inicio += incremento;
    if (inicio >= valorFinal) {
      inicio = valorFinal;
      clearInterval(intervalo);
    }
    elemento.textContent = formatarMoeda(inicio);
  }, 10);
}

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

window.addEventListener("DOMContentLoaded", () => {
  animarContador("totalReceitas", 5240.75);
  animarContador("totalDespesas", 3120.45);
  animarContador("totalSobra", 2120.30);

  animarContador("totalGanhoDia01", 1200.00);
  animarContador("totalGanhoDia15", 4040.75);

  animarContador("totalGastoDia01", 1120.45);
  animarContador("totalGastoDia15", 2000.00);

  animarContador("sobraDia01", 800.00);
  animarContador("sobraDia15", 1320.30);
});
