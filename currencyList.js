const currentCoins = {}

const remove = symbol => {
	delete currentCoins[symbol]
	return getAll()
}

const update = coinsHistoricQuotes => {
	Object.assign(currentCoins, {
		[coinsHistoricQuotes.symbol]: coinsHistoricQuotes,
	})
	return getAll()
}

const getAll = () => currentCoins

module.exports = {
	getAll,
	remove,
	update,
}
