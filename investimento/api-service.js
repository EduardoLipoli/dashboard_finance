/**
 * api-service.js
 * * Este arquivo centraliza todas as chamadas a APIs externas para buscar
 * cotações de ativos financeiros.
 */

const ApiService = {
  
    // =========================================================================
    // IMPORTANTE: Insira seu token pessoal da Brapi aqui
    // =========================================================================
    brapiToken: 'avwUYm28pDatzjYmQZkSK8', 
    // =========================================================================

    /**
     * Busca o preço de um ativo da B3 (Ação, FII, ETF) usando a API Brapi.
     */
    async _fetchB3Price(ticker) {
        // Se o token não foi preenchido, retorna um erro para o console.
        if (this.brapiToken === 'COLE_SEU_TOKEN_AQUI' || !this.brapiToken) {
            console.error("ERRO: Token da Brapi não foi configurado no arquivo api-service.js");
            return null;
        }

        try {
            // Adicionamos o parâmetro "?token=" na URL da requisição
            const url = `https://brapi.dev/api/quote/${ticker}?token=${this.brapiToken}`;
            const response = await fetch(url);

            if (!response.ok) {
                // O erro 401 (Unauthorized) será capturado aqui
                console.error(`Erro na API Brapi para ${ticker}: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            const asset = data.results[0];
            return asset ? asset.regularMarketPrice : null;
        } catch (error) {
            console.error(`Falha ao buscar preço B3 para ${ticker}:`, error);
            return null;
        }
    },

    /**
     * Busca o preço de uma criptomoeda usando a API CoinGecko.
     */
        async fetchAllAvailable() {
        try {
            const url = `https://brapi.dev/api/available?token=${this.brapiToken}`;
            const response = await fetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return data.stocks || []; // Retorna a lista de tickers de ações
        } catch (error) {
            console.error("Erro ao buscar a lista de todos os ativos:", error);
            return [];
        }
    },
    
    async _fetchCryptoPrice(ticker) {
        const idMap = {
            'BTC': 'bitcoin', 'ETH': 'ethereum', 'USDT': 'tether',
            'BNB': 'binancecoin', 'SOL': 'solana', 'XRP': 'ripple', 'ADA': 'cardano',
        };
        const coinId = idMap[ticker.toUpperCase()] || ticker.toLowerCase();

        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=brl`);
            if (!response.ok) {
                console.error(`Erro na API CoinGecko para ${coinId}: ${response.statusText}`);
                return null;
            }
            const data = await response.json();
            return data[coinId] ? data[coinId].brl : null;
        } catch (error) {
            console.error(`Falha ao buscar preço da cripto ${coinId}:`, error);
            return null;
        }
    },

    /**
     * Função principal que escolhe qual API chamar.
     */
    async fetchCurrentPrice(ticker, type, fallbackPrice) {
        let newPrice = null;
        const upperCaseTicker = ticker.toUpperCase();

        if (type === 'acao' || type === 'fii' || type === 'etf') {
            newPrice = await this._fetchB3Price(upperCaseTicker);
        } else if (type === 'cripto') {
            newPrice = await this._fetchCryptoPrice(upperCaseTicker);
        }

        return newPrice !== null ? newPrice : fallbackPrice;
    }
};