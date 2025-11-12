const db = firebase.firestore();
const auth = firebase.auth();

let allAvailableStocks = [];
let isGroupedView = false;
let currentFilters = {
  search: "",
  type: "all",
  dateRange: "all",
  profitability: "all",
  sortBy: "date",
  sortDirection: "desc",
};

// Listener para garantir que a autenticação está concluída
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
      } catch (error) {
        console.error("Erro ao atualizar dados do usuário:", error);
      }
    } else {
      console.error("Usuário não autenticado.");
      window.location.href = "/index.html";
    }
  });
});

// Função para deslogar o usuário
function logout() {
  firebase
    .auth()
    .signOut()
    .then(() => {
      window.location.href = "/index.html";
    })
    .catch((error) => {
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
      "bg-yellow-500 text-white hover:bg-yellow-600 transition-colors cursor-default select-none";
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

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    // O usuário está logado; podemos inicializar
    init();
  } else {
    // Usuário não logado — por exemplo, redirecione pra tela de login
    window.location.href = "/login.html";
  }
});

// Sample data - in a real app, this would come from a database
let investments = JSON.parse(localStorage.getItem("investments")) || [];
let chart = null;
let chartPeriod = "year"; // <<< NOVO: Guarda o período atual do gráfico

// DOM Elements
const addInvestmentBtn = document.getElementById("add-investment-btn");
const addFirstInvestmentBtn = document.getElementById("add-first-investment");
const addInvestmentModal = document.getElementById("add-investment-modal");
const closeModalBtn = document.getElementById("close-modal");
const cancelAddInvestmentBtn = document.getElementById("cancel-add-investment");
const investmentForm = document.getElementById("investment-form");
const investmentsTableBody = document.getElementById("investments-table-body");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search-input");
const deleteModal = document.getElementById("delete-modal");
const cancelDeleteBtn = document.getElementById("cancel-delete");
const confirmDeleteBtn = document.getElementById("confirm-delete");
const viewToggle = document.getElementById("view-toggle");
const toggleFilterBtn = document.getElementById("toggle-filter-btn");

const syncPricesBtn = document.getElementById("sync-prices-btn");

// <<< NOVO: Seletores dos botões de período do gráfico
const btnMonth = document.getElementById("btn-month");
const btnYear = document.getElementById("btn-year");
const btn5Years = document.getElementById("btn-5years");

// Stats elements
const totalValueEl = document.getElementById("total-value");
const totalProfitEl = document.getElementById("total-profit");
const totalPorcProfit = document.getElementById("porc-profit");
const totalInvestedEl = document.getElementById("total-invested");
const totalAssetsEl = document.getElementById("total-assets");

function init() {
  showLoading();

  ApiService.fetchAllAvailable().then((stocks) => {
    allAvailableStocks = stocks;
  });

  const uid = auth.currentUser.uid;

  db.collection("users")
    .doc(uid)
    .collection("investiments")
    .onSnapshot(
      (snapshot) => {
        investments = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Injeta o HTML dos filtros se não existir
        if (!document.getElementById("filter-type")) {
const filterHTML = `
              <div id="filter-panel" class="hidden p-4 border-b border-zinc-700 filter-section flex flex-col gap-4 mb-4 rounded-lg transition-opacity duration-300 ">
                  <div class="flex flex-col md:flex-row gap-4">
                      <div class="flex flex-col">
                          <label class="text-xs text-zinc-400 mb-1">Tipo</label>
                          <select id="filter-type" class="bg-zinc-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-500 w-full md:w-auto">
                              <option value="all">Todos os tipos</option>
                              <option value="acao">Ações</option>
                              <option value="fii">FIIs</option>
                              <option value="renda-fixa">Renda Fixa</option>
                              <option value="cripto">Criptomoedas</option>
                              <option value="etf">ETFs</option>
                          </select>
                      </div>

                      <div class="flex flex-col">
                          <label class="text-xs text-zinc-400 mb-1">Período</label>
                          <select id="filter-date" class="bg-zinc-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-500 w-full md:w-auto">
                              <option value="all">Todo período</option>
                              <option value="today">Hoje</option>
                              <option value="week">Esta semana</option>
                              <option value="month">Este mês</option>
                              <option value="quarter">Este trimestre</option>
                              <option value="year">Este ano</option>
                              <option value="custom">Personalizado</option>
                          </select>
                      </div>

                      <div class="flex flex-col">
                          <label class="text-xs text-zinc-400 mb-1">Rentabilidade</label>
                          <select id="filter-profitability" class="bg-zinc-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-500 w-full md:w-auto">
                              <option value="all">Todas</option>
                              <option value="positive">Positivas</option>
                              <option value="negative">Negativas</option>
                              <option value="high-profit">Alta (>10%)</option>
                              <option value="high-loss">Queda (>10%)</option>
                          </select>
                      </div>

                      <div class="flex flex-col">
                          <label class="text-xs text-zinc-400 mb-1">Ordenar por</label>
                          <div class="flex">
                              <select id="filter-sort" class="bg-zinc-700 text-sm rounded-l-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-500 w-full md:w-auto border-r border-zinc-600">
                                  <option value="date">Data</option>
                                  <option value="name">Nome</option>
                                  <option value="type">Tipo</option>
                                  <option value="quantity">Quantidade</option>
                                  <option value="invested">Valor Investido</option>
                                  <option value="current">Valor Atual</option>
                                  <option value="profitability">Rentabilidade</option>
                              </select>
                              <button id="sort-direction" class="bg-zinc-700 text-zinc-300 text-sm rounded-r-lg px-3 py-2 hover:bg-zinc-600 transition">
                                  <i class="fas fa-arrow-down-wide-short"></i>
                              </button>
                          </div>
                      </div>

                      <div class="flex flex-col justify-end">
                          <div class="flex gap-2">
                              <button id="clear-filters" class="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded-lg text-sm flex items-center transition">
                                  <i class="fas fa-times mr-1"></i> Limpar
                              </button>
                              <button id="save-filter-preset" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center transition">
                                  <i class="fas fa-save mr-1"></i> Salvar Filtro
                              </button>
                          </div>
                      </div>
                  </div>

                  <div id="custom-date-filter" class="hidden mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class="flex flex-col">
                          <label class="text-xs text-zinc-400 mb-1">Data inicial</label>
                          <input type="date" id="filter-date-start" class="bg-zinc-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-500">
                      </div>
                      <div class="flex flex-col">
                          <label class="text-xs text-zinc-400 mb-1">Data final</label>
                          <input type="date" id="filter-date-end" class="bg-zinc-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-500">
                      </div>
                  </div>

                  <div id="filter-presets" class="hidden mt-4">
                      <div class="flex flex-wrap gap-2" id="presets-container">
                          </div>
                  </div>
              </div>
          `;

          const tableHeader = document.querySelector(
            ".bg-zinc-800.rounded-lg.overflow-hidden.mb-8 .p-4.border-b.border-zinc-700"
          );
          tableHeader.insertAdjacentHTML("afterend", filterHTML);

          // Adiciona event listeners para os filtros
          setupFilterListeners();
        }

        updateInvestmentsList();
        updateStats();
        updateDistribution();
        initChart();

        emptyState.style.display = investments.length === 0 ? "block" : "none";

        hideLoading();
      },
      (error) => {
        console.error("Erro ao buscar investimentos:", error);
        hideLoading(); // Garante que o loader some mesmo em erro
      }
    );
}

// Update the investments list
function updateInvestmentsList(searchText = "") {
  investmentsTableBody.innerHTML = "";

  // Atualiza o filtro de busca se um texto foi passado
  if (searchText !== undefined) {
    currentFilters.search = searchText;
  }

  const filteredInvestments = applyFilters(investments);

  if (isGroupedView) {
    const groupedData = groupInvestments(filteredInvestments);
    renderGroupedView(groupedData);
  } else {
    renderTransactionView(filteredInvestments);
  }

  // Atualiza a interface dos filtros
  applyCurrentFiltersToUI();

  // Atualiza contador de resultados
  updateResultsCounter(filteredInvestments.length);

  // Mostra/oculta estado vazio
  emptyState.style.display =
    filteredInvestments.length === 0 && investments.length > 0
      ? "block"
      : "none";

  // Atualiza texto do estado vazio quando há filtros aplicados
  if (filteredInvestments.length === 0 && investments.length > 0) {
    emptyState.querySelector("p").textContent =
      "Nenhum investimento encontrado com os filtros atuais";
  } else if (filteredInvestments.length === 0) {
    emptyState.querySelector("p").textContent =
      "Nenhum investimento cadastrado ainda";
  }
}

function applyFilters(investments) {
  let filtered = [...investments];

  // Filtro de busca por texto
  if (currentFilters.search) {
    filtered = filtered.filter(
      (investment) =>
        investment.name
          .toLowerCase()
          .includes(currentFilters.search.toLowerCase()) ||
        investment.type
          .toLowerCase()
          .includes(currentFilters.search.toLowerCase())
    );
  }

  // Filtro por tipo
  if (currentFilters.type !== "all") {
    filtered = filtered.filter(
      (investment) => investment.type === currentFilters.type
    );
  }

  // Filtro por período
  if (currentFilters.dateRange !== "all") {
    const now = new Date();
    let startDate;

    switch (currentFilters.dateRange) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter":
        startDate = new Date(
          now.getFullYear(),
          now.getMonth() - 3,
          now.getDate()
        );
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "custom":
        const start = document.getElementById("filter-date-start").value;
        const end = document.getElementById("filter-date-end").value;
        if (start) {
          filtered = filtered.filter(
            (investment) => new Date(investment.date) >= new Date(start)
          );
        }
        if (end) {
          filtered = filtered.filter(
            (investment) => new Date(investment.date) <= new Date(end)
          );
        }
        return filtered;
    }

    if (startDate) {
      filtered = filtered.filter(
        (investment) => new Date(investment.date) >= startDate
      );
    }
  }

  // Filtro por rentabilidade
  if (currentFilters.profitability !== "all") {
    filtered = filtered.filter((investment) => {
      const investedValue = investment.quantity * investment.price;
      const currentValue = investment.quantity * investment.currentValue;
      const profitPercentage =
        ((currentValue - investedValue) / investedValue) * 100;

      switch (currentFilters.profitability) {
        case "positive":
          return profitPercentage > 0;
        case "negative":
          return profitPercentage < 0;
        case "high-profit":
          return profitPercentage > 10;
        case "high-loss":
          return profitPercentage < -10;
        default:
          return true;
      }
    });
  }

  // Ordenação
  filtered.sort((a, b) => {
    let aValue, bValue;

    switch (currentFilters.sortBy) {
      case "name":
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case "type":
        aValue = a.type;
        bValue = b.type;
        break;
      case "quantity":
        aValue = a.quantity;
        bValue = b.quantity;
        break;
      case "invested":
        aValue = a.quantity * a.price;
        bValue = b.quantity * b.price;
        break;
      case "current":
        aValue = a.quantity * a.currentValue;
        bValue = b.quantity * b.currentValue;
        break;
      case "profitability":
        const aInvested = a.quantity * a.price;
        const aCurrent = a.quantity * a.currentValue;
        aValue = (aCurrent - aInvested) / aInvested;

        const bInvested = b.quantity * b.price;
        const bCurrent = b.quantity * b.currentValue;
        bValue = (bCurrent - bInvested) / bInvested;
        break;
      case "date":
      default:
        aValue = new Date(a.date);
        bValue = new Date(b.date);
    }

    if (currentFilters.sortDirection === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  return filtered;
}

function applyCurrentFiltersToUI() {
  document.getElementById("filter-type").value = currentFilters.type;
  document.getElementById("filter-date").value = currentFilters.dateRange;
  document.getElementById("filter-profitability").value =
    currentFilters.profitability;
  document.getElementById("filter-sort").value = currentFilters.sortBy;

  const sortButton = document.getElementById("sort-direction");
  if (currentFilters.sortDirection === "asc") {
    sortButton.innerHTML = '<i class="fas fa-arrow-up-wide-short"></i>';
  } else {
    sortButton.innerHTML = '<i class="fas fa-arrow-down-wide-short"></i>';
  }

  // Mostrar/ocultar filtro de data personalizado
  const customDateFilter = document.getElementById("custom-date-filter");
  if (currentFilters.dateRange === "custom") {
    customDateFilter.classList.remove("hidden");
  } else {
    customDateFilter.classList.add("hidden");
  }
}

function updateResultsCounter(filteredCount) {
    // 1. Encontra o container que criamos no HTML
    const counterContainer = document.getElementById('results-counter-container');

    // 2. Se o container não for encontrado, sai da função
    if (!counterContainer) {
        return;
    }

    // 3. Define o texto do container
    counterContainer.textContent = `${filteredCount} de ${investments.length} investimentos`;
}

function setupFilterListeners() {
  document.getElementById("filter-type").addEventListener("change", (e) => {
    currentFilters.type = e.target.value;
    updateInvestmentsList();
  });

  document.getElementById("filter-date").addEventListener("change", (e) => {
    currentFilters.dateRange = e.target.value;
    applyCurrentFiltersToUI();
    updateInvestmentsList();
  });

  document
    .getElementById("filter-profitability")
    .addEventListener("change", (e) => {
      currentFilters.profitability = e.target.value;
      updateInvestmentsList();
    });

  document.getElementById("filter-sort").addEventListener("change", (e) => {
    currentFilters.sortBy = e.target.value;
    updateInvestmentsList();
  });

  document.getElementById("sort-direction").addEventListener("click", () => {
    currentFilters.sortDirection =
      currentFilters.sortDirection === "asc" ? "desc" : "asc";
    applyCurrentFiltersToUI();
    updateInvestmentsList();
  });

  document.getElementById("clear-filters").addEventListener("click", () => {
    currentFilters = {
      search: "",
      type: "all",
      dateRange: "all",
      profitability: "all",
      sortBy: "date",
      sortDirection: "desc",
    };

    document.getElementById("search-input").value = "";
    applyCurrentFiltersToUI();
    updateInvestmentsList();
    showAlert("Filtros limpos!", "success");
  });

  document
    .getElementById("save-filter-preset")
    .addEventListener("click", () => {
      const name = prompt("Nome para este filtro:");
      if (name) {
        saveFilterPreset(name);
      }
    });

  // Event listeners para filtros de data personalizados
  document
    .getElementById("filter-date-start")
    .addEventListener("change", () => {
      updateInvestmentsList();
    });

  document.getElementById("filter-date-end").addEventListener("change", () => {
    updateInvestmentsList();
  });

  // Carrega os presets salvos
  loadFilterPresets();
}

function saveFilterPreset(name) {
  const presets = JSON.parse(
    localStorage.getItem("investmentFilterPresets") || "[]"
  );
  presets.push({
    name: name,
    filters: { ...currentFilters },
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem("investmentFilterPresets", JSON.stringify(presets));
  loadFilterPresets();
  showAlert("Filtro salvo com sucesso!", "success");
}

function loadFilterPresets() {
  const presets = JSON.parse(
    localStorage.getItem("investmentFilterPresets") || "[]"
  );
  const container = document.getElementById("presets-container");
  if (!container) return;

  container.innerHTML = "";

  presets.forEach((preset, index) => {
    const presetElement = document.createElement("div");
    presetElement.className =
      "bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1 rounded-full text-xs flex items-center cursor-pointer transition";
    presetElement.innerHTML = `
            ${preset.name}
            <button class="ml-1 text-zinc-300 hover:text-white delete-preset" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
        `;

    presetElement.addEventListener("click", (e) => {
      if (!e.target.classList.contains("delete-preset")) {
        currentFilters = { ...preset.filters };
        applyCurrentFiltersToUI();
        updateInvestmentsList();
        showAlert(`Filtro "${preset.name}" aplicado!`, "success");
      }
    });

    container.appendChild(presetElement);
  });

  // Event delegation para botões de deletar preset
  container.addEventListener("click", (e) => {
    if (
      e.target.classList.contains("delete-preset") ||
      e.target.parentElement.classList.contains("delete-preset")
    ) {
      const button = e.target.classList.contains("delete-preset")
        ? e.target
        : e.target.parentElement;
      const index = parseInt(button.getAttribute("data-index"));
      deleteFilterPreset(index);
    }
  });

  // Mostrar/ocultar seção de presets
  const presetsSection = document.getElementById("filter-presets");
  if (presetsSection) {
    presetsSection.style.display = presets.length > 0 ? "block" : "none";
  }
}

function deleteFilterPreset(index) {
  const presets = JSON.parse(
    localStorage.getItem("investmentFilterPresets") || "[]"
  );
  presets.splice(index, 1);
  localStorage.setItem("investmentFilterPresets", JSON.stringify(presets));
  loadFilterPresets();
}

// Renderiza a tabela como uma lista de transações (visão padrão)
function renderTransactionView(filteredInvestments) {
  if (filteredInvestments.length === 0 && searchInput.value !== "") {
    investmentsTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="p-4 text-center text-gray-400">Nenhum investimento encontrado</td>
      </tr>
    `;
    return;
  }

  filteredInvestments.forEach((investment) => {
    const investedValue = investment.quantity * investment.price;
    const currentValue = investment.quantity * investment.currentValue;
    const profit = currentValue - investedValue;
    const profitPercentage = (profit / investedValue) * 100;

    let typeBadge = "";
    let badgeColor = "";

    switch (investment.type) {
      case "acao":
        typeBadge = "Ação";
        badgeColor = "bg-yellow-500 bg-opacity-20 text-yellow-400";
        break;
      case "fii":
        typeBadge = "FII";
        badgeColor = "bg-blue-500 bg-opacity-20 text-blue-400";
        break;
      case "renda-fixa":
        typeBadge = "Renda Fixa";
        badgeColor = "bg-green-500 bg-opacity-20 text-green-400";
        break;
      case "cripto":
        typeBadge = "Cripto";
        badgeColor = "bg-purple-500 bg-opacity-20 text-purple-400";
        break;
      case "etf":
        typeBadge = "ETF";
        badgeColor = "bg-indigo-500 bg-opacity-20 text-indigo-400";
        break;
    }

    const row = document.createElement("tr");
    row.className = "investment-row";
    row.innerHTML = `
        <td class="p-3">
          <div class="flex items-center">
            <div class="w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
              investment.type === "acao"
                ? "bg-yellow-500"
                : investment.type === "fii"
                ? "bg-blue-500"
                : investment.type === "renda-fixa"
                ? "bg-green-500"
                : investment.type === "cripto"
                ? "bg-purple-500"
                : "bg-indigo-500"
            }">
              <i class="fas ${
                investment.type === "acao"
                  ? "fa-chart-line"
                  : investment.type === "fii"
                  ? "fa-building"
                  : investment.type === "renda-fixa"
                  ? "fa-landmark"
                  : investment.type === "cripto"
                  ? "fa-coins"
                  : "fa-chart-pie"
              } text-white text-xs"></i>
            </div>
            <div>
              <p class="font-medium">${investment.name}</p>
            </div>
          </div>
        </td>
        <td class="p-3">
          <span class="px-2 py-1 ${badgeColor} rounded-full text-xs">${typeBadge}</span>
        </td>
        <td class="p-3 col-data"> ${(() =>
          new Date(investment.date).toLocaleDateString("pt-BR"))()}
        </td>
        <td class="p-3">${investment.quantity}</td>
        <td class="p-3">R$ ${investment.price.toFixed(2)}</td>
        <td class="p-3">R$ ${investedValue.toFixed(2)}</td>
        <td class="p-3 font-medium">R$ ${currentValue.toFixed(2)}</td>
        <td class="p-3">
          <span class="${
            profit >= 0 ? "text-green-500" : "text-red-500"
          } font-medium">${profit >= 0 ? "+" : ""}${profitPercentage.toFixed(
      2
    )}%</span>
        </td>
        <td class="p-3 col-acoes"> <div class="flex space-x-2">
            <button class="edit-btn text-gray-400 hover:text-green-500" data-id="${
              investment.id
            }">
              <i class="fas fa-edit"></i>
            </button>
            <button class="delete-btn text-gray-400 hover:text-red-500" data-id="${
              investment.id
            }">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
    `;

    investmentsTableBody.appendChild(row);
  });

  // Adiciona listeners aos botões (como antes)
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      editInvestment(id);
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      showDeleteModal(id);
    });
  });
}

// Agrupa os investimentos por nome
function groupInvestments(filteredList) {
  // 1. Agrupa usando reduce
  const groups = filteredList.reduce((acc, inv) => {
    const key = inv.name; // Agrupa pelo nome do ativo

    if (!acc[key]) {
      acc[key] = {
        name: inv.name,
        type: inv.type,
        currentValue: inv.currentValue, // Preço atual (o mesmo para todos)
        totalQuantity: 0,
        totalInvested: 0,
      };
    }

    acc[key].totalQuantity += inv.quantity;
    acc[key].totalInvested += inv.quantity * inv.price;

    return acc;
  }, {});

  // 2. Converte o objeto em array e calcula os totais
  return Object.values(groups).map((g) => {
    const totalCurrent = g.totalQuantity * g.currentValue;
    const averagePrice = g.totalInvested / g.totalQuantity;
    const profit = totalCurrent - g.totalInvested;
    const profitPercentage = (profit / g.totalInvested) * 100;

    return {
      ...g,
      totalCurrent,
      averagePrice,
      profit,
      profitPercentage,
    };
  });
}

// Renderiza a tabela com os dados agrupados
function renderGroupedView(groupedData) {
  if (groupedData.length === 0) {
    investmentsTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="p-4 text-center text-gray-400">Nenhum investimento encontrado</td>
      </tr>
    `;
    return;
  }

  groupedData.forEach((g) => {
    let typeBadge = "";
    let badgeColor = "";
    // (Copiamos o mesmo switch case)
    switch (g.type) {
      case "acao":
        typeBadge = "Ação";
        badgeColor = "bg-yellow-500 bg-opacity-20 text-yellow-400";
        break;
      case "fii":
        typeBadge = "FII";
        badgeColor = "bg-blue-500 bg-opacity-20 text-blue-400";
        break;
      case "renda-fixa":
        typeBadge = "Renda Fixa";
        badgeColor = "bg-green-500 bg-opacity-20 text-green-400";
        break;
      case "cripto":
        typeBadge = "Cripto";
        badgeColor = "bg-purple-500 bg-opacity-20 text-purple-400";
        break;
      case "etf":
        typeBadge = "ETF";
        badgeColor = "bg-indigo-500 bg-opacity-20 text-indigo-400";
        break;
    }

    const row = document.createElement("tr");
    row.className = "investment-row";
    // Note: As colunas 'Data' e 'Ações' foram removidas
    row.innerHTML = `
        <td class="p-3">
          <div class="flex items-center">
            <div class="w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
              g.type === "acao"
                ? "bg-yellow-500"
                : g.type === "fii"
                ? "bg-blue-500"
                : g.type === "renda-fixa"
                ? "bg-green-500"
                : g.type === "cripto"
                ? "bg-purple-500"
                : "bg-indigo-500"
            }">
              <i class="fas ${
                g.type === "acao"
                  ? "fa-chart-line"
                  : g.type === "fii"
                  ? "fa-building"
                  : g.type === "renda-fixa"
                  ? "fa-landmark"
                  : g.type === "cripto"
                  ? "fa-coins"
                  : "fa-chart-pie"
              } text-white text-xs"></i>
            </div>
            <div>
              <p class="font-medium">${g.name}</p>
            </div>
          </div>
        </td>
        <td class="p-3">
          <span class="px-2 py-1 ${badgeColor} rounded-full text-xs">${typeBadge}</span>
        </td>
        <td class="p-3">${g.totalQuantity.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 8,
        })}</td>
        <td class="p-3">R$ ${g.averagePrice.toFixed(2)}</td>
        <td class="p-3">R$ ${g.totalInvested.toFixed(2)}</td>
        <td class="p-3 font-medium">R$ ${g.totalCurrent.toFixed(2)}</td>
        <td class="p-3">
          <span class="${
            g.profit >= 0 ? "text-green-500" : "text-red-500"
          } font-medium">${
      g.profit >= 0 ? "+" : ""
    }${g.profitPercentage.toFixed(2)}%</span>
        </td>
    `;
    investmentsTableBody.appendChild(row);
  });
}

// Update stats
function updateStats() {
  let totalInvested = 0;
  let totalCurrent = 0;

  investments.forEach((investment) => {
    totalInvested += investment.quantity * investment.price;
    totalCurrent += investment.quantity * investment.currentValue;
  });

  // [NOVA FUNÇÃO CHAMADA AQUI]
  // Salva o total do portfólio para a página de aposentadoria
  savePortfolioSummary(totalCurrent);
  // [FIM DA ADIÇÃO]

  const totalProfit = totalCurrent - totalInvested;
  const profitPercentage =
    totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const totalPorcProfit = document.getElementById("porc-profit");
  const isPositive = profitPercentage >= 0;

  // 1️⃣ Escolhe ícone e cor
  const arrowIcon = isPositive
    ? '<i class="fas fa-arrow-up"></i>'
    : '<i class="fas fa-arrow-down"></i>';
  const colorClass = isPositive ? "text-green-500" : "text-red-500";

  // 2️⃣ Remove ambas as classes (caso já existam)
  totalPorcProfit.classList.remove("text-green-500", "text-red-500");

  // 3️⃣ Adiciona a classe correta
  totalPorcProfit.classList.add(colorClass);

  // 4️⃣ Preenche o conteúdo (usa innerHTML para incluir o <i>)
  totalPorcProfit.innerHTML = `
      ${arrowIcon}
      (${Math.abs(profitPercentage).toFixed(2)}%)
    `;

  totalValueEl.textContent = `R$ ${totalCurrent.toFixed(2)}`;
  totalInvestedEl.textContent = `R$ ${totalInvested.toFixed(2)}`;
  totalProfitEl.textContent = `R$ ${totalProfit.toFixed(2)}`;
  // totalPorcProfit.innerHTML = `${arrowIcon} (${Math.abs(profitPercentage).toFixed(2)}%)`; // Removido pois já foi setado acima
  totalAssetsEl.textContent = `${investments.length} ativo${
    investments.length !== 1 ? "s" : ""
  }`;

  updateChart();
}

async function savePortfolioSummary(totalValue) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const summaryRef = db
      .collection("users")
      .doc(user.uid)
      .collection("portfolioSummary")
      .doc("summary");
    await summaryRef.set(
      {
        totalPortfolioValue: totalValue,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Erro ao salvar sumário do portfólio:", error);
  }
}

// Initialize chart
function initChart() {
  const ctx = document.getElementById("performanceChart").getContext("2d");

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [], // vamos popular em updateChart()
      datasets: [], // idem
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: "#f4f4f5",
          },
        },
        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: "#18181b",
          titleColor: "#f4f4f5",
          bodyColor: "#e4e4e7",
          borderColor: "#3f3f46",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label(ctx) {
              return (
                ctx.dataset.label +
                ": R$ " +
                ctx.parsed.y.toLocaleString("pt-BR")
              );
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
          },
          ticks: {
            color: "#f4f4f5",
          },
        },
        y: {
          stacked: true,
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
          },
          ticks: {
            color: "#f4f4f5",
            callback(v) {
              return "R$ " + v.toLocaleString("pt-BR");
            },
          },
        },
      },
    },
  });

  updateChart();
}

// cores tailwind → hex
const COLOR_MAP = {
  acao: "#eab308", // yellow-500
  fii: "#3b82f6", // blue-500
  "renda-fixa": "#22c55e", // green-500
  cripto: "#a855f7", // purple-500
  etf: "#6366f1", // indigo-500
};

// <<< FUNÇÃO MODIFICADA para lidar com os períodos
function updateChart() {
  if (!chart) return;

  const now = new Date();
  let labels = [];
  let periodData = {}; // Estrutura para acumular valores por tipo e período

  // Define os rótulos e a lógica de agrupamento com base no período selecionado
  if (chartPeriod === "year") {
    const allMonths = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
    labels = allMonths.slice(0, now.getMonth() + 1);

    investments.forEach((inv) => {
      const invDate = new Date(inv.date);
      if (invDate.getFullYear() === now.getFullYear()) {
        const month = invDate.getMonth();
        const type = inv.type;
        if (!periodData[type])
          periodData[type] = new Array(labels.length).fill(0);
        periodData[type][month] += inv.quantity * inv.price;
      }
    });
  } else if (chartPeriod === "month") {
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    labels = Array.from({ length: daysInMonth }, (_, i) => i + 1); // Dias 1, 2, 3...

    investments.forEach((inv) => {
      const invDate = new Date(inv.date);
      if (
        invDate.getFullYear() === now.getFullYear() &&
        invDate.getMonth() === now.getMonth()
      ) {
        const day = invDate.getDate() - 1; // 0-indexed
        const type = inv.type;
        if (!periodData[type])
          periodData[type] = new Array(labels.length).fill(0);
        periodData[type][day] += inv.quantity * inv.price;
      }
    });
  } else if (chartPeriod === "5years") {
    const currentYear = now.getFullYear();
    labels = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i); // Últimos 5 anos

    investments.forEach((inv) => {
      const invDate = new Date(inv.date);
      const year = invDate.getFullYear();
      const yearIndex = labels.indexOf(year);

      if (yearIndex > -1) {
        const type = inv.type;
        if (!periodData[type])
          periodData[type] = new Array(labels.length).fill(0);
        periodData[type][yearIndex] += inv.quantity * inv.price;
      }
    });
  }

  // Monta os datasets a partir dos dados agrupados
  const datasets = Object.entries(periodData).map(([type, data]) => ({
    label:
      {
        acao: "Ações",
        fii: "FIIs",
        "renda-fixa": "Renda Fixa",
        cripto: "Cripto",
        etf: "ETF",
      }[type] || type,
    data,
    backgroundColor: COLOR_MAP[type] || "#888",
    borderRadius: 6,
  }));

  // Atualiza o gráfico
  chart.data.labels = labels;
  chart.data.datasets = datasets;
  chart.update();
}

// Show add investment modal
function showAddInvestmentModal() {
  document.getElementById("edit-id").value = "";
  document.getElementById("investment-form").reset();
  addInvestmentModal.classList.remove("hidden");
}

// Edit investment
function editInvestment(id) {
  showLoading();
  const investment = investments.find((i) => i.id === id);
  if (!investment) {
    hideLoading();
    return;
  }

  // Preenche o formulário com os dados do investimento
  document.getElementById("edit-id").value = investment.id;
  document.getElementById("investment-type").value = investment.type;
  document.getElementById("asset-name").value = investment.name;
  document.getElementById("date").value = investment.date;
  document.getElementById("quantity").value = investment.quantity;
  document.getElementById("price").value = investment.price;

  // A linha que tentava preencher 'current-value' foi REMOVIDA daqui.

  // Mostra o modal e esconde o loader
  addInvestmentModal.classList.remove("hidden");
  hideLoading();
}

// Show delete confirmation modal
function showDeleteModal(id) {
  document.getElementById("delete-id").value = id;
  deleteModal.classList.remove("hidden");
}

// Save investment
async function saveInvestment(e) {
  e.preventDefault();
  showLoading();

  // Coletamos os dados que AINDA existem no formulário
  const id = document.getElementById("edit-id").value;
  const type = document.getElementById("investment-type").value;
  const name = document.getElementById("asset-name").value;
  const date = document.getElementById("date").value;
  const quantity = parseFloat(document.getElementById("quantity").value);
  const price = parseFloat(document.getElementById("price").value);

  // Note que a linha 'const currentValue = ...' foi removida daqui.

  try {
    // 1. Busca o preço atual na API. Se falhar, usa o preço de compra como valor reserva.
    const fetchedCurrentValue = await ApiService.fetchCurrentPrice(
      name,
      type,
      price
    );

    // 2. Prepara os dados para salvar no Firestore
    const uid = auth.currentUser.uid;
    const data = {
      type,
      name,
      date,
      quantity,
      price,
      currentValue: fetchedCurrentValue, // Usa o valor obtido da API
      userId: uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    const userCol = db.collection("users").doc(uid).collection("investiments");

    if (id) {
      await userCol.doc(id).update(data);
      showAlert("Investimento atualizado com sucesso!", "success");
    } else {
      await userCol.add(data);
      showAlert("Investimento adicionado com sucesso!", "success");
    }

    addInvestmentModal.classList.add("hidden");
    investmentForm.reset();
  } catch (error) {
    // Este bloco 'catch' é onde o seu erro foi exibido
    console.error("Erro ao salvar investimento:", error);
    showAlert("Erro ao salvar investimento: " + error.message, "error");
  } finally {
    hideLoading();
  }
}
// Delete investment
async function deleteInvestment() {
  showLoading();

  try {
    const uid = auth.currentUser.uid;
    const id = document.getElementById("delete-id").value;
    const userCol = db.collection("users").doc(uid).collection("investiments");

    await userCol.doc(id).delete();

    // A atualização já é feita pelo onSnapshot
    // updateInvestmentsList();
    // updateStats();
    deleteModal.classList.add("hidden");
  } catch (error) {
    console.error("Erro ao deletar investimento:", error);
  } finally {
    hideLoading();
  }
}

// <<< NOVO: Função para atualizar o estilo (cores) dos botões de período
function updateChartButtons(activePeriod) {
  const buttons = {
    month: btnMonth,
    year: btnYear,
    "5years": btn5Years,
  };

  // Reseta todos os botões para o estilo inativo
  Object.values(buttons).forEach((button) => {
    button.classList.remove("bg-green-600", "hover:bg-green-500");
    button.classList.add("bg-zinc-700", "hover:bg-zinc-600");
  });

  // Aplica o estilo ativo ao botão selecionado
  const activeButton = buttons[activePeriod];
  if (activeButton) {
    activeButton.classList.remove("bg-zinc-700", "hover:bg-zinc-600");
    activeButton.classList.add("bg-green-600", "hover:bg-green-500");
  }
}

// Event Listeners
addInvestmentBtn.addEventListener("click", showAddInvestmentModal);
addFirstInvestmentBtn.addEventListener("click", showAddInvestmentModal);
closeModalBtn.addEventListener("click", () =>
  addInvestmentModal.classList.add("hidden")
);
cancelAddInvestmentBtn.addEventListener("click", () =>
  addInvestmentModal.classList.add("hidden")
);
investmentForm.addEventListener("submit", saveInvestment);
cancelDeleteBtn.addEventListener("click", () =>
  deleteModal.classList.add("hidden")
);
confirmDeleteBtn.addEventListener("click", deleteInvestment);

syncPricesBtn.addEventListener("click", refreshAllPrices);


// <<< NOVO: Listeners para os botões de período do gráfico
btnMonth.addEventListener("click", () => {
  chartPeriod = "month";
  updateChartButtons("month");
  updateChart();
});

btnYear.addEventListener("click", () => {
  chartPeriod = "year";
  updateChartButtons("year");
  updateChart();
});

btn5Years.addEventListener("click", () => {
  chartPeriod = "5years";
  updateChartButtons("5years");
  updateChart();
});

toggleFilterBtn.addEventListener('click', () => {
  const filterPanel = document.getElementById('filter-panel');
  if (filterPanel) {
    filterPanel.classList.toggle('hidden');
    // Opcional: mudar a cor do botão para indicar que está ativo
    toggleFilterBtn.classList.toggle('bg-zinc-700');
    toggleFilterBtn.classList.toggle('bg-green-600'); // Fica verde quando o filtro está aberto
  }
});

// Close modals when clicking outside
addInvestmentModal.addEventListener("click", (e) => {
  if (e.target === addInvestmentModal) {
    addInvestmentModal.classList.add("hidden");
  }
});

deleteModal.addEventListener("click", (e) => {
  if (e.target === deleteModal) {
    deleteModal.classList.add("hidden");
  }
});

// Search functionality
searchInput.addEventListener("input", (e) => {
  updateInvestmentsList(e.target.value);
});

function updateDistribution() {
  // 1) Mapeamento de cores (hex)
  const COLORS = {
    acao: "#f59e0b", // yellow-500
    fii: "#3b82f6", // blue-500
    "renda-fixa": "#16a34a", // green-600
    cripto: "#a855f7", // purple-500
    outros: "#94a3b8", // gray-400
  };

  // 2) Acumula valor investido por tipo
  const totals = investments.reduce((acc, inv) => {
    const invested = inv.quantity * inv.price;
    acc[inv.type] = (acc[inv.type] || 0) + invested;
    return acc;
  }, {});

  // 3) Total geral e cálculo das porcentagens arredondadas
  const grandTotal = Object.values(totals).reduce((sum, v) => sum + v, 0);
  if (grandTotal <= 0) return;

  const entries = Object.entries(totals).map(([type, val]) => ({
    type,
    value: val,
    rawPct: (val / grandTotal) * 100,
  }));
  let floorSum = 0;
  entries.forEach((e) => {
    e.intPct = Math.floor(e.rawPct);
    floorSum += e.intPct;
    e.remainder = e.rawPct - e.intPct;
  });
  let leftover = 100 - floorSum;
  entries
    .sort((a, b) => b.remainder - a.remainder)
    .forEach((e) => {
      if (leftover > 0) {
        e.intPct++;
        leftover--;
      }
    });

  // 4) Atualiza cada linha: apenas o % e a cor da bolinha
  // Esconde todos os itens da lista inicialmente
  document.querySelectorAll(".distribution [data-type]").forEach((el) => {
    el.style.display = "none";
  });

  // Mostra e atualiza apenas os que têm valor
  entries.forEach(({ type, intPct }) => {
    const row = document.querySelector(`.distribution [data-type="${type}"]`);
    if (!row) return;

    row.style.display = "flex"; // mostra o item

    row.querySelector(".percentage").textContent = `${intPct}%`;

    const dot = row.querySelector(".w-3.h-3.rounded-full");
    if (dot) {
      dot.style.backgroundColor = COLORS[type] || COLORS.outros;
    }
  });

  if (entries.length === 0) {
    document.querySelector(".distribution svg").style.display = "none";
    document.querySelector(".distribution p").style.display = "none";
    return;
  }

  // 5) Atualiza o anel como antes (mantendo a cor para o tipo principal)
  const main = entries.reduce(
    (m, e) => (e.value > m.value ? e : m),
    entries[0]
  );
  const mainPct = main.intPct;
  const circle = document.querySelector(".progress-ring__circle");
  const textEl = document.querySelector(".distribution svg text");
  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  circle.style.transition = "stroke-dashoffset 0.6s ease";
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = `${circumference * (1 - mainPct / 100)}`;
  circle.style.stroke = COLORS[main.type] || COLORS.outros;
  textEl.textContent = `${mainPct}%`;
}

async function refreshAllPrices() {
  // Seleciona os elementos do botão que vamos manipular
  const syncButton = document.getElementById("sync-prices-btn");
  const syncIcon = syncButton.querySelector("i");
  const syncText = syncButton.querySelector("span");

  // 1. Inicia o estado de "carregando"
  syncButton.disabled = true;
  syncButton.classList.add("opacity-75", "cursor-not-allowed");
  syncIcon.classList.add("fa-spin"); // Adiciona a animação de giro da Font Awesome
  syncText.textContent = "Sincronizando...";

  // O alerta de "info" é opcional, mas ajuda a dar um feedback maior
  showAlert("Iniciando sincronização de preços...", "info");

  const uid = auth.currentUser.uid;
  const collectionRef = db
    .collection("users")
    .doc(uid)
    .collection("investiments");

  // O bloco try...catch...finally é perfeito para isso
  try {
    const updatePromises = investments.map(async (inv) => {
      if (inv.type === "renda-fixa") {
        return Promise.resolve();
      }

      const newPrice = await ApiService.fetchCurrentPrice(
        inv.name,
        inv.type,
        inv.currentValue
      );

      if (newPrice !== inv.currentValue) {
        return collectionRef.doc(inv.id).update({
          currentValue: newPrice,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
      return Promise.resolve();
    });

    // Espera todas as atualizações terminarem
    await Promise.all(updatePromises);

    showAlert("Preços sincronizados com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao sincronizar preços:", error);
    showAlert("Ocorreu um erro durante a sincronização.", "error");
  } finally {
    // 3. Ao final (independente de sucesso ou erro), reverte o botão ao estado original
    syncButton.disabled = false;
    syncButton.classList.remove("opacity-75", "cursor-not-allowed");
    syncIcon.classList.remove("fa-spin"); // Remove a animação de giro
    syncText.textContent = "Sincronizar";
  }
}

const assetNameInput = document.getElementById("asset-name");
const investmentTypeInput = document.getElementById("investment-type");
const searchResultsContainer = document.getElementById("search-results");

let debounceTimer;

// Função Debounce: Evita que a API seja chamada a cada tecla pressionada.
// Ela espera o usuário parar de digitar por um tempo (delay) antes de executar a busca.
const debounce = (func, delay) => {
  return function (...args) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};

// Função que busca os ativos na API
const handleSearch = (query) => {
  if (query.length < 2) {
    searchResultsContainer.innerHTML = "";
    searchResultsContainer.classList.add("hidden");
    return;
  }

  const assetType = investmentTypeInput.value;
  let results = [];

  if (assetType === "acao" || assetType === "fii" || assetType === "etf") {
    const lowerCaseQuery = query.toLowerCase();
    // Filtra a lista local em vez de chamar a API
    results = allAvailableStocks.filter((item) =>
      item.toLowerCase().includes(lowerCaseQuery)
    );
  }
  // A busca de cripto não muda, pois a API da CoinGecko está funcionando
  else if (assetType === "cripto") {
    // Esta parte exigiria uma chamada à API da coingecko como antes,
    // mas vamos focar na solução da Brapi por enquanto.
  }

  // A função displayResults para a Brapi precisa de um pequeno ajuste
  displayLocalResults(results);
};

// Nova função de display para a lista local (um pouco mais simples)
const displayLocalResults = (results) => {
  searchResultsContainer.innerHTML = "";
  if (!results || results.length === 0) {
    searchResultsContainer.classList.add("hidden");
    return;
  }

  results.slice(0, 7).forEach((stockSymbol) => {
    const resultItem = document.createElement("div");
    resultItem.className =
      "py-2 px-4 hover:bg-zinc-500 cursor-pointer text-sm font-bold";
    resultItem.textContent = stockSymbol;

    resultItem.addEventListener("click", () => {
      assetNameInput.value = stockSymbol;
      searchResultsContainer.innerHTML = "";
      searchResultsContainer.classList.add("hidden");
    });

    searchResultsContainer.appendChild(resultItem);
  });

  searchResultsContainer.classList.remove("hidden");
};

// Adiciona o Event Listener ao campo de input com o debounce
assetNameInput.addEventListener(
  "input",
  debounce((e) => {
    handleSearch(e.target.value);
  }, 300)
); // Delay de 300ms

// Fecha a lista de resultados se o usuário clicar fora
document.addEventListener("click", (e) => {
  if (
    !assetNameInput.contains(e.target) &&
    !searchResultsContainer.contains(e.target)
  ) {
    searchResultsContainer.classList.add("hidden");
  }
});

// Adiciona CSS para melhorar a aparência dos filtros
const style = document.createElement("style");
style.textContent = `
    .filter-section {
        transition: all 0.3s ease;
    }
    
    #custom-date-filter {
        animation: fadeIn 0.3s ease;
    }
    
    #filter-presets {
        animation: fadeIn 0.3s ease;
    }
    
    .preset-item {
        transition: all 0.2s ease;
    }
    
    .preset-item:hover {
        transform: translateY(-1px);
    }
`;
document.head.appendChild(style);
