// retirement.js

// Inicialização do Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Variáveis de estado globais
let retirementChart = null;
let currentPlan = null;
let originalChartData = null;

// Funções de utilidade
function formatCurrency(value) {
    const numberValue = Number(value) || 0;
    return numberValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value) {
    return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showAlert(message, type = "success") {
    const alertContainer = document.getElementById("alert-container");
    if (!alertContainer) return;
    
    const alert = document.createElement("div");
    alert.className = `fade-in mb-3 px-4 py-3 rounded-lg shadow-lg flex items-center justify-between ${type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-green-500'}`;
    
    alert.innerHTML = `
        <div class="flex items-center">
            <span class="font-medium">${message}</span>
        </div>
        <button class="ml-4 text-lg font-bold focus:outline-none">&times;</button>
    `;
    
    alert.querySelector("button").addEventListener("click", () => {
        alert.remove();
    });
    
    setTimeout(() => {
        if (alert.parentNode) alert.remove();
    }, 5000);
    
    alertContainer.appendChild(alert);
}

// Elementos do DOM
const retirementForm = document.getElementById('retirement-form');
const totalNeededEl = document.getElementById('total-needed');
const monthlyInvestmentEl = document.getElementById('monthly-investment');
const progressEl = document.getElementById('progress');
const progressText = document.getElementById('progress-text');
const progressRing = document.getElementById('progress-ring');
const planDetailsEl = document.getElementById('plan-details');
const retirementChartCtx = document.getElementById('retirement-chart').getContext('2d');
const currentSavingsInput = document.getElementById('current-savings');
const refreshSavingsBtn = document.getElementById('refresh-savings');
const recalculateBtn = document.getElementById('recalculate-btn');
const refreshDataBtn = document.getElementById('refresh-data-btn');

// Funções de autenticação
function logout() {
    auth.signOut().then(() => {
        window.location.href = "/index.html";
    }).catch((error) => {
        console.error("Erro ao deslogar:", error);
        showAlert("Erro ao deslogar: " + error.message, "error");
    });
}

// Funções de busca de dados
async function getCurrentPortfolioValue() {
    const user = auth.currentUser;
    if (!user) return 0;
    try {
        const snapshot = await db.collection('users').doc(user.uid).collection('investiments').get();
        if (snapshot.empty) return 0;
        return snapshot.docs.reduce((total, doc) => {
            const data = doc.data();
            return total + ((data.quantity || 0) * (data.currentValue || 0));
        }, 0);
    } catch (error) {
        console.error('Erro ao buscar o valor da carteira:', error);
        return 0;
    }
}

async function getTotalMonthlyIncome() {
    const user = auth.currentUser;
    if (!user) return 0;
    try {
        const snapshot = await db.collection('users').doc(user.uid).collection('transactions')
            .where('type', '==', 'Ganho')
            .get();
        if (snapshot.empty) return 0;
        
        let monthlyIncome = 0;
        snapshot.docs.forEach(doc => {
            monthlyIncome += doc.data().amount || 0;
        });
        return monthlyIncome;
    } catch (error) {
        console.error('Erro ao calcular renda mensal:', error);
        return 0;
    }
}

async function getTotalMonthlyExpenses() {
    const user = auth.currentUser;
    if (!user) return 0;
    try {
        const snapshot = await db.collection('users').doc(user.uid).collection('transactions')
            .where('type', '==', 'Gasto')
            .get();
        if (snapshot.empty) return 0;
        
        let monthlyExpense = 0;
        snapshot.docs.forEach(doc => {
            monthlyExpense += doc.data().amount || 0;
        });
        return monthlyExpense;
    } catch (error) {
        console.error('Erro ao calcular despesa mensal:', error);
        return 0;
    }
}

async function getMonthlyGoalContributions() {
    const user = auth.currentUser;
    if (!user) return 0;
    try {
        const snapshot = await db.collection('users').doc(user.uid).collection('goals').get();
        if (snapshot.empty) return 0;
        
        let totalMonthlyContribution = 0;
        const today = new Date();
        
        snapshot.docs.forEach(doc => {
            const goal = doc.data();
            if (goal.deadline) {
                const deadline = new Date(goal.deadline);
                if (deadline > today) {
                    const monthsLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24 * 30));
                    const remainingAmount = goal.amount - (goal.currentAmount || 0);
                    if (monthsLeft > 0 && remainingAmount > 0) {
                        totalMonthlyContribution += remainingAmount / monthsLeft;
                    }
                }
            }
        });
        return totalMonthlyContribution;
    } catch (error) {
        console.error('Erro ao calcular contribuição para metas:', error);
        return 0;
    }
}

async function getGoalsForChart(currentAge) {
    const user = auth.currentUser;
    if (!user) return [];
    try {
        const snapshot = await db.collection('users').doc(user.uid).collection('goals').get();
        if (snapshot.empty) return [];
        
        const goals = [];
        const today = new Date();
        
        snapshot.docs.forEach(doc => {
            const goalData = doc.data();
            if (goalData.deadline) {
                const deadlineDate = new Date(goalData.deadline);
                if (deadlineDate >= today) {
                    const yearsFromNow = deadlineDate.getFullYear() - today.getFullYear();
                    goals.push({
                        age: currentAge + yearsFromNow,
                        amount: goalData.amount,
                        name: goalData.name,
                    });
                }
            }
        });
        return goals;
    } catch (error) {
        console.error('Erro ao buscar metas para o gráfico:', error);
        return [];
    }
}

// Lógica de cálculo financeiro
function calculateRetirementPlan(params, goals = []) {
    const { currentAge, retirementAge, monthlyIncome, currentSavings, annualReturn, inflation, monthlyInvestment } = params;
    
    const yearsToRetirement = retirementAge - currentAge;
    const postRetirementYears = 30;
    const postRetirementReturn = 0.04; // Rendimento conservador na aposentadoria
    
    if (yearsToRetirement <= 0) return null;
    
    const annualIncome = monthlyIncome * 12;
    const realReturn = (1 + annualReturn / 100) / (1 + inflation / 100) - 1;
    if (realReturn <= 0) return null;
    
    // Cálculo do valor necessário para aposentadoria
    const totalNeeded = annualIncome / realReturn;
    const monthlyReturn = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
    const monthsToRetirement = yearsToRetirement * 12;
    const futureValueFactor = Math.pow(1 + monthlyReturn, monthsToRetirement);
    const monthlyContribution = Math.max(0, (totalNeeded - currentSavings * futureValueFactor) * (monthlyReturn / (futureValueFactor - 1)));
    
    const labels = [];
    const projectedPatrimony = [];
    const principalInvested = [];
    const goalEvents = [];
    
    let accumulatedValue = currentSavings;
    let principalAccumulated = currentSavings;
    
    // Fase de acumulação
    for (let i = 0; i < yearsToRetirement; i++) {
        const age = currentAge + i;
        labels.push(age);
        
        // Contribuição anual
        const annualContribution = monthlyInvestment * 12;
        principalAccumulated += annualContribution;
        principalInvested.push(principalAccumulated);
        
        // Rendimento
        accumulatedValue = (accumulatedValue + annualContribution) * (1 + annualReturn / 100);
        
        // Verificar metas deste ano
        const goalsThisYear = goals.filter(g => g.age === age);
        if (goalsThisYear.length > 0) {
            goalsThisYear.forEach(goal => {
                goalEvents.push({
                    x: age,
                    y: accumulatedValue,
                    name: goal.name,
                    amount: goal.amount
                });
                accumulatedValue -= goal.amount;
            });
        }
        
        projectedPatrimony.push(accumulatedValue);
    }
    
    // Fase de desacumulação (aposentadoria)
    for (let i = 0; i < postRetirementYears; i++) {
        const age = retirementAge + i;
        labels.push(age);
        principalInvested.push(null);
        
        accumulatedValue = (accumulatedValue - annualIncome) * (1 + postRetirementReturn);
        projectedPatrimony.push(Math.max(0, accumulatedValue));
    }
    
    return {
        ...params,
        totalNeeded,
        monthlyContribution,
        progress: totalNeeded > 0 ? Math.min(100, (currentSavings / totalNeeded) * 100) : 0,
        projection: {
            labels,
            projectedPatrimony,
            principalInvested,
            goalEvents
        }
    };
}

// Atualização da interface
function updateProgressRing(progress) {
    const progressValue = Math.min(100, Math.max(0, progress));
    const circumference = 157; // 2 * π * r (r=25)
    const offset = circumference - (progressValue / 100) * circumference;
    
    if (progressRing) {
        progressRing.style.strokeDashoffset = offset;
    }
    if (progressText) {
        progressText.textContent = `${Math.round(progressValue)}%`;
    }
}

function updateChart(plan) {
    if (!plan || !plan.projection) return;
    
    const { labels, projectedPatrimony, principalInvested, goalEvents } = plan.projection;
    const retirementAge = plan.retirementAge;
    
    // Salvar dados originais para filtragem
    if (!originalChartData) {
        originalChartData = {
            labels: [...labels],
            datasets: [{
                data: [...projectedPatrimony]
            }, {
                data: [...principalInvested]
            }, {
                data: [...goalEvents]
            }]
        };
    }
    
    const datasets = [
        {
            label: 'Patrimônio Total',
            data: projectedPatrimony,
            type: 'line',
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            pointRadius: 0,
            fill: true,
            tension: 0.3
        },
        {
            label: 'Principal Investido',
            data: principalInvested,
            type: 'line',
            borderColor: '#3B82F6',
            borderWidth: 2,
            pointRadius: 0,
            borderDash: [5, 5],
            tension: 0.3
        },
        {
            label: 'Metas Financeiras',
            data: goalEvents,
            type: 'scatter',
            backgroundColor: 'rgba(139, 92, 246, 0.8)',
            pointStyle: 'circle',
            pointRadius: 8,
            pointHoverRadius: 10
        }
    ];
    
    // Linha de aposentadoria
    const retirementIndex = labels.indexOf(retirementAge);
    const retirementValue = projectedPatrimony[retirementIndex];
    
    const annotations = retirementValue ? {
        annotations: {
            retirementLine: {
                type: 'line',
                mode: 'vertical',
                scaleID: 'x',
                value: retirementAge,
                borderColor: 'rgba(239, 68, 68, 0.7)',
                borderWidth: 2,
                label: {
                    display: true,
                    content: 'Aposentadoria',
                    position: 'top',
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                }
            }
        }
    } : {};
    
    if (retirementChart) {
        retirementChart.data.labels = labels;
        retirementChart.data.datasets = datasets;
        retirementChart.options.plugins.annotation = annotations;
        retirementChart.update();
    } else {
        retirementChart = new Chart(retirementChartCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#f4f4f5',
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(39, 39, 42, 0.9)',
                        titleColor: '#f4f4f5',
                        bodyColor: '#f4f4f5',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (context.dataset.label === 'Metas Financeiras') {
                                    const goal = context.raw;
                                    return `${goal.name}: - ${formatCurrency(goal.amount)}`;
                                }
                                return `${label}: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    },
                    annotation: annotations
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Idade',
                            color: '#a1a1aa',
                            font: {
                                size: 13,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#d4d4d8'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Patrimônio (R$)',
                            color: '#a1a1aa',
                            font: {
                                size: 13,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#d4d4d8',
                            callback: value => formatCurrency(value)
                        }
                    }
                }
            }
        });
    }
}

function updatePlanDetails(plan) {
    if (!plan || !plan.projection) {
        planDetailsEl.innerHTML = '<tr><td colspan="5" class="text-center py-4">Sem dados para exibir.</td></tr>';
        return;
    }
    
    const { labels, projectedPatrimony, principalInvested } = plan.projection;
    const retirementIndex = labels.indexOf(plan.retirementAge);
    const tableRows = [];
    
    for (let i = 0; i < retirementIndex; i++) {
        const age = labels[i];
        const value = projectedPatrimony[i];
        const principal = principalInvested[i];
        const lastValue = i > 0 ? projectedPatrimony[i-1] : plan.currentSavings;
        const lastPrincipal = i > 0 ? principalInvested[i-1] : plan.currentSavings;
        
        const contribution = principal - lastPrincipal;
        const interest = value - lastValue - contribution;
        
        tableRows.push(`
            <tr class="hover:bg-zinc-700/50">
                <td class="px-4 py-3">${i + 1}</td>
                <td class="px-4 py-3">${age}</td>
                <td class="px-4 py-3 text-right font-medium">${formatCurrency(value)}</td>
                <td class="px-4 py-3 text-right text-green-400">${formatCurrency(contribution)}</td>
                <td class="px-4 py-3 text-right text-blue-400">${formatCurrency(interest)}</td>
            </tr>
        `);
    }
    
    planDetailsEl.innerHTML = tableRows.join('');
}

function displayRetirementPlan(plan) {
    if (!plan) return;
    
    totalNeededEl.textContent = formatCurrency(plan.totalNeeded);
    monthlyInvestmentEl.textContent = formatCurrency(plan.monthlyContribution);
    progressEl.textContent = `${Math.round(plan.progress)}%`;
    updateProgressRing(plan.progress);
    
    updateChart(plan);
    updatePlanDetails(plan);
    
    currentPlan = plan;
}

async function refreshFinancialSummary() {
    try {
        const [monthlyIncome, monthlyExpenses, monthlyGoals] = await Promise.all([
            getTotalMonthlyIncome(),
            getTotalMonthlyExpenses(),
            getMonthlyGoalContributions()
        ]);
        
        const availableForRetirement = Math.max(0, monthlyIncome - monthlyExpenses - monthlyGoals);
        
        document.getElementById('monthly-income-summary').textContent = formatCurrency(monthlyIncome);
        document.getElementById('monthly-expenses-summary').textContent = formatCurrency(monthlyExpenses);
        document.getElementById('monthly-goals-summary').textContent = formatCurrency(monthlyGoals);
        document.getElementById('monthly-investment-display').textContent = formatCurrency(availableForRetirement);
        document.getElementById('monthly-investment-input').value = availableForRetirement;
        
        return availableForRetirement;
    } catch (error) {
        console.error("Erro ao atualizar resumo financeiro:", error);
        showAlert("Erro ao carregar dados financeiros", "error");
        return 0;
    }
}

async function refreshCurrentSavings() {
    try {
        const savings = await getCurrentPortfolioValue();
        currentSavingsInput.value = savings.toFixed(2);
        return savings;
    } catch (error) {
        console.error("Erro ao atualizar valor acumulado:", error);
        showAlert("Erro ao carregar valor dos investimentos", "error");
        return 0;
    }
}

async function recalculatePlan() {
    const currentAge = parseInt(document.getElementById('current-age').value) || 30;
    const retirementAge = parseInt(document.getElementById('retirement-age').value) || 65;
    const monthlyIncome = parseFloat(document.getElementById('monthly-income').value) || 10000;
    const currentSavings = parseFloat(currentSavingsInput.value) || 0;
    const annualReturn = parseFloat(document.getElementById('annual-return').value) || 7;
    const inflation = parseFloat(document.getElementById('inflation').value) || 4;
    const monthlyInvestment = parseFloat(document.getElementById('monthly-investment-input').value) || 0;
    
    const goals = await getGoalsForChart(currentAge);
    const planParams = {
        currentAge,
        retirementAge,
        monthlyIncome,
        currentSavings,
        annualReturn,
        inflation,
        monthlyInvestment
    };
    
    const newPlan = calculateRetirementPlan(planParams, goals);
    
    if (newPlan) {
        displayRetirementPlan(newPlan);
        showAlert("Plano recalculado com sucesso!");
    } else {
        showAlert("Erro ao calcular o plano. Verifique os valores.", "error");
    }
}

async function savePlan() {
    if (!currentPlan || !auth.currentUser) return;
    
    try {
        const planData = {
            currentAge: currentPlan.currentAge,
            retirementAge: currentPlan.retirementAge,
            monthlyIncome: currentPlan.monthlyIncome,
            currentSavings: currentPlan.currentSavings,
            annualReturn: currentPlan.annualReturn,
            inflation: currentPlan.inflation,
            lastUpdated: new Date()
        };
        
        await db.collection('users').doc(auth.currentUser.uid).collection('retirementPlans').doc('current').set(planData);
        showAlert("Plano salvo com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar plano:", error);
        showAlert("Erro ao salvar o plano: " + error.message, "error");
    }
}

function filterChartByYears(years) {
    if (!retirementChart || !originalChartData) return;
    
    if (years === 'max') {
        retirementChart.data.labels = [...originalChartData.labels];
        retirementChart.data.datasets[0].data = [...originalChartData.datasets[0].data];
        retirementChart.data.datasets[1].data = [...originalChartData.datasets[1].data];
        retirementChart.data.datasets[2].data = [...originalChartData.datasets[2].data];
    } else {
        const numYears = parseInt(years);
        const retirementIndex = originalChartData.labels.indexOf(currentPlan.retirementAge);
        const endIndex = Math.min(retirementIndex + numYears, originalChartData.labels.length);
        
        retirementChart.data.labels = originalChartData.labels.slice(0, endIndex);
        retirementChart.data.datasets[0].data = originalChartData.datasets[0].data.slice(0, endIndex);
        retirementChart.data.datasets[1].data = originalChartData.datasets[1].data.slice(0, endIndex);
        
        // Filtrar metas
        retirementChart.data.datasets[2].data = originalChartData.datasets[2].data.filter(
            point => point.x <= originalChartData.labels[endIndex - 1]
        );
    }
    
    retirementChart.update();
}

// Inicialização da página
async function initRetirementPage() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        showLoading();
        
        // Carregar dados financeiros
        const [savings, availableForRetirement] = await Promise.all([
            refreshCurrentSavings(),
            refreshFinancialSummary()
        ]);
        
        // Carregar plano salvo ou usar padrões
        let savedPlan = null;
        try {
            const doc = await db.collection('users').doc(user.uid).collection('retirementPlans').doc('current').get();
            savedPlan = doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Erro ao carregar plano:', error);
        }
        
        // Preencher formulário
        document.getElementById('current-age').value = savedPlan?.currentAge || 30;
        document.getElementById('retirement-age').value = savedPlan?.retirementAge || 65;
        document.getElementById('monthly-income').value = savedPlan?.monthlyIncome || 10000;
        document.getElementById('annual-return').value = savedPlan?.annualReturn || 7;
        document.getElementById('inflation').value = savedPlan?.inflation || 4;
        
        // Calcular plano inicial
        const goals = await getGoalsForChart(savedPlan?.currentAge || 30);
        const planParams = {
            currentAge: savedPlan?.currentAge || 30,
            retirementAge: savedPlan?.retirementAge || 65,
            monthlyIncome: savedPlan?.monthlyIncome || 10000,
            currentSavings: savings,
            annualReturn: savedPlan?.annualReturn || 7,
            inflation: savedPlan?.inflation || 4,
            monthlyInvestment: availableForRetirement
        };
        
        const plan = calculateRetirementPlan(planParams, goals);
        if (plan) displayRetirementPlan(plan);
        
    } catch (error) {
        console.error("Erro ao inicializar a página:", error);
        showAlert("Erro ao carregar dados: " + error.message, "error");
    } finally {
        hideLoading();
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Eventos de formulário
    retirementForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePlan();
    });
    
    recalculateBtn.addEventListener('click', recalculatePlan);
    refreshDataBtn.addEventListener('click', async () => {
        showLoading();
        await Promise.all([refreshFinancialSummary(), refreshCurrentSavings()]);
        await recalculatePlan();
        hideLoading();
        showAlert("Dados atualizados com sucesso!");
    });
    
    refreshSavingsBtn.addEventListener('click', async () => {
        await refreshCurrentSavings();
        showAlert("Valor acumulado atualizado");
    });
    
    // Filtros de tempo
    document.querySelectorAll('.time-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.time-filter-btn').forEach(b => {
                b.classList.remove('bg-green-600', 'text-white');
                b.classList.add('bg-zinc-700', 'hover:bg-zinc-600');
            });
            btn.classList.add('bg-green-600', 'text-white');
            btn.classList.remove('bg-zinc-700', 'hover:bg-zinc-600');
            
            filterChartByYears(btn.dataset.years);
        });
    });
    
    // Atualização automática ao mudar parâmetros
    const autoUpdateInputs = [
        'current-age', 'retirement-age', 'monthly-income', 
        'current-savings', 'annual-return', 'inflation'
    ];
    
    autoUpdateInputs.forEach(id => {
        document.getElementById(id).addEventListener('change', recalculatePlan);
    });
});

// Inicializar quando o usuário estiver autenticado
auth.onAuthStateChanged(user => {
    if (user) {
        // --- INÍCIO DO CÓDIGO ADICIONADO ---
        // Preenche as informações do usuário no cabeçalho
        const userNameEl = document.getElementById('user-name');
        const userEmailEl = document.getElementById('user-email');
        const userPhotoEl = document.getElementById('user-photo');

        if (userNameEl) userNameEl.textContent = user.displayName || 'Usuário';
        if (userEmailEl) userEmailEl.textContent = user.email;
        if (userPhotoEl && user.photoURL) {
            userPhotoEl.src = user.photoURL;
            userPhotoEl.classList.remove('hidden');
        }
        // --- FIM DO CÓDIGO ADICIONADO ---

        initRetirementPage();
    } else {
        window.location.href = "/index.html";
    }
});