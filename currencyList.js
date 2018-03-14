const currentCoins = {}

const remove = symbol => {
	currentCoins = currentCoins.filter(coin => coin.code !== symbol)
	return getAll()
}

const update = coinsHistoricQuotes => {
	Object.assign(currentCoins, updatedCoins)
	return getAll()
}

const getAll = () => currentCoins

module.exports = {
	getAll,
	remove,
	update,
}
