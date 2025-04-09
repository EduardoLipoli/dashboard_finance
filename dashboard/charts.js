// Função para filtrar o dashboard pelo mês clicado no gráfico
function filterByChartMonth(index) {
  const monthSelect = document.getElementById("monthFilter");
  if (!monthSelect) return;

  // Se o mês clicado já está selecionado, volta para "Todos"
  if (parseInt(monthSelect.value) === index) {
    monthSelect.value = "all";
  } else {
    monthSelect.value = index.toString();
  }

  filterByMonth();
}

// Gráfico de Dívidas do dia 01 vs dia 15
const debtsByDayCtx = document
  .getElementById("fixedVsInstallmentsChart")
  .getContext("2d");

const debtsByDayChart = new Chart(debtsByDayCtx, {
  type: "doughnut",
  data: {
    labels: ["Dívidas do dia 01", "Dívidas do dia 15"],
    datasets: [
      {
        data: [
          transactions
            .filter((t) => t.type === "Gasto" && t.datepay === "01")
            .reduce((sum, t) => sum + t.amount, 0),
          transactions
            .filter((t) => t.type === "Gasto" && t.datepay === "15")
            .reduce((sum, t) => sum + t.amount, 0),
        ],
        borderColor: ["#4CAF50", "#F44336"],
        backgroundColor: ["rgba(76, 175, 80, 0.2)", "rgba(244, 67, 54, 0.2)"],
      },
    ],
  },
  options: {
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => `R$ ${ctx.raw.toFixed(2)}`,
        },
      },
      datalabels: {
        formatter: (value, ctx) =>
          `R$ ${value.toFixed(2)} (${(
            (value /
              ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0)) *
            100
          ).toFixed(1)}%)`,
        color: "#fff",
        font: { size: 14 },
        anchor: "center",
        align: "center",
        offset: 10,
      },
    },
  },
  plugins: [ChartDataLabels],
});

// Gráfico de Dívidas por Categoria
const categoriesCtx = document
  .getElementById("categoriesChart")
  .getContext("2d");

const categoriesData = filteredTransactions.reduce((acc, t) => {
  if (t.type === "Gasto") {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
  }
  return acc;
}, {});

const categoriesChart = new Chart(categoriesCtx, {
  type: "bar",
  data: {
    labels: Object.keys(categoriesData),
    datasets: [
      {
        label: "Dívidas por Categoria (R$)",
        data: Object.values(categoriesData),
        borderWidth: 2,
        borderColor: "#bebebe",
        backgroundColor: "rgba(166, 166, 166, 0.2)",
      },
    ],
  },
  options: {
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = ctx.raw;
            return `R$ ${value.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}`; 
          },
        },
      },
      datalabels: {
        formatter: (value, ctx) => {
          const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b);
          const percentage = ((value / total) * 100).toFixed(1);
          return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${percentage}%)`; 
        },
        color: "#fff",
        font: { size: 14 },
        anchor: "center",
        align: "center",
        offset: 10,
      },
    },
  },
  plugins: [ChartDataLabels],
});


// Gráfico de Pagas vs Pendentes
const paidVsPendingCtx = document
  .getElementById("paidVsPendingChart")
  .getContext("2d");

const paidTransactions = transactions.filter((t) => t.isPaid).length;
const pendingTransactions = transactions.filter((t) => !t.isPaid).length;

const paidVsPendingChart = new Chart(paidVsPendingCtx, {
  type: "doughnut",
  data: {
    labels: ["Pagas", "Pendentes"],
    datasets: [
      {
        data: [paidTransactions, pendingTransactions],
        borderColor: ["#4CAF50", "#F44336"],
        backgroundColor: ["rgba(76, 175, 80, 0.2)", "rgba(244, 67, 54, 0.2)"],
      },
    ],
  },
  options: {
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.raw} transações`,
        },
      },
      datalabels: {
        formatter: (value, ctx) => `${value} (${((value / ctx.chart.data.datasets[0].data.reduce((a, b) => a + b)) * 100).toFixed(1)}%)`,
        color: "#fff",
        font: { size: 14 },
        anchor: "center",
        align: "center",
        offset: 10,
      },
    },
  },
  plugins: [ChartDataLabels],
});


// Gráfico de Receitas por Mês
const monthlyIncomeCtx = document
  .getElementById("monthlyIncomeChart")
  .getContext("2d");
const monthlyIncomeData = Array.from({ length: 12 }, (_, i) => {
  return transactions
    .filter((t) => t.type === "Ganho" && t.dueDate.getMonth() === i)
    .reduce((sum, t) => sum + t.amount, 0);
});

const monthlyIncomeChart = new Chart(monthlyIncomeCtx, {
  type: "bar",
  data: {
    labels: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"],
    datasets: [{
      label: "Receitas por Mês",
      data: monthlyIncomeData,
      borderWidth: 2,
      borderColor: "#4CAF50",
      backgroundColor: "rgba(76, 175, 80, 0.2)"
    }]
  },
  options: {
    // *** Aqui ***
    onClick: function(evt, activeEls) {
      if (activeEls.length) {
        const idx = activeEls[0].index;
        filterByChartMonth(idx);
      }
    },
    hover: {
      onHover: function(evt, activeEls) {
        evt.native.target.style.cursor = activeEls[0] ? 'pointer' : 'default';
      }
    },
    plugins: {
      legend: { position: "top" },
      tooltip: { callbacks: { label: ctx => `R$ ${ctx.raw.toFixed(2)}` } },
      datalabels: {
        anchor: "end",
        align: "end",
        formatter: val => `R$ ${val.toFixed(2)}`,
        color: "#fff",
        font: { size: 10 }
      }
    },
    scales: {
      x: { title: { display: true, text: "Mês" }, grid: { color: "rgba(255,255,255,0.1)" } },
      y: { title: { display: true, text: "Receitas (R$)" }, beginAtZero: true, grid: { color: "rgba(255,255,255,0.1)" } }
    }
  },
  plugins: [ChartDataLabels]
});
// Gráfico de Gastos por Mês
const monthlyExpensesCtx = document
  .getElementById("monthlyExpensesChart")
  .getContext("2d");

const monthlyExpensesData = Array.from({ length: 12 }, (_, i) => {
  return transactions
    .filter((t) => t.type === "Gasto" && t.dueDate.getMonth() === i)
    .reduce((sum, t) => sum + t.amount, 0);
});

const monthlyExpensesChart = new Chart(monthlyExpensesCtx, {
  type: "bar",
  data: {
    labels: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"],
    datasets: [{
      label: "Gastos por Mês",
      data: monthlyExpensesData,
      borderWidth: 2,
      borderColor: "#F44336",
      backgroundColor: "rgba(244, 67, 54, 0.2)"
    }]
  },
  options: {
    onClick: function(evt, activeEls) {
      if (activeEls.length) {
        const idx = activeEls[0].index;
        filterByChartMonth(idx);
      }
    },
    hover: {
      onHover: function(evt, activeEls) {
        evt.native.target.style.cursor = activeEls[0] ? 'pointer' : 'default';
      }
    },
    plugins: {
      legend: { position: "top" },
      tooltip: { callbacks: { label: ctx => `R$ ${ctx.raw.toFixed(2)}` } },
      datalabels: {
        anchor: "end",
        align: "end",
        formatter: val => `R$ ${val.toFixed(2)}`,
        color: "#fff",
        font: { size: 10 }
      }
    },
    scales: {
      x: { title: { display: true, text: "Mês" }, grid: { color: "rgba(255,255,255,0.1)" } },
      y: { title: { display: true, text: "Gastos (R$)" }, beginAtZero: true, grid: { color: "rgba(255,255,255,0.1)" } }
    }
  },
  plugins: [ChartDataLabels]
});
