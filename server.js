const axios = require('axios')
const bodyParser = require('body-parser')
const cors = require('cors')
const express = require('express')

const coins = require('./coinsList')
const differenceInCalendarDays = require('date-fns/difference_in_calendar_days')
const utilities = require('./utilities')
const CurrencyList = require('./currencyList')

const app = express()
const PORT = process.env.NODE_ENV === 'production' ? 443 : 3001
const INITIAL_HISTORY_LIMIT = 5
const TEST_TO_TS = 1520812800
const currencyList = CurrencyList.new()

app.use(
	cors({
		origin: process.env.ORIGIN,
		optionsSuccessStatus: 200,
	}),
)
app.use(bodyParser.json())

app.get('/', (req, res) => res.send('Hello now!'))

app.get('/currency_list', (req, res) => {
	res.json({
		success: true,
		data: coins,
	})
})

app.get('/top_20', async (req, res) => {
	const data = await axios
		.get('https://min-api.cryptocompare.com/data/top/volumes?tsym=USD&limit=20')
		.then(response => response.data.Data)
	res.json({
		success: true,
		data: data.filter(item => coins[item.SYMBOL]).map(item => ({
			name: item.NAME,
			symbol: item.SYMBOL,
			image_url: coins[item.SYMBOL].ImageUrl,
		})),
	})
})

const getOutOfDateCoinsFromCurrentList = async () => {
	const today = new Date(utilities.getCurrentUTCTime())
	const outOfDateCoins = Object.values(currencyList.getAll()).filter(
		coin => !utilities.daysAreTheSame(today, new Date(coin.timeTo * 1000)),
	)
	if (outOfDateCoins.length > 0) {
		utilities.logger(
			`${outOfDateCoins.length} coins are out of date and need updating!`,
		)
		await getLatestDataForCurrentCoins(outOfDateCoins)
	}
}

const saveToDatabase = async (symbol, set = {}, push = {}) => {
	if (!symbol) return
	const [
		database,
		historicQuotesCollection,
	] = await utilities.getDatabaseCollection('History')
	await historicQuotesCollection.updateOne(
		{ symbol },
		{
			$set: set,
			$push: push,
		},
		{
			upsert: true,
		},
	)
	database.close()
	return await getOneCurrencyFromDatabase(symbol)
}

const getOneCurrencyFromDatabase = async symbol => {
	if (!symbol) return null
	const [
		database,
		historicQuotesCollection,
	] = await utilities.getDatabaseCollection('History')
	const currencyHistory = await utilities.queryCollection(
		historicQuotesCollection,
		{
			symbol,
		},
	)
	database.close()
	return currencyHistory
}

const getLatestDataForCurrentCoins = async coinsToFetch => {
	console.log('coins to fetch: ', coinsToFetch)
	const today = new Date(utilities.getCurrentUTCTime())
	const fetchedCoinPromises = coinsToFetch.map(coin => {
		const limit = differenceInCalendarDays(today, new Date(coin.timeTo * 1000))
		return axios.get(
			`https://min-api.cryptocompare.com/data/histoday?fsym=${
				coin.symbol
			}&tsym=USD&limit=${limit}`,
		)
	})
	const coinsHistoricQuoteUpdates = await axios.all(fetchedCoinPromises).then(
		axios.spread((...args) => {
			// Both requests are now complete
			return args.map(item => item.data)
		}),
	)
	utilities.logger('Fetched all coins!', coinsHistoricQuoteUpdates)

	// Save all coins to DB and update current coin list
	coinsHistoricQuoteUpdates.forEach(async (updatedCoin, index) => {
		const updatedCoinWithLastFetchedDateRemoved = updatedCoin.Data.filter(
			item => item.time !== coinsToFetch[index].timeTo,
		)
		const newCurrencyAdded = await await saveToDatabase(
			coinsToFetch[index].symbol,
			{ timeTo: updatedCoin.TimeTo },
			{ history: { $each: updatedHistoryWithLastFetchedDateRemoved } },
		)
		currencyList.update(newCurrencyAdded)
	})
}

app.get('/list', async (req, res) => {
	await getOutOfDateCoinsFromCurrentList()
	res.send({ success: true, data: currencyList.getAll() })
})

app.post('/add_coin', async (req, res) => {
	const symbol = req.body.symbol
	if (!utilities.symbolIsValid(symbol)) {
		return utilities.returnError(res, utilities.getSymbolErrorMessage(symbol))
	}
	utilities.logger('Symbol is valid')
	try {
		const coinsHistoricQuotes = await getOneCurrencyFromDatabase(symbol)
		utilities.logger(
			`historicQuotes is defined: ${utilities.isDefined(coinsHistoricQuotes)}`,
		)
		if (utilities.isDefined(coinsHistoricQuotes)) {
			// Yay, we have the coin
			// If the last time we retrieved data is today, then just return, otherwise we need to update
			const lastFetchDate = new Date(coinsHistoricQuotes.timeTo * 1000)
			const startOfToday = new Date(utilities.getCurrentUTCTime())
			if (utilities.daysAreTheSame(lastFetchDate, startOfToday)) {
				utilities.logger('Found coin in db, and is current. Returning to user.')
				// TODO: this needs to be updated - currencyList.update accepts the entire updated list
				res.send({
					success: true,
					currencyList: currencyList.update(coinsHistoricQuotes),
				})
			} else {
				// We don't have the lastest, so we need to get from lastFetchDate, to now
				utilities.logger('Found coin in db, but out of date. updating...')
				const limit = differenceInCalendarDays(startOfToday, lastFetchDate)
				const uri = `https://min-api.cryptocompare.com/data/histoday?fsym=${symbol}&tsym=USD&limit=${limit}&toTs=${TEST_TO_TS}`
				utilities.logger(uri)
				const coinsHistoricQuoteUpdates = await axios.get(uri)
				const updatedHistoryWithLastFetchedDateRemoved = coinsHistoricQuoteUpdates.data.Data.filter(
					item => item.time !== coinsHistoricQuotes.timeTo,
				)
				utilities.logger(`Old timeTo: ${coinsHistoricQuotes.timeTo}`)
				utilities.logger(`New timeTo: ${coinsHistoricQuoteUpdates.data.TimeTo}`)
				// utilities.logger(updatedHistoryWithLastFetchedDateRemoved)
				// TODO: compare newCurrencyAdded to newCoinsHistoryQuotes
				const newCurrencyAdded = await saveToDatabase(
					symbol,
					{ timeTo: coinsHistoricQuoteUpdates.data.TimeTo },
					{ history: { $each: updatedHistoryWithLastFetchedDateRemoved } },
				)
				utilities.logger('Updated to db!')

				res.send({
					success: true,
					currencyList: currencyList.update(newCurrencyAdded),
				})
			}
		} else {
			// We don't have the coin so we definitely need to fetch it
			const coinsHistoricQuotes = await axios.get(
				`https://min-api.cryptocompare.com/data/histoday?fsym=${symbol}&tsym=USD&limit=${INITIAL_HISTORY_LIMIT}&toTs=${TEST_TO_TS}`,
			)
			// We have the data, so save back to local db
			utilities.logger('Have fetched the new coin!')
			const newCurrencyAdded = await saveToDatabase(symbol, {
				symbol,
				timeFrom: coinsHistoricQuotes.data.TimeFrom,
				timeTo: coinsHistoricQuotes.data.TimeTo,
				history: coinsHistoricQuotes.data.Data,
				conversionTo: 'USD',
			})
			utilities.logger('Updated new coin to db!')
			res.send({
				success: true,
				data: currencyList.update(newCurrencyAdded),
			})
		}
	} catch (err) {
		utilities.returnError(res, err)
	}
})

app.post('/remove_coin', (req, res) => {
	const symbol = req.body.symbol
	res.json({
		success: true,
		data: currencyList.remove(symbol),
	})
})

app.listen(PORT, () => {
	utilities.logger(`Example app listening on port ${PORT}!`)
})
