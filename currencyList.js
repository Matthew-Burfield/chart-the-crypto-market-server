module.exports = {
	new() {
		return {
			currentCoins: {},

			remove(symbol) {
				delete this.currentCoins[symbol]
				return this.getAll()
			},

			update(coinsHistoricQuotes) {
				Object.assign(this.currentCoins, {
					[coinsHistoricQuotes.symbol]: coinsHistoricQuotes,
				})
				return this.getAll()
			},

			getAll() {
				return this.currentCoins
			},
		}
	},
}
