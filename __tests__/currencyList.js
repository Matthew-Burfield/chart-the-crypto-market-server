const CurrencyList = require('../currencyList')

const returnCoin = props => ({
	_id: '5aa9aae0cb2b1c00803f0c5a',
	symbol: 'BTC',
	timeFrom: 1520380800,
	timeTo: 1521244800,
	conversionTo: 'USD',
	history: [],
	...props,
})

let currencyList

beforeEach(() => {
	currencyList = CurrencyList.new()
})

test('The list of currency defaults to nothing', () => {
	const defaultList = {}
	expect(currencyList.getAll()).toEqual(defaultList)
})

test('I can add a coin to the list', () => {
	const newCoin = returnCoin()
	currencyList.update(newCoin)
	expect(currencyList.getAll()).toEqual({
		[newCoin.symbol]: newCoin,
	})
})

test('Updating the list returns the full coin list', () => {
	const firstCoin = returnCoin()
	const secondCoin = returnCoin({ symbol: 'LTC' })
	currencyList.update(firstCoin)
	const fullList = currencyList.update(secondCoin)
	expect(currencyList.getAll()).toEqual(fullList)
})

test("Updating the list with a coin already added updates it's values, and doesn'nt add a second property", () => {
	const firstCoin = returnCoin({ timeTo: 100000000 })
	const newTimeTo = 20000000
	const firstCoinUpdated = returnCoin({ timeTo: newTimeTo })
	currencyList.update(firstCoin)
	currencyList.update(firstCoinUpdated)
	expect(currencyList.getAll()[firstCoin.symbol].timeTo).toEqual(newTimeTo)
})

test('I can remove a coin from the list', () => {
	const symbol = 'XRP'
	const defaultList = {}
	const firstCoin = returnCoin({ symbol })
	currencyList.remove(symbol)
	expect(currencyList.getAll()).toEqual(defaultList)
})

test('If I have more than one coin in the list, only the one I remove gets removed and the rest are returned', () => {
	const firstCoinSymbol = 'BTC'
	const firstCoin = returnCoin({ symbol: firstCoinSymbol })
	currencyList.update(firstCoin)
	const secondCoin = returnCoin({ symbol: 'LTC' })
	currencyList.update(secondCoin)

	currencyList.remove(firstCoinSymbol)
	expect(currencyList.getAll()).toEqual({
		[secondCoin.symbol]: secondCoin,
	})
})
