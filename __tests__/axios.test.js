const axios = require('axios')

jest.mock('axios')

const axiosReturnValue = (dataOverrides = {}) => ({
	config: {},
	data: {
		Response: 'Success',
		Type: 100,
		Aggregated: false,
		ConversionType: { type: 'direct', conversionSymbol: '' },
		Data: [],
		FirstValueInArray: true,
		Response: 'Success',
		TimeFrom: 1520726400,
		TimeTo: 1520812800,
		...dataOverrides,
	},
	headers: {
		server: 'nginx/1.10.3',
		date: 'Sun, 18 Mar 2018 22:50:03 GMT',
		'content-type': 'application/json; charset=UTF-8',
	},
	request: { domain: null, _events: Object, _eventsCount: 6 },
	status: 200,
	statusText: 'OK',
})

test('testing axios mock...', async () => {
	const symbol = 'BTC'
	const limit = 5
	const uri = `https://min-api.cryptocompare.com/data/histoday?fsym=${symbol}&tsym=USD&limit=${limit}`
	const response = axiosReturnValue()
	axios.get.mockResolvedValue(response)
	const coinsHistoricQuoteUpdates = await axios.get(uri)
	// console.log(coinsHistoricQuoteUpdates)
})
