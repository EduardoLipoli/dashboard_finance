// --- DECLARAÇÃO DE VARIÁVEIS GLOBAIS PARA OS GRÁFICOS ---
let debtsByDayChart;
let categoriesChart;
let paidVsPendingChart;
let monthlyIncomeChart;
let monthlyExpensesChart;
let investmentAllocationChart; // <<< ADICIONE ESTA LINHA
let portfolioEvolutionChart;   // <<< ADICIONE ESTA LINHA
let planningChart;

// --- FUNÇÕES AUXILIARES ---

// Função para filtrar o dashboard pela seleção do gráfico (mês, categoria, etc.)
function filterDashboardByChartSelection(type, value, isToggle = true) {
    const monthFilter = document.getElementById("monthFilter");
    const monthValue = monthFilter.value;

    if (type === 'category' && monthValue !== "all") {
        monthFilter.value = "all";
        if (typeof filterByMonth === 'function') {
            filterByMonth();
        }
    }

    if (type === 'category') {
        if (isToggle && window.currentCategoryFilter === value) {
            window.filteredTransactions = [...window.transactions];
            window.currentCategoryFilter = null;
            console.log("Filtro de categoria desativado:", value);
        } else {
            if (window.transactions) {
                window.filteredTransactions = window.transactions.filter(t => t.type === "Gasto" && t.category === value);
                window.currentCategoryFilter = value;
                console.log("Filtro de categoria ativado para:", value);
            } else {
                console.error("Variável 'transactions' não acessível globalmente em charts.js");
            }
        }
    }

    if (typeof calculateTotals === 'function' && typeof updateCharts === 'function') {
        calculateTotals();
        updateCharts();
    } else {
        console.error("As funções 'calculateTotals' ou 'updateCharts' não estão definidas ou acessíveis. Verifique a ordem de carregamento dos scripts.");
    }
}

// Função para filtrar o dashboard pelo mês clicado no gráfico
function filterByChartMonth(index) {
  const monthSelect = document.getElementById("monthFilter");
  if (!monthSelect) return;

  if (parseInt(monthSelect.value) === index) {
    monthSelect.value = "all";
  } else {
    monthSelect.value = index.toString();
  }

  if (typeof filterByMonth === 'function') {
      filterByMonth();
  } else {
      console.error("filterByMonth não está definido. Verifique a ordem de carregamento dos scripts.");
  }
}

// Função para criar gradiente (para cores nomeadas como 'green', 'red', 'blue')
function createGradient(ctx, color) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 400); // Gradiente vertical

  if (color === 'green') {
    gradient.addColorStop(0, 'rgba(34, 197, 94, 0.7)'); // green-500
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0.1)');
  } else if (color === 'red') {
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.7)'); // red-500
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.1)');
  } else if (color === 'blue') {
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.7)'); // blue-500
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
  }

  return gradient;
}

// Função genérica para criar gradiente a partir de uma cor hexadecimal (para barras)
function createGradientForBar(ctx, hexColor) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, hexColor + '33'); // Mais transparente no topo
    gradient.addColorStop(1, hexColor + 'FF'); // Cor sólida na base
    return gradient;
}

// Função para criar gradiente para fatias de doughnut (ajustada para mais suavidade)
function createGradientForDoughnutSlice(ctx, colorsArray) {
    return colorsArray.map(hexColor => {
        // Criamos um gradiente linear para simular um gradiente suave por fatia.
        // É uma abordagem simplificada, pois o gradiente radial pode ser mais complexo para controlar a direção por fatia.
        // Vai de uma cor semi-transparente para outra mais opaca, replicando a suavidade dos gráficos de barra.
        const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, ctx.canvas.height); // Gradiente diagonal/linear
        gradient.addColorStop(0, hexColor + 'B3'); // ~70% de opacidade (como nos gráficos de barra)
        gradient.addColorStop(1, hexColor + '1A'); // ~10% de opacidade (como nos gráficos de barra)
        return gradient;
    });
}


// --- INICIALIZAÇÃO DOS GRÁFICOS ---
document.addEventListener("DOMContentLoaded", function() {

      const investmentAllocationCtx = document.getElementById("investmentAllocationChart")?.getContext("2d");
    if (investmentAllocationCtx) {
        const investmentColors = ['#facc15', '#3b82f6', '#22c55e', '#a855f7', '#6366f1']; // Amarelo, Azul, Verde, Roxo, Indigo
        investmentAllocationChart = new Chart(investmentAllocationCtx, {
            type: 'doughnut',
            data: {
                labels: [], // Ex: 'Ações', 'FIIs'
                datasets: [{
                    data: [],
                    borderColor: investmentColors,
                    // Usando a mesma função de gradiente dos seus outros gráficos de doughnut
                    backgroundColor: createGradientForDoughnutSlice(investmentAllocationCtx, investmentColors),
                }]
            },
            // <<< OPÇÕES COPIADAS DOS SEUS GRÁFICOS EXISTENTES PARA MANTER O ESTILO >>>
            options: {
              
                plugins: {
                    legend: { position: "top", labels: { color: '#a1a1aa' } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${formatarMoeda(ctx.raw)}`
                        },
                        backgroundColor: 'rgba(24, 24, 27, 0.9)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        titleColor: '#fff',
                        bodyColor: '#fff',
                    },
                    datalabels: {
                        formatter: (value, ctx) => {
                            // Calcula a porcentagem do total
                            const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${percentage}%`; // Mostra apenas a porcentagem
                        },
                        color: "#fff",
                        font: { size: 14, weight: 'bold' },
                        anchor: "center",
                        align: "center",
                    },
                },
            },
            plugins: [ChartDataLabels], // Habilita os rótulos de dados
        });
    }

    // Gráfico de Evolução dos Aportes (Barra) - ESTILO ATUALIZADO
    const portfolioEvolutionCtx = document.getElementById("portfolioEvolutionChart")?.getContext("2d");
    if (portfolioEvolutionCtx) {
        portfolioEvolutionChart = new Chart(portfolioEvolutionCtx, {
            type: 'bar',
            data: {
                labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
                datasets: [{
                    label: 'Valor Aportado no Mês',
                    data: [],
                    borderWidth: 0,
                    borderRadius: 6,
                    backgroundColor: createGradient(portfolioEvolutionCtx, 'blue'), // Usando o gradiente azul
                    hoverBackgroundColor: 'rgba(59, 130, 246, 0.8)',
                }]
            },
            // <<< OPÇÕES COPIADAS DOS SEUS GRÁFICOS EXISTENTES PARA MANTER O ESTILO >>>
            options: {
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `R$ ${ctx.raw.toFixed(2)}`
                        },
                        backgroundColor: 'rgba(24, 24, 27, 0.9)',
                        padding: 12,
                        displayColors: false,
                        borderColor: 'rgba(59, 130, 246, 0.5)',
                        borderWidth: 1,
                        titleColor: '#fff',
                        bodyColor: '#fff',
                    },
                    datalabels: {
                        anchor: "end",
                        align: "end",
                        formatter: val => val > 0 ? formatarMoeda(val) : '', // Usa a função formatarMoeda
                        color: "#fff",
                        font: { size: 9, weight: 'bold' },
                        textStrokeColor: '#000',
                        textStrokeWidth: 2,
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#a1a1aa' }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: "rgba(255,255,255,0.05)" },
                        ticks: {
                            color: '#a1a1aa',
                            callback: (value) => formatarMoeda(value) // Usa a função formatarMoeda
                        }
                    }
                },
                animation: {
                    duration: 2000,
                    easing: 'easeOutQuart'
                }
            },
            plugins: [ChartDataLabels], // Habilita os rótulos de dados
        });
    }

  // Gráfico de Dívidas do dia 01 vs dia 15 (Doughnut com Gradiente Suave)
  const debtsByDayCtx = document.getElementById("fixedVsInstallmentsChart")?.getContext("2d");
  if (debtsByDayCtx) {
    const debtsColors = ["#22c55e", "#ef4444"]; // green-500, red-500
    debtsByDayChart = new Chart(debtsByDayCtx, {
      type: "doughnut",
      data: {
        labels: ["Dívidas do dia 01", "Dívidas do dia 15"],
        datasets: [
          {
            data: [0, 0],
            borderColor: debtsColors,
            backgroundColor: createGradientForDoughnutSlice(debtsByDayCtx, debtsColors), // Usando a nova função
          },
        ],
      },
      options: {
        plugins: {
          legend: { position: "top", labels: { color: '#a1a1aa' } },
          tooltip: {
            callbacks: {
              label: (ctx) => `R$ ${ctx.raw.toFixed(2)}`,
            },
            backgroundColor: 'rgba(24, 24, 27, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: '#fff',
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
  }

  // Gráfico de Dívidas por Categoria (BARRA com GRADIENTE - SEM CLIQUE para filtro)
  const categoriesCtx = document.getElementById("categoriesChart")?.getContext("2d");
  if (categoriesCtx) {
    const categoryColorsPalette = [
      '#4ade80', '#3b82f6', '#facc15', '#ef4444', '#a855f7', '#ec4899',
      '#6ee7b7', '#8b5cf6', '#f97316', '#6b7280', '#14b8a6', '#f43f5e',
      '#c084fc', '#fde047', '#fbbf24', '#f472b6'
    ];

    categoriesChart = new Chart(categoriesCtx, {
      type: "bar",
      data: {
        labels: [],
        datasets: [{
          label: "Dívidas por Categoria (R$)",
          data: [],
          borderWidth: 0,
          borderRadius: 6,
          backgroundColor: categoryColorsPalette.map(colorHex => {
            return createGradientForBar(categoriesCtx, colorHex);
          }),
          hoverBackgroundColor: categoryColorsPalette.map(color => {
            let c = color.substring(1);
            let rgb = parseInt(c, 16);
            let r = (rgb >> 16) & 0xff;
            let g = (rgb >> 8) & 0xff;
            let b = (rgb >> 0) & 0xff;
            return `rgba(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)}, 0.9)`;
          }),
        }]
      },
      options: {
        indexAxis: 'y',
        // 'onClick' removido daqui conforme solicitado
        hover: {
          onHover: function(evt, activeEls) {
            evt.native.target.style.cursor = activeEls[0] ? 'pointer' : 'default';
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = ctx.raw;
                return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
              },
            },
            backgroundColor: 'rgba(24, 24, 27, 0.9)',
            padding: 12,
            displayColors: true,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: '#fff',
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            formatter: (value, ctx) => {
              const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${percentage}%`;
            },
            color: "#fff",
            font: {
              size: 10,
              weight: 'bold'
            },
            textStrokeColor: '#000',
            textStrokeWidth: 2,
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            ticks: {
              color: '#a1a1aa'
            }
          },
          y: {
            grid: {
              display: false
            },
            ticks: {
              color: '#a1a1aa'
            }
          }
        },
        animation: {
          duration: 2000,
          easing: 'easeOutQuart'
        }
      },
      plugins: [ChartDataLabels]
    });
  }

  // Gráfico de Pagas vs Pendentes (Doughnut com Gradiente Suave)
  const paidVsPendingCtx = document.getElementById("paidVsPendingChart")?.getContext("2d");
  if (paidVsPendingCtx) {
    const paidPendingColors = ["#22c55e", "#ef4444"]; // green-500, red-500
    paidVsPendingChart = new Chart(paidVsPendingCtx, {
      type: "doughnut",
      data: {
        labels: ["Pagas", "Pendentes"],
        datasets: [
          {
            data: [0, 0], // Inicia vazio
            borderColor: paidPendingColors,
            backgroundColor: createGradientForDoughnutSlice(paidVsPendingCtx, paidPendingColors), // Usando a nova função
          },
        ],
      },
      options: {
        plugins: {
          legend: { position: "top", labels: { color: '#a1a1aa' } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw} transações`,
            },
            backgroundColor: 'rgba(24, 24, 27, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: '#fff',
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
  }

  // Gráfico de Receitas por Mês (BARRA com GRADIENTE e FILTRO por CLIQUE no Mês)
  const monthlyIncomeCtx = document.getElementById("monthlyIncomeChart")?.getContext("2d");
  if (monthlyIncomeCtx) {
    monthlyIncomeChart = new Chart(monthlyIncomeCtx, {
      type: "bar",
      data: {
        labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
        datasets: [{
          label: "Receitas por Mês",
          data: Array(12).fill(0), // Inicia com zeros
          borderWidth: 0,
          borderRadius: 6,
          backgroundColor: createGradient(monthlyIncomeCtx, 'green'),
          hoverBackgroundColor: 'rgba(34, 197, 94, 0.8)',
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
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: ctx => `R$ ${ctx.raw.toFixed(2)}`
            },
            backgroundColor: 'rgba(24, 24, 27, 0.9)',
            titleFont: {
              size: 14
            },
            bodyFont: {
              size: 14
            },
            padding: 12,
            displayColors: false,
            borderColor: 'rgba(34, 197, 94, 0.5)',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: '#fff',
          },
          datalabels: {
            anchor: "end",
            align: "end",
            formatter: val => `R$ ${val > 0 ? val.toFixed(2) : ''}`,
            color: "#fff",
            font: {
              size: 9,
              weight: 'bold'
            },
            textStrokeColor: '#000',
            textStrokeWidth: 2,
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#a1a1aa'
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(255,255,255,0.05)"
            },
            ticks: {
              color: '#a1a1aa',
              callback: function(value) {
                return 'R$ ' + value;
              }
            }
          }
        },
        animation: {
          duration: 2000,
          easing: 'easeOutQuart'
        }
      },
      plugins: [ChartDataLabels]
    });
  }

  // Gráfico de Gastos por Mês (BARRA com GRADIENTE e FILTRO por CLIQUE no Mês)
  const monthlyExpensesCtx = document.getElementById("monthlyExpensesChart")?.getContext("2d");
  if (monthlyExpensesCtx) {
    monthlyExpensesChart = new Chart(monthlyExpensesCtx, {
      type: "bar",
      data: {
        labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
        datasets: [{
          label: "Gastos por Mês",
          data: Array(12).fill(0), // Inicia com zeros
          borderWidth: 0,
          borderRadius: 6,
          backgroundColor: createGradient(monthlyExpensesCtx, 'red'),
          hoverBackgroundColor: 'rgba(239, 68, 68, 0.8)',
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
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: ctx => `R$ ${ctx.raw.toFixed(2)}`
            },
            backgroundColor: 'rgba(24, 24, 27, 0.9)',
            titleFont: {
              size: 14
            },
            bodyFont: {
              size: 14
            },
            padding: 12,
            displayColors: false,
            borderColor: 'rgba(239, 68, 68, 0.5)',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: '#fff',
          },
          datalabels: {
            anchor: "end",
            align: "end",
            formatter: val => `R$ ${val > 0 ? val.toFixed(2) : ''}`,
            color: "#fff",
            font: {
              size: 9,
              weight: 'bold'
            },
            textStrokeColor: '#000',
            textStrokeWidth: 2,
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#a1a1aa'
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(255,255,255,0.05)"
            },
            ticks: {
              color: '#a1a1aa',
              callback: function(value) {
                return 'R$ ' + value;
              }
            }
          }
        },
        animation: {
          duration: 2000,
          easing: 'easeOutQuart'
        }
      },
      plugins: [ChartDataLabels]
    });
  }

  // --- [INÍCIO DO NOVO GRÁFICO] ---
  const planningCtx = document.getElementById("planningChart")?.getContext("2d");
  if (planningCtx) {
    // Usamos 'window' para garantir que seja globalmente acessível por dashboard.js
    window.planningChart = new Chart(planningCtx, {
      type: 'bar',
      data: {
        labels: [], // Ex: 'Alimentação', 'Transporte'
        datasets: [
          {
            label: 'Planejado',
            data: [],
            backgroundColor: 'rgba(34, 197, 94, 0.6)', // Verde
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Realizado',
            data: [],
            backgroundColor: 'rgba(59, 130, 246, 0.6)', // Azul
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        maintainAspectRatio: false, // Importante para o wrapper de altura
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#a1a1aa',
              callback: (value) => formatarMoeda(value) // Usa sua função global
            },
            grid: { color: "rgba(255,255,255,0.05)" }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#a1a1aa' }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#a1a1aa' }
          },
          tooltip: {
            backgroundColor: 'rgba(24, 24, 27, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: '#fff',
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) { label += ': '; }
                label += formatarMoeda(context.raw);
                return label;
              }
            }
          },
          datalabels: { // Desabilitado para não poluir
            display: false
          }
        }
      },
      plugins: [ChartDataLabels]
    });
  }

});

